const { WebSocket, WebSocketServer } = require('ws');

const ROUTE_PATH = '/api/podcast-conference';
const ROOM_TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const PARTICIPANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_GUEST_CONNECTIONS = 10;

const sendJson = (socket, message) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value, maxLength = 4096) => typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const validDescription = (description, expectedType) => (
  isRecord(description)
  && description.type === expectedType
  && isText(description.sdp, 100000)
);

const validCandidate = (candidate) => (
  isRecord(candidate)
  && typeof candidate.candidate === 'string'
  && candidate.candidate.length <= 4096
  && (candidate.sdpMid === undefined || candidate.sdpMid === null || isText(candidate.sdpMid, 256))
  && (candidate.sdpMLineIndex === undefined || candidate.sdpMLineIndex === null || Number.isInteger(candidate.sdpMLineIndex))
  && (candidate.usernameFragment === undefined || candidate.usernameFragment === null || isText(candidate.usernameFragment, 256))
);

const normalizeSignal = (participant, room, signal) => {
  if (!isRecord(signal) || typeof signal.type !== 'string') return null;

  if (participant.role === 'guest') {
    if (signal.type === 'guest-request' && isText(signal.guestName, 60)) {
      return {
        target: room.host,
        signal: { type: 'guest-request', guestId: participant.id, guestName: signal.guestName.trim().slice(0, 60) },
      };
    }
    if (signal.type === 'guest-left') {
      return {
        target: room.host,
        signal: { type: 'guest-left', guestId: participant.id },
      };
    }
    if (signal.type === 'answer' && signal.to === room.host.id && validDescription(signal.sdp, 'answer')) {
      return {
        target: room.host,
        signal: { type: 'answer', from: participant.id, to: room.host.id, sdp: signal.sdp },
      };
    }
    if (signal.type === 'ice-candidate' && signal.to === room.host.id && validCandidate(signal.candidate)) {
      return {
        target: room.host,
        signal: { type: 'ice-candidate', from: participant.id, to: room.host.id, candidate: signal.candidate },
      };
    }
    return null;
  }

  if (signal.type === 'host-ended') return { broadcast: true, signal: { type: 'host-ended' } };
  if (signal.type === 'offer' && isText(signal.to, 64) && validDescription(signal.sdp, 'offer')) {
    const target = room.guests.get(signal.to);
    if (!target) return null;
    return { target, signal: { type: 'offer', from: participant.id, to: target.id, sdp: signal.sdp } };
  }
  if (signal.type === 'ice-candidate' && isText(signal.to, 64) && validCandidate(signal.candidate)) {
    const target = room.guests.get(signal.to);
    if (!target) return null;
    return {
      target,
      signal: { type: 'ice-candidate', from: participant.id, to: target.id, candidate: signal.candidate },
    };
  }
  if (
    signal.type === 'guest-admitted'
    && isText(signal.guestId, 64)
    && isText(signal.guestName, 60)
  ) {
    const target = room.guests.get(signal.guestId);
    if (!target) return null;
    return {
      target,
      signal: { type: 'guest-admitted', guestId: target.id, guestName: signal.guestName.slice(0, 60) },
    };
  }
  if (
    (signal.type === 'guest-declined' || signal.type === 'guest-removed')
    && isText(signal.guestId, 64)
    && isText(signal.reason, 240)
  ) {
    const target = room.guests.get(signal.guestId);
    if (!target) return null;
    return {
      target,
      signal: { type: signal.type, guestId: target.id, reason: signal.reason },
    };
  }
  return null;
};

function attachPodcastConferenceSignaling(server) {
  const rooms = new Map();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  const allowedOrigins = new Set([
    'https://nexsq.com',
    'https://www.nexsq.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:3000',
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ]);

  const closeRoom = (room) => {
    if (room.closed) return;
    if (!room.ending) {
      room.guests.forEach((guest) => {
        sendJson(guest.socket, { type: 'signal', signal: { type: 'host-ended' } });
      });
    }
    room.ending = true;
    room.closed = true;
    room.guests.forEach((guest) => {
      guest.socket.close(4001, 'Host ended the recording');
    });
    room.guests.clear();
    room.cleanupTimer = setTimeout(() => {
      if (rooms.get(room.token) === room) rooms.delete(room.token);
    }, 60 * 60 * 1000);
    room.cleanupTimer.unref?.();
  };

  server.on('upgrade', (request, socket, head) => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (requestUrl.pathname !== ROUTE_PATH) return;
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request, requestUrl);
    });
  });

  webSocketServer.on('connection', (socket, _request, requestUrl) => {
    socket.on('error', (error) => {
      console.warn('Podcast conference socket error:', error.message);
    });
    const token = requestUrl.searchParams.get('room') || '';
    const role = requestUrl.searchParams.get('role');
    const participantId = requestUrl.searchParams.get('participant') || '';
    if (
      !ROOM_TOKEN_PATTERN.test(token)
      || !PARTICIPANT_ID_PATTERN.test(participantId)
      || !['host', 'guest'].includes(role)
    ) {
      sendJson(socket, { type: 'room-error', message: 'This conference invite is invalid.' });
      socket.close(4002, 'Invalid conference invite');
      return;
    }

    let room = null;
    let participant = null;
    let joined = false;
    const joinTimeout = setTimeout(() => {
      if (joined) return;
      sendJson(socket, { type: 'room-error', message: 'The conference join request timed out.' });
      socket.close(4006, 'Join request timed out');
    }, 10000);
    joinTimeout.unref?.();

    socket.on('message', (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        sendJson(socket, { type: joined ? 'signal-error' : 'room-error', message: 'The conference message was invalid.' });
        if (!joined) socket.close(4002, 'Invalid join request');
        return;
      }
      if (!joined) {
        const hostKey = isRecord(message) ? message.hostKey : '';
        if (
          !isRecord(message)
          || message.type !== 'join'
          || (role === 'host' && (typeof hostKey !== 'string' || !ROOM_TOKEN_PATTERN.test(hostKey)))
        ) {
          sendJson(socket, { type: 'room-error', message: 'The conference join request was invalid.' });
          socket.close(4002, 'Invalid join request');
          return;
        }

        room = rooms.get(token);
        if (role === 'host') {
          if (room) {
            const errorMessage = room.hostKey !== hostKey
              ? 'This host connection is not authorized for the room.'
              : room.ending
                ? 'This conference has ended. Start a new recording for a fresh invite.'
                : 'The host is already connected to this room.';
            sendJson(socket, { type: 'room-error', message: errorMessage });
            socket.close(4003, 'Host room is unavailable');
            return;
          }
          room = { token, hostKey, host: null, guests: new Map(), ending: false, closed: false };
          rooms.set(token, room);
          participant = { id: participantId, role, socket };
          room.host = participant;
        } else {
          if (!room?.host || room.host.socket.readyState !== WebSocket.OPEN || room.ending) {
            sendJson(socket, { type: 'room-error', message: 'This conference is not active. Ask the host for a current invite.' });
            socket.close(4004, 'Conference is not active');
            return;
          }
          if (room.guests.size >= MAX_GUEST_CONNECTIONS || room.guests.has(participantId)) {
            sendJson(socket, { type: 'room-error', message: 'This conference cannot accept another guest connection.' });
            socket.close(4005, 'Conference is full');
            return;
          }
          participant = { id: participantId, role, socket };
          room.guests.set(participantId, participant);
        }

        joined = true;
        clearTimeout(joinTimeout);
        sendJson(socket, { type: 'room-ready', role });
        return;
      }

      if (!isRecord(message) || message.type !== 'signal' || !isText(message.requestId, 64)) {
        sendJson(socket, {
          type: 'signal-error',
          requestId: isRecord(message) && isText(message.requestId, 64) ? message.requestId : '',
          message: 'The conference message was invalid.',
        });
        return;
      }

      const relay = normalizeSignal(participant, room, message.signal);
      if (!relay) {
        sendJson(socket, { type: 'signal-error', requestId: message.requestId, message: 'The conference message could not be routed.' });
        return;
      }

      const envelope = { type: 'signal', signal: relay.signal };
      const delivered = relay.broadcast
        ? Array.from(room.guests.values()).map((guest) => sendJson(guest.socket, envelope)).every(Boolean)
        : relay.target && sendJson(relay.target.socket, envelope);
      if (!delivered) {
        sendJson(socket, { type: 'signal-error', requestId: message.requestId, message: 'The other participant is no longer connected.' });
        return;
      }
      if (relay.broadcast) room.ending = true;
      sendJson(socket, { type: 'signal-sent', requestId: message.requestId });
    });

    socket.on('close', () => {
      clearTimeout(joinTimeout);
      if (!participant || !room) return;
      if (participant.role === 'host') {
        closeRoom(room);
      } else {
        room.guests.delete(participant.id);
        sendJson(room.host?.socket, {
          type: 'signal',
          signal: { type: 'guest-left', guestId: participant.id },
        });
      }
    });
  });

  return webSocketServer;
}

module.exports = { attachPodcastConferenceSignaling };
