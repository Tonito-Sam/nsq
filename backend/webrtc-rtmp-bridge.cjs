// webrtc-rtmp-bridge.cjs
// Lightweight server-side WebRTC relay: client -> this server -> Livepeer (WebRTC)
// It creates two RTCPeerConnections (client and livepeer) and pipes tracks from the client to Livepeer.

const axios = require('axios');
const { RTCPeerConnection } = require('wrtc');
const { randomUUID } = require('crypto');

// Simple in-memory session store for trickle ICE support
const sessions = new Map();

// Default ICE servers; allow override via env TURN_URL, TURN_USER, TURN_PASS
function getIceServers() {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map(u => u.trim()),
      username: process.env.TURN_USER,
      credential: process.env.TURN_PASS,
    });
  }
  return iceServers;
}

function waitForIceGatheringComplete(pc, timeout = 5000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onStateChange);
    // Fallback timeout
    setTimeout(() => {
      try { pc.removeEventListener('icegatheringstatechange', onStateChange); } catch(e) {}
      resolve();
    }, timeout);
  });
}

async function createSession({ streamId, clientSdp, livepeerApiKey, timeout = 20000 }) {
  if (!streamId) throw new Error('streamId required');
  if (!clientSdp) throw new Error('clientSdp required');
  if (!livepeerApiKey) throw new Error('livepeerApiKey required');

  const sessionId = randomUUID();

  // Create PC facing the client (receives tracks from browser)
  const pcClient = new RTCPeerConnection({ iceServers: getIceServers() });

  // Create PC that will connect to Livepeer (will send tracks)
  const pcLivepeer = new RTCPeerConnection({ iceServers: getIceServers() });

  let firstTrackPromiseResolve;
  const firstTrackPromise = new Promise((resolve) => { firstTrackPromiseResolve = resolve; });

  // Logging helpers
  pcClient.oniceconnectionstatechange = () => console.log(`[bridge:${sessionId}] pcClient iceState=`, pcClient.iceConnectionState);
  pcClient.onicecandidate = (e) => console.log(`[bridge:${sessionId}] pcClient onicecandidate`, !!e?.candidate);
  pcLivepeer.oniceconnectionstatechange = () => console.log(`[bridge:${sessionId}] pcLivepeer iceState=`, pcLivepeer.iceConnectionState);
  pcLivepeer.onicecandidate = (e) => console.log(`[bridge:${sessionId}] pcLivepeer onicecandidate`, !!e?.candidate);

  // When client sends tracks, add them to livepeer PC
  pcClient.ontrack = (event) => {
    try {
      const track = event.track;
      pcLivepeer.addTrack(track);
      console.log(`[bridge:${sessionId}] client track added -> relaying to Livepeer, kind=`, track.kind);
      // notify that we've received at least one track
      firstTrackPromiseResolve();
    } catch (err) {
      console.error(`[bridge:${sessionId}] failed to add track to livepeer pc`, err);
    }
  };

  // Apply client's offer
  await pcClient.setRemoteDescription({ type: 'offer', sdp: clientSdp });

  // Create an answer for the client and wait for ICE gathering so caller gets usable SDP
  const answer = await pcClient.createAnswer();
  await pcClient.setLocalDescription(answer);
  await waitForIceGatheringComplete(pcClient, 10000);

  // We'll return this SDP to the client so it can setRemoteDescription and start sending
  const clientAnswerSdp = pcClient.localDescription?.sdp || answer.sdp;

  // Store session state
  const session = {
    sessionId,
    streamId,
    pcClient,
    pcLivepeer,
    livepeerApiKey,
    createdAt: Date.now(),
    closed: false,
  };

  // cleanup timer (in case client never completes)
  session.cleanupTimer = setTimeout(() => {
    if (!session.closed) {
      console.log(`[bridge:${sessionId}] session timeout, closing`);
      closeSession(sessionId);
    }
  }, timeout + 30000);

  sessions.set(sessionId, session);

  // Wait for first track (or short timeout) BEFORE attempting Livepeer negotiation so we can detect WebRTC availability
  try {
    await Promise.race([
      firstTrackPromise,
      new Promise((r) => setTimeout(r, 5000)),
    ]);

    if (session.closed) {
      closeSession(sessionId);
      return { webrtcUnavailable: true, rtmpIngestUrl: 'rtmp://rtmp.livepeer.com/live', streamKey: null };
    }

    // Create offer for Livepeer from pcLivepeer (tracks have been added in ontrack)
    const offer = await pcLivepeer.createOffer();
    await pcLivepeer.setLocalDescription(offer);
    await waitForIceGatheringComplete(pcLivepeer, 10000);

    // Send offer to Livepeer - try multiple endpoints to handle API variations / plan differences
    const endpoints = [
      `https://livepeer.studio/api/stream/${streamId}/webrtc`,
      `https://livepeer.studio/api/stream/${streamId}/webRTCIngest`,
      `https://livepeer.studio/api/stream/${streamId}/webrtcIngest`,
      `https://livepeer.studio/api/stream/${streamId}/ingest`,
      `https://livepeer.studio/api/stream/${streamId}/publish`
    ];

    let lpResp = null;
    let lpData = null;
    let usedUrl = null;

    for (const url of endpoints) {
      try {
        console.log(`[bridge:${sessionId}] trying Livepeer endpoint: ${url}`);
        lpResp = await axios.post(url, { sdp: pcLivepeer.localDescription.sdp }, {
          headers: { Authorization: `Bearer ${livepeerApiKey}`, 'Content-Type': 'application/json' },
          timeout: 25000,
        });
        lpData = lpResp.data;
        console.log(`[bridge:${sessionId}] Livepeer response from ${url}:`, lpResp.status, lpData ? (lpData.sdp ? 'has sdp' : Object.keys(lpData).length + ' keys') : 'no data');
        if (lpData && lpData.sdp) {
          usedUrl = url;
          break;
        }
      } catch (err) {
        // log and continue to next endpoint
        console.warn(`[bridge:${sessionId}] endpoint ${url} failed:`, err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message);
        lpResp = null;
        lpData = null;
        continue;
      }
    }

    if (!lpData || !lpData.sdp) {
      // Livepeer WebRTC not available — fetch stream info to provide RTMP fallback to client
      try {
        const sresp = await axios.get(`https://livepeer.studio/api/stream/${streamId}`, {
          headers: { Authorization: `Bearer ${livepeerApiKey}` },
          timeout: 10000,
        });
        const streamObj = sresp.data || {};
        const streamKey = streamObj.streamKey || null;
        const rtmpIngestUrl = streamObj.rtmpIngestUrl || 'rtmp://rtmp.livepeer.com/live';
        // Close session since we won't attempt WebRTC
        closeSession(sessionId);
        return { webrtcUnavailable: true, rtmpIngestUrl, streamKey };
      } catch (err) {
        // fallback defaults
        closeSession(sessionId);
        return { webrtcUnavailable: true, rtmpIngestUrl: 'rtmp://rtmp.livepeer.com/live', streamKey: null };
      }
    }

    // Apply Livepeer answer
    await pcLivepeer.setRemoteDescription({ type: 'answer', sdp: lpData.sdp });
    console.log(`[bridge:${sessionId}] Livepeer connection established via ${usedUrl}`);

    // If livepeer connection becomes connected, extend session lifetime briefly
    pcLivepeer.onconnectionstatechange = () => {
      if (pcLivepeer.connectionState === 'connected') {
        clearTimeout(session.cleanupTimer);
        session.cleanupTimer = setTimeout(() => closeSession(sessionId), 5 * 60 * 1000);
      }
    };

    return { sessionId, sdp: clientAnswerSdp };
  } catch (err) {
    console.error(`[bridge:${sessionId}] error while creating Livepeer offer:`, err?.message || err);
    try { closeSession(sessionId); } catch (e) {}
    return { webrtcUnavailable: true, rtmpIngestUrl: 'rtmp://rtmp.livepeer.com/live', streamKey: null };
  }
}

async function addCandidate(sessionId, candidate) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('session not found');
  if (!candidate) return;
  try {
    // candidate may be an object or string
    const c = (typeof candidate === 'string') ? JSON.parse(candidate) : candidate;
    await session.pcClient.addIceCandidate(c);
    console.log(`[bridge:${sessionId}] added client ICE candidate`);
  } catch (err) {
    console.error(`[bridge:${sessionId}] failed to add ICE candidate`, err?.message || err);
    throw err;
  }
}

function closeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    session.closed = true;
    clearTimeout(session.cleanupTimer);
    try { session.pcClient.close(); } catch (e) {}
    try { session.pcLivepeer.close(); } catch (e) {}
    sessions.delete(sessionId);
    console.log(`[bridge:${sessionId}] session closed and cleaned up`);
  } catch (err) {
    console.error(`[bridge:${sessionId}] error closing session`, err);
  }
}

module.exports = {
  createSession,
  addCandidate,
  closeSession,
};
