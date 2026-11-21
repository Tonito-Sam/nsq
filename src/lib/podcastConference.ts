import { apiUrl } from './api';

export type PodcastConferenceSignal =
  | { type: 'guest-request'; guestId: string; guestName: string }
  | { type: 'guest-admitted'; guestId: string; guestName: string }
  | { type: 'guest-declined'; guestId: string; reason: string }
  | { type: 'guest-removed'; guestId: string; reason: string }
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'guest-left'; guestId: string }
  | { type: 'host-ended' };

export type PodcastConferenceRole = 'host' | 'guest';
export type PodcastConferenceConnection = {
  send: (signal: PodcastConferenceSignal) => Promise<void>;
  close: () => void;
};

type ConnectOptions = {
  roomToken: string;
  hostKey?: string;
  role: PodcastConferenceRole;
  participantId: string;
  onSignal: (signal: PodcastConferenceSignal) => void;
  onClose?: () => void;
};

type PendingSend = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: number;
};

export const PODCAST_STUN_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

type PodcastPeerConnectionWindow = Window & {
  RTCPeerConnection?: typeof RTCPeerConnection;
  webkitRTCPeerConnection?: typeof RTCPeerConnection;
  mozRTCPeerConnection?: typeof RTCPeerConnection;
};

const isPeerConnectionConstructor = (candidate: unknown): candidate is typeof RTCPeerConnection => {
  if (typeof candidate !== 'function') return false;
  try {
    Reflect.construct(Function, [], candidate);
    return true;
  } catch {
    return false;
  }
};

export function createPodcastPeerConnection(configuration: RTCConfiguration) {
  const browserWindow = window as PodcastPeerConnectionWindow;
  const PeerConnection = [
    browserWindow.RTCPeerConnection,
    browserWindow.webkitRTCPeerConnection,
    browserWindow.mozRTCPeerConnection,
  ].find(isPeerConnectionConstructor);

  if (!PeerConnection) {
    throw new Error('WebRTC is not supported in this browser. Use a current browser over HTTPS.');
  }
  return new PeerConnection(configuration);
}

export function createPodcastConferenceRoomToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPodcastConferenceParticipantId() {
  return globalThis.crypto.randomUUID();
}

export async function getPodcastConferenceIceServers(): Promise<RTCIceServer[]> {
  const response = await fetch(apiUrl('/api/turn/creds?ttl=3600'));
  if (!response.ok) throw new Error(`Could not load self-hosted TURN settings (${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('The TURN settings response was invalid.');
  const settings = payload as Record<string, unknown>;
  const urls = typeof settings.url === 'string'
    ? settings.url.split(',').map((url) => url.trim()).filter(Boolean)
    : [];
  if (!urls.length) return [];
  const credentials = urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
  if (credentials && (typeof settings.username !== 'string' || typeof settings.password !== 'string')) {
    throw new Error('The self-hosted TURN credentials are incomplete.');
  }
  return [{
    urls,
    ...(typeof settings.username === 'string' ? { username: settings.username } : {}),
    ...(typeof settings.password === 'string' ? { credential: settings.password } : {}),
  }];
}

export function connectToPodcastConference({
  roomToken,
  hostKey,
  role,
  participantId,
  onSignal,
  onClose,
}: ConnectOptions): Promise<PodcastConferenceConnection> {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(apiUrl('/api/podcast-conference'), window.location.origin);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    endpoint.searchParams.set('room', roomToken);
    endpoint.searchParams.set('role', role);
    endpoint.searchParams.set('participant', participantId);

    const socket = new WebSocket(endpoint);
    const pendingSends = new Map<string, PendingSend>();
    let ready = false;
    let settled = false;
    let intentionalClose = false;
    const connectionTimeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new Error('The conference signaling server did not respond. Please try again.'));
    }, 15_000);

    const finishPendingSends = (message: string) => {
      pendingSends.forEach(({ reject: rejectSend, timeout }) => {
        window.clearTimeout(timeout);
        rejectSend(new Error(message));
      });
      pendingSends.clear();
    };

    socket.addEventListener('open', () => {
      try {
        socket.send(JSON.stringify({ type: 'join', ...(role === 'host' && hostKey ? { hostKey } : {}) }));
      } catch (joinError) {
        if (settled) return;
        settled = true;
        window.clearTimeout(connectionTimeout);
        socket.close();
        reject(joinError instanceof Error ? joinError : new Error('Could not join the conference room.'));
      }
    });

    socket.addEventListener('message', (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        if (!settled) {
          settled = true;
          window.clearTimeout(connectionTimeout);
          reject(new Error('The conference server sent an invalid response.'));
        }
        socket.close(1003, 'Invalid message');
        return;
      }

      if (!message || typeof message !== 'object') return;
      const payload = message as Record<string, unknown>;
      if (payload.type === 'room-ready') {
        if (settled) return;
        settled = true;
        ready = true;
        window.clearTimeout(connectionTimeout);
        resolve({
          send: (signal) => new Promise<void>((resolveSend, rejectSend) => {
            if (socket.readyState !== WebSocket.OPEN) {
              rejectSend(new Error('The conference connection is closed.'));
              return;
            }
            const requestId = createPodcastConferenceParticipantId();
            const timeout = window.setTimeout(() => {
              pendingSends.delete(requestId);
              rejectSend(new Error('The conference server did not relay a message in time.'));
            }, 10_000);
            pendingSends.set(requestId, { resolve: resolveSend, reject: rejectSend, timeout });
            try {
              socket.send(JSON.stringify({ type: 'signal', requestId, signal }));
            } catch (sendError) {
              window.clearTimeout(timeout);
              pendingSends.delete(requestId);
              rejectSend(sendError instanceof Error ? sendError : new Error('Could not send a conference message.'));
            }
          }),
          close: () => {
            intentionalClose = true;
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
          },
        });
        return;
      }

      if (payload.type === 'room-error') {
        const errorMessage = typeof payload.message === 'string' ? payload.message : 'This conference room is unavailable.';
        if (!settled) {
          settled = true;
          window.clearTimeout(connectionTimeout);
          reject(new Error(errorMessage));
        }
        return;
      }

      if (payload.type === 'signal-sent' || payload.type === 'signal-error') {
        if (typeof payload.requestId !== 'string') return;
        const pending = pendingSends.get(payload.requestId);
        if (!pending) return;
        pendingSends.delete(payload.requestId);
        window.clearTimeout(pending.timeout);
        if (payload.type === 'signal-sent') {
          pending.resolve();
        } else {
          pending.reject(new Error(typeof payload.message === 'string' ? payload.message : 'Could not relay a conference message.'));
        }
        return;
      }

      if (payload.type === 'signal' && isPodcastConferenceSignal(payload.signal)) {
        onSignal(payload.signal);
      }
    });

    socket.addEventListener('error', () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(connectionTimeout);
        reject(new Error('Could not connect to the NexSq conference server.'));
      }
    });

    socket.addEventListener('close', () => {
      window.clearTimeout(connectionTimeout);
      finishPendingSends('The conference connection closed before the message was relayed.');
      if (!settled) {
        settled = true;
        reject(new Error('The conference room could not be joined.'));
      } else if (ready && !intentionalClose) {
        onClose?.();
      }
    });
  });
}

export function sendPodcastConferenceSignal(
  connection: PodcastConferenceConnection,
  signal: PodcastConferenceSignal,
) {
  return connection.send(signal);
}

export function isPodcastConferenceSignal(value: unknown): value is PodcastConferenceSignal {
  if (!value || typeof value !== 'object') return false;
  const signal = value as Record<string, unknown>;
  const isText = (field: unknown) => typeof field === 'string' && field.length > 0;
  const hasRoute = isText(signal.from) && isText(signal.to);
  switch (signal.type) {
    case 'guest-request':
    case 'guest-admitted':
      return isText(signal.guestId) && isText(signal.guestName);
    case 'guest-declined':
    case 'guest-removed':
      return isText(signal.guestId) && isText(signal.reason);
    case 'offer':
    case 'answer': {
      if (!hasRoute || !signal.sdp || typeof signal.sdp !== 'object') return false;
      const description = signal.sdp as Record<string, unknown>;
      return description.type === signal.type
        && isText(description.sdp);
    }
    case 'ice-candidate': {
      if (!hasRoute || !signal.candidate || typeof signal.candidate !== 'object') return false;
      return typeof (signal.candidate as Record<string, unknown>).candidate === 'string';
    }
    case 'guest-left':
      return isText(signal.guestId);
    case 'host-ended':
      return true;
    default:
      return false;
  }
}
