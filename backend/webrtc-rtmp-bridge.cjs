// webrtc-rtmp-bridge.cjs
// Lightweight server-side WebRTC relay: client -> this server -> Livepeer (WebRTC)
// It creates two RTCPeerConnections (client and livepeer) and pipes tracks from the client to Livepeer.

const axios = require('axios');
const { RTCPeerConnection } = require('wrtc');

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

async function handleSession({ streamId, clientSdp, livepeerApiKey, timeout = 20000 }) {
  if (!streamId) throw new Error('streamId required');
  if (!clientSdp) throw new Error('clientSdp required');
  if (!livepeerApiKey) throw new Error('livepeerApiKey required');

  // Create PC facing the client (receives tracks from browser)
  const pcClient = new RTCPeerConnection();

  // Create PC that will connect to Livepeer (will send tracks)
  const pcLivepeer = new RTCPeerConnection();

  let firstTrackPromiseResolve;
  const firstTrackPromise = new Promise((resolve) => { firstTrackPromiseResolve = resolve; });

  // When client sends tracks, add them to livepeer PC
  pcClient.ontrack = (event) => {
    try {
      const track = event.track;
      pcLivepeer.addTrack(track);
      console.log('[bridge] client track added -> relaying to Livepeer, kind=', track.kind);
      // notify that we've received at least one track
      firstTrackPromiseResolve();
    } catch (err) {
      console.error('[bridge] failed to add track to livepeer pc', err);
    }
  };

  // Apply client's offer
  await pcClient.setRemoteDescription({ type: 'offer', sdp: clientSdp });

  // Create an answer for the client and wait for ICE gathering so caller gets usable SDP
  const answer = await pcClient.createAnswer();
  await pcClient.setLocalDescription(answer);
  await waitForIceGatheringComplete(pcClient, 5000);

  // We'll return this SDP to the client so it can setRemoteDescription and start sending
  const clientAnswerSdp = pcClient.localDescription?.sdp || answer.sdp;

  // After we get tracks from client, create offer to Livepeer and finish the chain
  (async () => {
    try {
      // Wait for at least one track (or timeout)
      await Promise.race([
        firstTrackPromise,
        new Promise((r) => setTimeout(r, 3000)),
      ]);

      // Create offer for Livepeer from pcLivepeer (tracks have been added in ontrack)
      const offer = await pcLivepeer.createOffer();
      await pcLivepeer.setLocalDescription(offer);
      await waitForIceGatheringComplete(pcLivepeer, 5000);

      // Send offer to Livepeer
      const url = `https://livepeer.studio/api/stream/${streamId}/webrtc`;
      const lpResp = await axios.post(url, { sdp: pcLivepeer.localDescription.sdp }, {
        headers: { Authorization: `Bearer ${livepeerApiKey}`, 'Content-Type': 'application/json' }
      });

      const lpData = lpResp.data;
      if (!lpData || !lpData.sdp) {
        throw new Error('Invalid Livepeer response: ' + JSON.stringify(lpData));
      }

      // Apply Livepeer answer
      await pcLivepeer.setRemoteDescription({ type: 'answer', sdp: lpData.sdp });
      console.log('[bridge] Livepeer connection established');
    } catch (err) {
      console.error('[bridge] error while creating Livepeer offer:', err?.message || err);
    }
  })();

  // Return the client's answer SDP immediately (so browser can begin sending)
  return { sdp: clientAnswerSdp };
}

module.exports = {
  handleSession,
};
