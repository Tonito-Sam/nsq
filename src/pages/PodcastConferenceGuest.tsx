import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createPodcastConferenceParticipantId,
  connectToPodcastConference,
  getPodcastConferenceIceServers,
  isPodcastConferenceSignal,
  sendPodcastConferenceSignal,
  type PodcastConferenceConnection,
} from '@/lib/podcastConference';

type GuestStatus = 'idle' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'ended';

const errorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export default function PodcastConferenceGuest() {
  const { roomToken = '' } = useParams<{ roomToken: string }>();
  const [guestName, setGuestName] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [status, setStatus] = useState<GuestStatus>('idle');
  const [error, setError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<PodcastConferenceConnection | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const guestIdRef = useRef('');
  const hostIdRef = useRef('');
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const requestIntervalRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const statusRef = useRef<GuestStatus>('idle');

  const updateStatus = (nextStatus: GuestStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  };

  const closeGuestSession = async (sendLeave: boolean) => {
    if (requestIntervalRef.current !== null) {
      window.clearInterval(requestIntervalRef.current);
      requestIntervalRef.current = null;
    }
    if (disconnectTimerRef.current !== null) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    const connection = connectionRef.current;
    if (sendLeave && connection && guestIdRef.current) {
      try {
        await sendPodcastConferenceSignal(connection, {
          type: 'guest-left',
          guestId: guestIdRef.current,
        });
      } catch (signalError) {
        setPlaybackError(errorMessage(signalError, 'Could not leave the conference cleanly.'));
      }
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (hostVideoRef.current) hostVideoRef.current.srcObject = null;
    queuedCandidatesRef.current = [];
    hostIdRef.current = '';
    connectionRef.current = null;
    connection?.close();
  };

  useEffect(() => () => {
    void closeGuestSession(false);
  }, []);

  const sendJoinRequest = async () => {
    const connection = connectionRef.current;
    if (!connection || !guestIdRef.current) return;
    await sendPodcastConferenceSignal(connection, {
      type: 'guest-request',
      guestId: guestIdRef.current,
      guestName: guestName.trim(),
    });
  };

  const connectToHost = async (signal: Extract<Parameters<typeof sendPodcastConferenceSignal>[1], { type: 'offer' }>) => {
    const connection = connectionRef.current;
    const localStream = localStreamRef.current;
    if (!connection || !localStream) throw new Error('Your camera and microphone are not ready yet.');
    if (peerConnectionRef.current) return;

    let iceServers: RTCIceServer[] = [];
    try {
      iceServers = await getPodcastConferenceIceServers();
      if (!iceServers.length) {
        setPlaybackError('No self-hosted TURN server is configured. Direct connections may fail on some networks.');
      }
    } catch (turnError) {
      setPlaybackError(`${errorMessage(turnError, 'Self-hosted TURN is unavailable.')} Trying a direct connection; some networks may block it.`);
    }

    hostIdRef.current = signal.from;
    const peerConnection = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = peerConnection;
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !connectionRef.current || !hostIdRef.current) return;
      void sendPodcastConferenceSignal(connectionRef.current, {
        type: 'ice-candidate',
        from: guestIdRef.current,
        to: hostIdRef.current,
        candidate: event.candidate.toJSON(),
      }).catch((signalError: unknown) => {
        setPlaybackError(errorMessage(signalError, 'Could not send a network connection update.'));
      });
    };
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      if (hostVideoRef.current) {
        hostVideoRef.current.srcObject = stream;
        void hostVideoRef.current.play().catch((playError: unknown) => {
          setPlaybackError(errorMessage(playError, 'Could not play the host video.'));
        });
      }
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        if (disconnectTimerRef.current !== null) {
          window.clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setPlaybackError('');
        updateStatus('connected');
      } else if (peerConnection.connectionState === 'disconnected' && disconnectTimerRef.current === null) {
        setPlaybackError('The direct connection is unstable. Trying to reconnect…');
        disconnectTimerRef.current = window.setTimeout(() => {
          disconnectTimerRef.current = null;
          if (peerConnectionRef.current !== peerConnection || peerConnection.connectionState !== 'disconnected') return;
          setPlaybackError('The direct connection to the host was lost. Ask the host to invite you again.');
          updateStatus('ended');
          void closeGuestSession(true);
        }, 8000);
      } else if (peerConnection.connectionState === 'failed') {
        setPlaybackError('The direct connection to the host was lost. Ask the host to invite you again.');
        updateStatus('ended');
        void closeGuestSession(true);
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    for (const candidate of queuedCandidatesRef.current) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    queuedCandidatesRef.current = [];
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    if (!peerConnection.localDescription) throw new Error('Could not prepare your answer for the host.');
    await sendPodcastConferenceSignal(connection, {
      type: 'answer',
      from: guestIdRef.current,
      to: signal.from,
      sdp: peerConnection.localDescription.toJSON(),
    });
    updateStatus('connecting');
  };

  const joinRoom = async () => {
    if (!roomToken || !consentGiven || !guestName.trim() || status === 'joining') return;
    setError('');
    setPlaybackError('');
    updateStatus('joining');
    let localStream: MediaStream | null = null;
    let connection: PodcastConferenceConnection | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support camera and microphone access.');
      }
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        await localVideoRef.current.play();
      }

      guestIdRef.current = createPodcastConferenceParticipantId();
      connection = await connectToPodcastConference({
        roomToken,
        role: 'guest',
        participantId: guestIdRef.current,
        onSignal: (signal) => {
          if (!isPodcastConferenceSignal(signal)) return;
          void (async () => {
          try {
            if (signal.type === 'guest-admitted' && signal.guestId === guestIdRef.current) {
              updateStatus('connecting');
            } else if (signal.type === 'guest-declined' && signal.guestId === guestIdRef.current) {
              setPlaybackError(signal.reason);
              updateStatus('ended');
              void closeGuestSession(false);
            } else if (signal.type === 'guest-removed' && signal.guestId === guestIdRef.current) {
              setPlaybackError(signal.reason);
              updateStatus('ended');
              void closeGuestSession(false);
            } else if (signal.type === 'offer' && signal.to === guestIdRef.current) {
              await connectToHost(signal);
            } else if (signal.type === 'ice-candidate' && signal.to === guestIdRef.current) {
              const candidate = new RTCIceCandidate(signal.candidate);
              if (peerConnectionRef.current?.remoteDescription) {
                await peerConnectionRef.current.addIceCandidate(candidate);
              } else {
                queuedCandidatesRef.current.push(signal.candidate);
              }
            } else if (signal.type === 'host-ended') {
              setPlaybackError('The host has ended the conference.');
              updateStatus('ended');
              void closeGuestSession(false);
            }
          } catch (signalError) {
            setPlaybackError(errorMessage(signalError, 'Could not establish the conference connection.'));
            updateStatus('ended');
            void closeGuestSession(true);
          }
          })();
        },
        onClose: () => {
          if (statusRef.current !== 'ended' && statusRef.current !== 'idle') {
            setPlaybackError('The NexSq signaling connection closed.');
            updateStatus('ended');
            void closeGuestSession(false);
          }
        },
      });
      connectionRef.current = connection;
      await sendJoinRequest();
      updateStatus('waiting');
      requestIntervalRef.current = window.setInterval(() => {
        if (statusRef.current !== 'waiting') return;
        void sendJoinRequest().catch((signalError: unknown) => {
          setPlaybackError(errorMessage(signalError, 'Could not reach the host.'));
        });
      }, 5000);
    } catch (joinError) {
      localStream?.getTracks().forEach((track) => track.stop());
      connection?.close();
      localStreamRef.current = null;
      connectionRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setError(errorMessage(joinError, 'Could not join this conference.'));
      updateStatus('idle');
    }
  };

  const leaveRoom = () => {
    updateStatus('ended');
    void closeGuestSession(true);
  };

  return (
    <main className="min-h-screen bg-[#080b0a] p-4 text-white sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">NexSq · Conference guest</p>
          <h1 className="text-2xl font-bold">Join the Podcast recording</h1>
          <p className="text-sm text-white/60">The host controls the show and teleprompter. Your audio and video are included in the live recording only after the host admits you.</p>
        </header>

        {status === 'idle' || status === 'joining' || status === 'ended' ? (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            {status === 'ended' && playbackError && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{playbackError}</p>}
            <label className="block space-y-2 text-sm font-medium">
              Your name
              <Input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={60} placeholder="Name shown to the host" className="border-white/15 bg-black/30 text-white" />
            </label>
            <label className="flex items-start gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(event) => setConsentGiven(event.target.checked)}
                className="mt-1 accent-emerald-400"
              />
              <span>I understand the host is recording this session and may publish the recording.</span>
            </label>
            <Button onClick={() => void joinRoom()} disabled={!guestName.trim() || !consentGiven || status === 'joining'} className="w-full bg-emerald-500 text-black hover:bg-emerald-400">
              {status === 'joining' ? 'Connecting…' : status === 'ended' ? 'Join again' : 'Request to join'}
            </Button>
          </section>
        ) : (
          <section className="space-y-4">
            <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-100">
              {status === 'waiting' ? 'Waiting for the host to admit you…' : status === 'connecting' ? 'The host admitted you. Connecting directly…' : 'You are connected to the recording.'}
            </p>
            {playbackError && <p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{playbackError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-white/65"><Video className="h-3.5 w-3.5" /><Mic className="h-3.5 w-3.5" />You · {guestName}</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <video ref={hostVideoRef} autoPlay playsInline className="aspect-video w-full object-cover" />
                <p className="px-3 py-2 text-xs text-white/65">Host video</p>
              </div>
            </div>
            <Button variant="outline" onClick={leaveRoom} className="border-white/20 text-white hover:bg-white/10">
              {status === 'waiting' ? 'Cancel request' : 'Leave recording'}
            </Button>
          </section>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <p className="text-xs text-white/40">Audio and video use native WebRTC. Without NexSq’s self-hosted TURN server, some routers or firewalls may block the connection.</p>
      </div>
    </main>
  );
}
