// src/services/webrtcBridge.ts
const BASE = '/api/webrtc-bridge'; // adjust if your backend is on a different origin
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add more STUNs if desired
];

async function fetchTurnCreds() {
  try {
    const resp = await fetch('/api/turn/creds');
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || !data.url) return null;
    return data;
  } catch (err) {
    console.warn('Failed to fetch TURN creds', err);
    return null;
  }
}

export async function startPublish(streamId: string, localStream: MediaStream) {
  // Try to fetch TURN credentials from server; fall back to default STUN-only
  const turn = await fetchTurnCreds();
  const iceServers = [...DEFAULT_ICE_SERVERS];
  if (turn && turn.url) {
    // cast to any to satisfy TypeScript RTCIceServer shape in this project
    iceServers.push({ urls: turn.url, username: turn.username, credential: turn.password } as any);
  }

  const pc = new RTCPeerConnection({ iceServers });

  // add local tracks
  for (const t of localStream.getTracks()) pc.addTrack(t, localStream);

  let sessionId: string | null = null;
  const pendingCandidates: any[] = [];

  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    if (!sessionId) { pendingCandidates.push(e.candidate); return; }
    try {
      await fetch(`${BASE}/${sessionId}/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: e.candidate }),
      });
    } catch (err) { console.warn('Failed to send candidate', err); }
  };

  pc.onconnectionstatechange = () => {
    console.log('publish pc connectionState=', pc.connectionState);
  };

  // create offer and send to server to create session
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const resp = await fetch(`${BASE}/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streamId, sdp: pc.localDescription?.sdp }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    // Try parse JSON
    try {
      const j = JSON.parse(txt);
      if (j && j.error === 'webrtc_unavailable') {
        const err: any = new Error('webrtc_unavailable');
        err.code = 'webrtc_unavailable';
        err.rtmpIngestUrl = j.rtmpIngestUrl;
        err.streamKey = j.streamKey;
        throw err;
      }
    } catch (e) {
      // not JSON
    }
    throw new Error('create-session failed: ' + txt);
  }
  const data = await resp.json();
  sessionId = data.sessionId;
  const answerSdp = data.sdp;

  // flush buffered candidates
  for (const c of pendingCandidates) {
    try {
      await fetch(`${BASE}/${sessionId}/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: c }),
      });
    } catch (err) { console.warn('Failed to flush candidate', err); }
  }

  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  return { pc, sessionId };
}

export async function stopPublish(pc?: RTCPeerConnection | null, sessionId?: string | null) {
  try { pc?.getSenders().forEach(s => s.track?.stop()); } catch (e) { /* ignore */ }
  try { pc?.close(); } catch (e) { /* ignore */ }
  if (sessionId) {
    try { await fetch(`${BASE}/${sessionId}/close`, { method: 'POST' }); } catch (e) { console.warn(e); }
  }
}

export default { startPublish, stopPublish };
