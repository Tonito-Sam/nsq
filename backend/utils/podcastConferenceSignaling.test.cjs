const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { test } = require('node:test');
const { WebSocket } = require('ws');
const { attachPodcastConferenceSignaling } = require('./podcastConferenceSignaling.cjs');

const waitForMessage = (socket, predicate) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    socket.off('message', onMessage);
    reject(new Error('Timed out waiting for a WebSocket message.'));
  }, 3000);
  const onMessage = (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch (error) {
      clearTimeout(timeout);
      socket.off('message', onMessage);
      reject(error);
      return;
    }
    if (!predicate(message)) return;
    clearTimeout(timeout);
    socket.off('message', onMessage);
    resolve(message);
  };
  socket.on('message', onMessage);
});

const connect = async (url, hostKey = '') => {
  const socket = new WebSocket(url);
  const readyMessage = waitForMessage(
    socket,
    (message) => message.type === 'room-ready' || message.type === 'room-error',
  );
  await once(socket, 'open');
  socket.send(JSON.stringify({ type: 'join', ...(hostKey ? { hostKey } : {}) }));
  const response = await readyMessage;
  if (response.type === 'room-error') {
    socket.close();
    throw new Error(response.message);
  }
  return socket;
};

const closeSocket = async (socket) => {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = once(socket, 'close');
  socket.close();
  await closed;
};

test('relays room signals and prevents guests from forging host messages', async (t) => {
  const server = http.createServer();
  const signalingServer = attachPodcastConferenceSignaling(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const roomToken = 'a'.repeat(48);
  const hostKey = 'b'.repeat(48);
  const hostId = 'host-123';
  const guestId = 'guest-456';
  const baseUrl = `ws://127.0.0.1:${address.port}/api/podcast-conference?room=${roomToken}`;
  let host;
  let guest;
  let forgedHost;

  t.after(async () => {
    if (host) await closeSocket(host);
    if (guest) await closeSocket(guest);
    if (forgedHost) await closeSocket(forgedHost);
    await new Promise((resolve) => signalingServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  host = await connect(`${baseUrl}&role=host&participant=${hostId}`, hostKey);
  guest = await connect(`${baseUrl}&role=guest&participant=${guestId}`);

  const hostSignal = waitForMessage(host, (message) => message.type === 'signal' && message.signal.type === 'guest-request');
  const guestAck = waitForMessage(guest, (message) => message.type === 'signal-sent' && message.requestId === 'request-1');
  guest.send(JSON.stringify({
    type: 'signal',
    requestId: 'request-1',
    signal: { type: 'guest-request', guestId: 'spoofed-id', guestName: 'Guest' },
  }));
  const request = await hostSignal;
  await guestAck;
  assert.equal(request.signal.guestId, guestId);

  const guestError = waitForMessage(guest, (message) => message.type === 'signal-error' && message.requestId === 'request-2');
  guest.send(JSON.stringify({
    type: 'signal',
    requestId: 'request-2',
    signal: { type: 'offer', from: guestId, to: hostId, sdp: { type: 'offer', sdp: 'forged' } },
  }));
  await guestError;

  forgedHost = await connect(`${baseUrl}&role=host&participant=attacker`, 'c'.repeat(48)).catch((error) => {
    assert.match(error.message, /not authorized/);
    return null;
  });
  assert.equal(forgedHost, null);
});
