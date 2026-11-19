import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Maximize, Mic, Pause, Play, RotateCcw, Save, Square, UserPlus, UserX, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaEnhancementTabs } from '@/components/studio/MediaEnhancementTabs';
import { useReelAudioPreview } from '@/hooks/useReelAudioPreview';
import { supabase } from '@/integrations/supabase/client';
import {
  createPodcastConferenceParticipantId,
  createPodcastConferenceRoomToken,
  connectToPodcastConference,
  getPodcastConferenceIceServers,
  isPodcastConferenceSignal,
  sendPodcastConferenceSignal,
  type PodcastConferenceConnection,
  type PodcastConferenceSignal,
} from '@/lib/podcastConference';
import { getPodcastStudioEligibility } from '@/lib/podcastStudioEligibility';
import {
  getReelVideoFilter,
  renderCaptionedReel,
  type ReelAudioPreset,
  type ReelVideoPreset,
} from '@/utils/animatedReelCaptions';
import {
  drawPodcastBroadcastOverlays,
  drawPodcastIntroFrame,
  drawPodcastNextEpisodeSlot,
  drawPodcastOutroFrame,
  PODCAST_INTRO_DURATION_MS,
  PODCAST_OUTRO_DURATION_MS,
  shouldStartPodcastOutro,
  shouldShowPodcastLowerThird,
  type PodcastBroadcastSlot,
} from '@/utils/podcastIntroMontage';

type DraftPayload = {
  title: string;
  showName?: string;
  topic?: string;
  script: string;
  duration?: number;
  hostNames?: string;
  nextEpisodeSlot?: PodcastBroadcastSlot | null;
  createdAt?: number;
  mode?: 'admin' | 'creator';
  ownerId?: string;
  draftId?: string;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  introVideoUrl?: string | null;
  outroVideoUrl?: string | null;
};
type ScriptSection = { heading: string; body: string };
type RecordingState = 'idle' | 'recording' | 'paused' | 'recorded';
type PodcastGuest = { guestId: string; guestName: string };
type PodcastGuestFeed = PodcastGuest & {
  video: HTMLVideoElement;
  audioSources: Map<string, MediaStreamAudioSourceNode>;
};

const handoffKey = (sessionId: string) => `podcast-recording:${sessionId}`;
const HANDOFF_TTL_MS = 12 * 60 * 60 * 1000;
const introPreviewBackgrounds = [
  'linear-gradient(135deg, #062116, #07110f 58%, #030605)',
  'linear-gradient(135deg, #08212a, #080f18 58%, #030605)',
  'linear-gradient(135deg, #25180a, #100e0b 58%, #030605)',
];

function parseSections(script: string, title: string): ScriptSection[] {
  const sections: ScriptSection[] = [];
  let heading = '';
  let lines: string[] = [];

  script.split(/\r?\n/).forEach((line) => {
    const text = line.trim();
    const normalizedHeading = /^(OPENING|INTRO)$/i.test(text)
      ? 'INTRO'
      : /^(CLOSING|OUTRO)$/i.test(text)
        ? 'OUTRO'
        : /^(SEGMENT \d+:.*|STUDIO DISCUSSION)$/i.test(text)
          ? text
          : '';
    if (normalizedHeading) {
      if (heading) sections.push({ heading, body: lines.join('\n').trim() });
      heading = normalizedHeading;
      lines = [];
    } else if (heading) {
      lines.push(line);
    }
  });

  if (heading) sections.push({ heading, body: lines.join('\n').trim() });
  const intro = sections.find((section) => section.heading === 'INTRO');
  const outro = sections.find((section) => section.heading === 'OUTRO');
  const middle = sections.filter((section) => section.heading !== 'INTRO' && section.heading !== 'OUTRO');
  if (!middle.length && !intro && !outro && script.trim()) {
    middle.push({ heading: 'RUNDOWN', body: script.trim() });
  }

  return [
    intro || { heading: 'INTRO', body: `Welcome to ${title}.` },
    ...middle,
    outro || { heading: 'OUTRO', body: `Thanks for listening to ${title}.` },
  ];
}

function getHostNames(draft: DraftPayload) {
  const savedHostNames = draft.hostNames?.trim();
  if (savedHostNames) return savedHostNames;

  const firstSpeaker = draft.script.match(/^\s*(?:with\s+)?([^:\r\n]{1,80}):/im)?.[1]?.trim();
  return firstSpeaker || 'Your host';
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const loadBrandImage = (source?: string | null) => new Promise<HTMLImageElement | null>((resolve, reject) => {
  if (!source) {
    resolve(null);
    return;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not load a podcast branding image.'));
  image.src = source;
});

const drawVideoCover = (context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) => {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

const drawPodcastConferenceLayout = (
  context: CanvasRenderingContext2D,
  hostVideo: HTMLVideoElement,
  guests: Array<{ name: string; video: HTMLVideoElement | null }>,
  width: number,
  height: number,
  introTitle: string,
  introHostNames: string,
  introVisible: boolean,
) => {
  const participants = [{ name: 'Host', video: hostVideo }, ...guests];
  const tileWidth = width / participants.length;
  context.fillStyle = '#080b0a';
  context.fillRect(0, 0, width, height);
  participants.forEach((participant, index) => {
    const x = index * tileWidth;
    const video = participant.video;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
      const scale = Math.max(tileWidth / video.videoWidth, height / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      context.save();
      context.beginPath();
      context.rect(x, 0, tileWidth, height);
      context.clip();
      context.drawImage(video, x + (tileWidth - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    }

    const labelHeight = height * 0.1;
    const gradient = context.createLinearGradient(0, height - labelHeight, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    context.fillStyle = gradient;
    context.fillRect(x, height - labelHeight, tileWidth, labelHeight);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.font = `600 ${Math.max(14, height * 0.035)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(participant.name.slice(0, 32), x + tileWidth / 2, height - labelHeight / 2);
    if (index > 0) {
      context.fillStyle = 'rgba(255, 255, 255, 0.75)';
      context.fillRect(x, 0, Math.max(2, width * 0.002), height);
    }
  });
  if (introVisible) {
    const panelWidth = width * 0.54;
    const panelX = (width - panelWidth) / 2;
    const panelY = height * 0.19;
    const panelHeight = height * 0.23;
    context.fillStyle = 'rgba(2, 8, 8, 0.68)';
    context.fillRect(panelX, panelY, panelWidth, panelHeight);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#72f0bc';
    context.font = `700 ${Math.max(12, height * 0.022)}px "Segoe UI", Arial, sans-serif`;
    context.fillText('NEXSQ PODCAST · LIVE', width / 2, panelY + panelHeight * 0.24);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(19, height * 0.04)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(introTitle.slice(0, 60), width / 2, panelY + panelHeight * 0.55);
    context.fillStyle = 'rgba(255, 255, 255, 0.78)';
    context.font = `500 ${Math.max(12, height * 0.022)}px "Segoe UI", Arial, sans-serif`;
    context.fillText(`Hosted by ${introHostNames.slice(0, 60)}`, width / 2, panelY + panelHeight * 0.82);
  }
};

export default function PodcastTeleprompter() {
  const { sessionId = '' } = useParams();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(18);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [audioPreset, setAudioPreset] = useState<ReelAudioPreset>('original');
  const [videoPreset, setVideoPreset] = useState<ReelVideoPreset>('original');
  const [effectsRendered, setEffectsRendered] = useState(false);
  const [isRenderingEffects, setIsRenderingEffects] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [introMontageActive, setIntroMontageActive] = useState(false);
  const [introScene, setIntroScene] = useState(0);
  const [outroActive, setOutroActive] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [error, setError] = useState('');
  const [conferenceLink, setConferenceLink] = useState('');
  const [pendingGuests, setPendingGuests] = useState<PodcastGuest[]>([]);
  const [activeGuests, setActiveGuests] = useState<PodcastGuest[]>([]);
  const [conferenceError, setConferenceError] = useState('');
  const [conferenceLinkCopied, setConferenceLinkCopied] = useState(false);
  const prompterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const { applyPreset: applyPreviewAudioPreset } = useReelAudioPreview(previewRef, setError);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);
  const originalRecordingBlobRef = useRef<Blob | null>(null);
  const recordingStateRef = useRef<RecordingState>('idle');
  const introElapsedMsRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const compositeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const conferenceConnectionRef = useRef<PodcastConferenceConnection | null>(null);
  const hostParticipantIdRef = useRef('');
  const pendingGuestsRef = useRef<PodcastGuest[]>([]);
  const activeGuestsRef = useRef<PodcastGuest[]>([]);
  const guestConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const guestFeedsRef = useRef(new Map<string, PodcastGuestFeed>());
  const queuedGuestCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const introClipRef = useRef<HTMLVideoElement | null>(null);
  const outroClipRef = useRef<HTMLVideoElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const mediaRequestIdRef = useRef(0);
  const outroActiveRef = useRef(false);
  const outroStartedAtRef = useRef(0);
  const outroTimerRef = useRef<number | null>(null);

  const sections = draft ? parseSections(draft.script, draft.title) : [];
  const sectionCount = sections.length;
  const activeSectionBody = sections[activeSection]?.body || '';
  const introHostNames = draft ? getHostNames(draft) : 'Your host';
  const liveOverlaysVisible = !recordingUrl
    && (recordingState === 'recording' || recordingState === 'paused');
  const liveLowerThirdVisible = liveOverlaysVisible
    && shouldShowPodcastLowerThird(recordingSeconds * 1000);
  const showArtworkUrl = draft?.coverImageUrl || draft?.logoImageUrl;

  const updatePendingGuests = (guests: PodcastGuest[]) => {
    pendingGuestsRef.current = guests;
    setPendingGuests(guests);
  };

  const updateActiveGuests = (guests: PodcastGuest[]) => {
    activeGuestsRef.current = guests;
    setActiveGuests(guests);
  };

  const removeGuestConnection = (guestId: string) => {
    guestConnectionsRef.current.get(guestId)?.close();
    guestConnectionsRef.current.delete(guestId);
    queuedGuestCandidatesRef.current.delete(guestId);
    const feed = guestFeedsRef.current.get(guestId);
    if (feed) {
      feed.video.pause();
      feed.video.srcObject = null;
      feed.audioSources.forEach((source) => source.disconnect());
      guestFeedsRef.current.delete(guestId);
    }
    updateActiveGuests(activeGuestsRef.current.filter((guest) => guest.guestId !== guestId));
    updatePendingGuests(pendingGuestsRef.current.filter((guest) => guest.guestId !== guestId));
  };

  const closeConference = async (notifyGuests: boolean, updateUi = true) => {
    const connection = conferenceConnectionRef.current;
    conferenceConnectionRef.current = null;
    let notificationError: unknown;
    if (notifyGuests && connection) {
      try {
        await sendPodcastConferenceSignal(connection, { type: 'host-ended' });
      } catch (signalError) {
        notificationError = signalError;
      }
    }
    guestConnectionsRef.current.forEach((connection) => connection.close());
    guestConnectionsRef.current.clear();
    guestFeedsRef.current.forEach((feed) => {
      feed.video.pause();
      feed.video.srcObject = null;
      feed.audioSources.forEach((source) => source.disconnect());
    });
    guestFeedsRef.current.clear();
    queuedGuestCandidatesRef.current.clear();
    pendingGuestsRef.current = [];
    activeGuestsRef.current = [];
    hostParticipantIdRef.current = '';
    connection?.close();
    if (updateUi) {
      setPendingGuests([]);
      setActiveGuests([]);
      setConferenceLink('');
      setConferenceLinkCopied(false);
    }
    if (notificationError) throw notificationError;
  };

  const handleConferenceSignal = async (signal: PodcastConferenceSignal) => {
    if (signal.type === 'guest-request') {
      if (
        pendingGuestsRef.current.some((guest) => guest.guestId === signal.guestId)
        || activeGuestsRef.current.some((guest) => guest.guestId === signal.guestId)
      ) return;
      if (pendingGuestsRef.current.length + activeGuestsRef.current.length >= 2) {
        const connection = conferenceConnectionRef.current;
        if (connection) {
          await sendPodcastConferenceSignal(connection, {
            type: 'guest-declined',
            guestId: signal.guestId,
            reason: 'The recording already has the maximum number of guests.',
          });
        }
        return;
      }
      updatePendingGuests([...pendingGuestsRef.current, {
        guestId: signal.guestId,
        guestName: signal.guestName.slice(0, 60),
      }]);
      return;
    }

    if (signal.type === 'answer' && signal.to === hostParticipantIdRef.current) {
      const peerConnection = guestConnectionsRef.current.get(signal.from);
      if (!peerConnection || peerConnection.remoteDescription) return;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const queuedCandidates = queuedGuestCandidatesRef.current.get(signal.from) || [];
      for (const candidate of queuedCandidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      queuedGuestCandidatesRef.current.delete(signal.from);
      return;
    }

    if (signal.type === 'ice-candidate' && signal.to === hostParticipantIdRef.current) {
      const peerConnection = guestConnectionsRef.current.get(signal.from);
      if (!peerConnection) return;
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else {
        const queuedCandidates = queuedGuestCandidatesRef.current.get(signal.from) || [];
        queuedCandidates.push(signal.candidate);
        queuedGuestCandidatesRef.current.set(signal.from, queuedCandidates);
      }
      return;
    }

    if (signal.type === 'guest-left') removeGuestConnection(signal.guestId);
  };

  const admitGuest = async (guest: PodcastGuest) => {
    const connection = conferenceConnectionRef.current;
    const cameraStream = streamRef.current;
    if (!connection || !cameraStream || recordingStateRef.current !== 'recording') {
      setConferenceError('Guests can be admitted only while the host is recording.');
      return;
    }
    if (!pendingGuestsRef.current.some((request) => request.guestId === guest.guestId)) return;
    if (activeGuestsRef.current.length >= 2) {
      setConferenceError('A recording can include up to two guests.');
      return;
    }

    updatePendingGuests(pendingGuestsRef.current.filter((request) => request.guestId !== guest.guestId));
    updateActiveGuests([...activeGuestsRef.current, guest]);
    setConferenceError('');
    let peerConnection: RTCPeerConnection | null = null;
    try {
      let iceServers: RTCIceServer[] = [];
      try {
        iceServers = await getPodcastConferenceIceServers();
        if (!iceServers.length) {
          setConferenceError('No self-hosted TURN server is configured. Direct connections may fail on some networks.');
        }
      } catch (turnError) {
        setConferenceError(
          `${turnError instanceof Error ? turnError.message : 'Self-hosted TURN is unavailable.'} Trying a direct connection; some networks may block it.`,
        );
      }

      const peer = new RTCPeerConnection({ iceServers });
      peerConnection = peer;
      guestConnectionsRef.current.set(guest.guestId, peer);
      peer.onicecandidate = (event) => {
        if (!event.candidate || !conferenceConnectionRef.current) return;
        void sendPodcastConferenceSignal(conferenceConnectionRef.current, {
          type: 'ice-candidate',
          from: hostParticipantIdRef.current,
          to: guest.guestId,
          candidate: event.candidate.toJSON(),
        }).catch((signalError: unknown) => {
          setConferenceError(signalError instanceof Error ? signalError.message : 'Could not send a network connection update.');
        });
      };
      peer.ontrack = (event) => {
        let feed = guestFeedsRef.current.get(guest.guestId);
        if (!feed) {
          const video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          feed = { ...guest, video, audioSources: new Map() };
          guestFeedsRef.current.set(guest.guestId, feed);
        }
        const remoteStream = event.streams[0];
        if (remoteStream) {
          feed.video.srcObject = remoteStream;
        } else if (feed.video.srcObject instanceof MediaStream) {
          const stream = feed.video.srcObject as MediaStream;
          if (!stream.getTracks().some((track) => track.id === event.track.id)) stream.addTrack(event.track);
        } else {
          feed.video.srcObject = new MediaStream([event.track]);
        }
        if (event.track.kind === 'audio' && !feed.audioSources.has(event.track.id)) {
          const audioContext = audioContextRef.current;
          const audioDestination = audioDestinationRef.current;
          if (audioContext && audioDestination) {
            const source = audioContext.createMediaStreamSource(new MediaStream([event.track]));
            source.connect(audioDestination);
            feed.audioSources.set(event.track.id, source);
          } else {
            setConferenceError('Guest audio could not be mixed into the recording.');
          }
        }
        void feed.video.play().catch((playError: unknown) => {
          setConferenceError(playError instanceof Error ? playError.message : 'Could not display a guest video.');
        });
        updateActiveGuests([...activeGuestsRef.current]);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setConferenceError('');
        } else if (peer.connectionState === 'failed') {
          setConferenceError(`The connection to ${guest.guestName} failed. Ask them to reconnect.`);
          removeGuestConnection(guest.guestId);
        }
      };

      cameraStream.getTracks().forEach((track) => peer.addTrack(track, cameraStream));
      await sendPodcastConferenceSignal(connection, {
        type: 'guest-admitted',
        guestId: guest.guestId,
        guestName: guest.guestName,
      });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!peer.localDescription) throw new Error('Could not prepare the host video for this guest.');
      await sendPodcastConferenceSignal(connection, {
        type: 'offer',
        from: hostParticipantIdRef.current,
        to: guest.guestId,
        sdp: peer.localDescription.toJSON(),
      });
    } catch (admissionError) {
      if (!peerConnection) {
        updatePendingGuests([...pendingGuestsRef.current, guest]);
        updateActiveGuests(activeGuestsRef.current.filter((activeGuest) => activeGuest.guestId !== guest.guestId));
      }
      removeGuestConnection(guest.guestId);
      setConferenceError(admissionError instanceof Error ? admissionError.message : 'Could not admit this guest.');
    }
  };

  const rejectGuest = async (guest: PodcastGuest) => {
    const connection = conferenceConnectionRef.current;
    if (!connection) return;
    try {
      await sendPodcastConferenceSignal(connection, {
        type: 'guest-declined',
        guestId: guest.guestId,
        reason: 'The host declined your request to join this recording.',
      });
      updatePendingGuests(pendingGuestsRef.current.filter((request) => request.guestId !== guest.guestId));
    } catch (rejectError) {
      setConferenceError(rejectError instanceof Error ? rejectError.message : 'Could not decline this guest request.');
    }
  };

  const removeGuest = async (guest: PodcastGuest) => {
    const connection = conferenceConnectionRef.current;
    if (!connection) return;
    try {
      await sendPodcastConferenceSignal(connection, {
        type: 'guest-removed',
        guestId: guest.guestId,
        reason: 'The host removed you from the recording.',
      });
      removeGuestConnection(guest.guestId);
    } catch (removeError) {
      setConferenceError(removeError instanceof Error ? removeError.message : 'Could not remove this guest.');
    }
  };

  const copyConferenceLink = async () => {
    if (!conferenceLink) return;
    try {
      await navigator.clipboard.writeText(conferenceLink);
      setConferenceLinkCopied(true);
      setConferenceError('');
    } catch (copyError) {
      setConferenceError(copyError instanceof Error ? copyError.message : 'Could not copy the invite link.');
    }
  };

  const refreshMediaDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error('This browser cannot list connected cameras and microphones.');
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameraDevices(devices.filter((device) => device.kind === 'videoinput'));
    setMicrophoneDevices(devices.filter((device) => device.kind === 'audioinput'));
  }, []);

  const openMediaDevices = useCallback(async (cameraId: string, microphoneId: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera and microphone access is not supported in this browser.');
    }

    const requestId = ++mediaRequestIdRef.current;
    setIsLoadingDevices(true);
    try {
      const video: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 16 / 9 },
        ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
      };
      const audio: MediaTrackConstraints | boolean = microphoneId
        ? { deviceId: { exact: microphoneId } }
        : true;
      const nextStream = await navigator.mediaDevices.getUserMedia({ video, audio });
      if (requestId !== mediaRequestIdRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error('The device selection changed while the camera was opening. Please try again.');
      }

      const videoTrack = nextStream.getVideoTracks()[0];
      const audioTrack = nextStream.getAudioTracks()[0];
      if (!videoTrack || !audioTrack) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error('A camera and microphone are both required to record a podcast.');
      }

      const previousStream = streamRef.current;
      const preview = previewRef.current;
      if (preview) {
        preview.pause();
        preview.removeAttribute('src');
        preview.srcObject = nextStream;
        preview.controls = false;
        preview.muted = true;
        try {
          await preview.play();
        } catch (playError) {
          preview.srcObject = previousStream;
          if (previousStream) await preview.play().catch(() => undefined);
          nextStream.getTracks().forEach((track) => track.stop());
          throw playError;
        }
      }

      streamRef.current = nextStream;
      previousStream?.getTracks().forEach((track) => track.stop());
      setSelectedCameraId(videoTrack.getSettings().deviceId || cameraId);
      setSelectedMicrophoneId(audioTrack.getSettings().deviceId || microphoneId);
      setCameraReady(true);
      await refreshMediaDevices();
      return nextStream;
    } finally {
      if (requestId === mediaRequestIdRef.current) setIsLoadingDevices(false);
    }
  }, [refreshMediaDevices]);

  useEffect(() => {
    if (!authorized) return;
    void openMediaDevices('', '').catch((mediaError: unknown) => {
      setCameraReady(false);
      setError(mediaError instanceof Error ? mediaError.message : 'Could not open the camera and microphone.');
    });
  }, [authorized, openMediaDevices]);

  useEffect(() => {
    if (!authorized || !navigator.mediaDevices?.addEventListener) return;
    const refresh = () => {
      void refreshMediaDevices().catch((deviceError: unknown) => {
        setError(deviceError instanceof Error ? deviceError.message : 'Could not refresh connected recording devices.');
      });
    };
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, [authorized, refreshMediaDevices]);

  useEffect(() => {
    let active = true;
    const verifyAccess = async () => {
      try {
        if (!sessionId) throw new Error('This recording session is missing. Return to the newsroom and reopen the teleprompter.');
        const storedDraft = localStorage.getItem(handoffKey(sessionId));
        if (!storedDraft) throw new Error('This recording session has expired. Return to the newsroom and reopen the teleprompter.');
        const parsedDraft = JSON.parse(storedDraft) as DraftPayload;
        const createdAt = Number(parsedDraft.createdAt);
        if (!Number.isFinite(createdAt) || Date.now() - createdAt > HANDOFF_TTL_MS) {
          localStorage.removeItem(handoffKey(sessionId));
          throw new Error('This recording session has expired. Return to the newsroom and reopen the teleprompter.');
        }
        setDraft(parsedDraft);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Sign in to open the podcast recording desk.');

        if (parsedDraft.mode === 'creator') {
          if (parsedDraft.ownerId !== user.id || !parsedDraft.draftId) {
            throw new Error('This private creator recording session belongs to another account.');
          }
          const [eligibility, draftResult] = await Promise.all([
            getPodcastStudioEligibility(user.id),
            supabase.from('creator_podcast_drafts')
              .select('id, status')
              .eq('id', parsedDraft.draftId)
              .eq('owner_id', user.id)
              .maybeSingle(),
          ]);
          if (draftResult.error) throw draftResult.error;
          if (!eligibility.eligible || !draftResult.data || !['draft', 'changes_requested'].includes(draftResult.data.status)) {
            throw new Error('This creator podcast draft is no longer available for recording.');
          }
        } else {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('privilege')
            .eq('id', user.id)
            .maybeSingle();
          if (profileError) throw profileError;
          if (!['admin', 'superadmin'].includes(profile?.privilege || '')) {
            throw new Error('The newsroom recording desk is available to Studio administrators only.');
          }
        }

        if (active) setAuthorized(true);
      } catch (accessError) {
        if (active) setError(accessError instanceof Error ? accessError.message : 'Could not verify access to the recording desk.');
      } finally {
        if (active) setCheckingAccess(false);
      }
    };

    void verifyAccess();

    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    if (recordingUrl) {
      video.srcObject = null;
      video.src = recordingUrl;
      video.controls = true;
      video.muted = false;
      video.load();
      void video.play().catch(() => undefined);
    } else if (streamRef.current) {
      video.src = '';
      video.srcObject = streamRef.current;
      video.controls = false;
      video.muted = true;
      void video.play().catch(() => undefined);
    }
  }, [authorized, recordingUrl]);

  useEffect(() => {
    if (recordingUrl) {
      applyPreviewAudioPreset(effectsRendered ? 'original' : audioPreset);
    }
  }, [audioPreset, effectsRendered, recordingUrl, applyPreviewAudioPreset]);

  useEffect(() => {
    if (recordingState !== 'recording') return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recordingState]);

  const startOutro = useCallback(() => {
    if (outroActiveRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (recorder.state === 'paused') {
      recorder.resume();
      recordingStateRef.current = 'recording';
      setRecordingState('recording');
    }

    setScrolling(false);
    outroActiveRef.current = true;
    outroStartedAtRef.current = performance.now();
    setOutroActive(true);
    const outroClip = outroClipRef.current;
    if (outroClip) {
      outroClip.currentTime = 0;
      void outroClip.play().catch((playError) => {
        setError(playError instanceof Error ? `Could not play the custom outro: ${playError.message}` : 'Could not play the custom outro.');
      });
    }
    if (outroTimerRef.current !== null) window.clearTimeout(outroTimerRef.current);
    outroTimerRef.current = window.setTimeout(() => {
      outroActiveRef.current = false;
      setOutroActive(false);
      if (recorder.state !== 'inactive') recorder.stop();
    }, PODCAST_OUTRO_DURATION_MS);
  }, []);

  useEffect(() => {
    if (recordingState !== 'recording' || !draft?.duration || draft.duration <= 0) return;
    if (shouldStartPodcastOutro(recordingSeconds, draft.duration)) startOutro();
  }, [draft?.duration, recordingSeconds, recordingState, startOutro]);

  useEffect(() => {
    const container = prompterRef.current;
    if (!container || !scrolling) return;
    let frame = 0;
    let advanceTimer = 0;
    let previousTime = 0;
    const scroll = (time: number) => {
      if (previousTime) container.scrollTop += ((time - previousTime) / 1000) * scrollSpeed;
      previousTime = time;
      if (container.scrollTop + container.clientHeight < container.scrollHeight - 1) {
        frame = window.requestAnimationFrame(scroll);
      } else if (recordingState === 'recording') {
        const words = activeSectionBody.split(/\s+/).filter(Boolean).length;
        const estimatedReadingDelay = Math.max(2500, Math.min(12000, Math.round((words / 2.5) * 1000)));
        const introTimeRemaining = activeSection === 0
          ? Math.max(0, PODCAST_INTRO_DURATION_MS - introElapsedMsRef.current)
          : 0;
        const readingDelay = Math.max(estimatedReadingDelay, introTimeRemaining);
        advanceTimer = window.setTimeout(() => {
          if (activeSection < sectionCount - 1) {
            setActiveSection((index) => index === activeSection ? index + 1 : index);
          } else {
            startOutro();
          }
        }, readingDelay);
      } else {
        setScrolling(false);
      }
    };
    frame = window.requestAnimationFrame(scroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(advanceTimer);
    };
  }, [scrolling, scrollSpeed, activeSection, activeSectionBody, authorized, recordingState, sectionCount, startOutro]);

  useEffect(() => {
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
    if (draft) setScrolling(true);
  }, [activeSection, draft]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    void closeConference(true, false).catch((cleanupError: unknown) => {
      console.error('Could not close the podcast guest room.', cleanupError);
    });
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    if (outroTimerRef.current !== null) window.clearTimeout(outroTimerRef.current);
    compositeVideoTrackRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    introClipRef.current?.pause();
    outroClipRef.current?.pause();
    void audioContextRef.current?.close();
  }, []);

  useEffect(() => {
    if (!recordingUrl) return;
    return () => URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  useEffect(() => {
    const handleHandoffResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (event.data?.sessionId !== sessionId) return;
      if (event.data.type === 'NEXSQ_PODCAST_RECORDING_STORED') {
        localStorage.removeItem(handoffKey(sessionId));
        window.close();
      } else if (event.data.type === 'NEXSQ_PODCAST_RECORDING_FAILED') {
        setHandoffSaving(false);
        setError(event.data.error || 'Could not save this recording. Please try again.');
      }
    };
    window.addEventListener('message', handleHandoffResult);
    return () => window.removeEventListener('message', handleHandoffResult);
  }, [sessionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setScrolling((value) => !value);
      } else if (event.key === 'ArrowRight') {
        setActiveSection((index) => Math.min(index + 1, sections.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setActiveSection((index) => Math.max(index - 1, 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sections.length]);

  const resetRecordingForDeviceChange = () => {
    recordingStateRef.current = 'idle';
    setRecordingState('idle');
    setRecordingUrl('');
    recordingBlobRef.current = null;
    originalRecordingBlobRef.current = null;
    setEffectsRendered(false);
    setAudioPreset('original');
    setVideoPreset('original');
  };

  const handleCameraChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const cameraId = event.target.value;
    setError('');
    try {
      await openMediaDevices(cameraId, selectedMicrophoneId);
      resetRecordingForDeviceChange();
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Could not switch to the selected camera.');
    }
  };

  const handleMicrophoneChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const microphoneId = event.target.value;
    setError('');
    try {
      await openMediaDevices(selectedCameraId, microphoneId);
      resetRecordingForDeviceChange();
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Could not switch to the selected microphone.');
    }
  };

  const handleRetryDeviceAccess = async () => {
    setError('');
    try {
      await openMediaDevices(selectedCameraId, selectedMicrophoneId);
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Could not open the camera and microphone.');
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const cameraStream = await openMediaDevices(selectedCameraId, selectedMicrophoneId);
      const cameraVideo = previewRef.current;
      if (!cameraVideo) throw new Error('The camera preview is not ready yet.');

      const canvas = document.createElement('canvas');
      if (typeof canvas.captureStream !== 'function') {
        throw new Error('This browser does not support the animated podcast intro recording.');
      }
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the podcast intro video.');

      const canvasStream = canvas.captureStream(30);
      const compositeVideoTrack = canvasStream.getVideoTracks()[0];
      if (!compositeVideoTrack) throw new Error('Could not capture the animated podcast intro.');
      const audioTracks = cameraStream.getAudioTracks();
      if (!audioTracks.length) {
        compositeVideoTrack.stop();
        throw new Error('A microphone is required to record the podcast.');
      }

      const createClip = (source: string | null | undefined, loop = false) => {
        if (!source) return null;
        const clip = document.createElement('video');
        clip.crossOrigin = 'anonymous';
        clip.playsInline = true;
        clip.preload = 'auto';
        clip.loop = loop;
        clip.src = source;
        return clip;
      };
      const introClip = createClip(draft?.introVideoUrl);
      const outroClip = createClip(draft?.outroVideoUrl, true);
      introClipRef.current = introClip;
      outroClipRef.current = outroClip;
      const [coverImage, logoImage] = await Promise.all([
        loadBrandImage(draft?.coverImageUrl),
        loadBrandImage(draft?.logoImageUrl),
      ]);
      coverImageRef.current = coverImage;
      logoImageRef.current = logoImage;

      let outputAudioTracks = audioTracks;
      const AudioContextConstructor = window.AudioContext;
      if (AudioContextConstructor) {
        const audioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        const audioDestination = audioContext.createMediaStreamDestination();
        audioDestinationRef.current = audioDestination;
        audioContext.createMediaStreamSource(new MediaStream(audioTracks)).connect(audioDestination);
        [introClip, outroClip].forEach((clip) => {
          if (clip) audioContext.createMediaElementSource(clip).connect(audioDestination);
        });
        await audioContext.resume();
        outputAudioTracks = audioDestination.stream.getAudioTracks();
        if (!outputAudioTracks.length) throw new Error('Could not prepare the podcast recording audio.');
        if (introClip) await introClip.play();
      } else if (introClip || outroClip) {
        throw new Error('Custom intro/outro audio is not supported in this browser.');
      }

      const roomToken = createPodcastConferenceRoomToken();
      const hostKey = createPodcastConferenceRoomToken();
      const hostParticipantId = createPodcastConferenceParticipantId();
      hostParticipantIdRef.current = hostParticipantId;
      if (audioDestinationRef.current) {
        try {
          const conferenceConnection = await connectToPodcastConference({
            roomToken,
            hostKey,
            role: 'host',
            participantId: hostParticipantId,
            onSignal: (signal) => {
              if (!isPodcastConferenceSignal(signal)) return;
              void handleConferenceSignal(signal).catch((signalError: unknown) => {
                setConferenceError(signalError instanceof Error ? signalError.message : 'Could not process a guest connection.');
              });
            },
            onClose: () => {
              if (recordingStateRef.current === 'recording' || recordingStateRef.current === 'paused') {
                setConferenceError('The NexSq signaling connection closed. The recording will continue without guest access.');
                void closeConference(false);
              }
            },
          });
          conferenceConnectionRef.current = conferenceConnection;
          setConferenceError('');
        } catch (connectionError) {
          hostParticipantIdRef.current = '';
          setConferenceError(connectionError instanceof Error ? connectionError.message : 'The guest room could not be opened.');
        }
      } else {
        hostParticipantIdRef.current = '';
        setConferenceError('This browser cannot mix guest audio, so the recording will continue without guest access.');
      }
      updatePendingGuests([]);
      updateActiveGuests([]);

      compositeVideoTrackRef.current = compositeVideoTrack;
      const recordingStream = new MediaStream([compositeVideoTrack, ...outputAudioTracks]);

      let elapsedMs = 0;
      let previousFrameTime = performance.now();
      let previousScene = -1;
      let introEnded = false;
      const hostNames = draft ? getHostNames(draft) : 'Your host';
      recordingStateRef.current = 'recording';
      introElapsedMsRef.current = 0;
      outroActiveRef.current = false;
      if (outroTimerRef.current !== null) window.clearTimeout(outroTimerRef.current);
      setOutroActive(false);
      setIntroMontageActive(true);
      setIntroScene(0);
      const drawFrame = (time: number) => {
        if (recordingStateRef.current === 'recording') {
          elapsedMs += Math.max(0, time - previousFrameTime);
        }
        previousFrameTime = time;
        introElapsedMsRef.current = elapsedMs;
        const title = draft?.title || 'Podcast';
        if (activeGuestsRef.current.length > 0) {
          drawPodcastConferenceLayout(
            context,
            cameraVideo,
            activeGuestsRef.current.map((guest) => ({
              name: guest.guestName,
              video: guestFeedsRef.current.get(guest.guestId)?.video || null,
            })),
            canvas.width,
            canvas.height,
            title,
            hostNames,
            elapsedMs < PODCAST_INTRO_DURATION_MS && !outroActiveRef.current,
          );
          if (outroActiveRef.current) {
            drawPodcastNextEpisodeSlot(context, canvas.width, canvas.height, draft?.nextEpisodeSlot);
          }
        } else if (outroActiveRef.current) {
          const outro = outroClipRef.current;
          if (outro && outro.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            drawVideoCover(context, outro, canvas.width, canvas.height);
            drawPodcastNextEpisodeSlot(context, canvas.width, canvas.height, draft?.nextEpisodeSlot);
          } else {
            drawPodcastOutroFrame(
              context,
              canvas.width,
              canvas.height,
              performance.now() - outroStartedAtRef.current,
              title,
              hostNames,
              coverImageRef.current,
              logoImageRef.current,
              draft?.nextEpisodeSlot,
            );
          }
        } else {
          const intro = introClipRef.current;
          const introIsPlaying = elapsedMs < PODCAST_INTRO_DURATION_MS
            && intro
            && !intro.ended
            && intro.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
          if (elapsedMs >= PODCAST_INTRO_DURATION_MS && intro && !intro.paused) intro.pause();
          drawPodcastIntroFrame(
            context,
            cameraVideo,
            canvas.width,
            canvas.height,
            elapsedMs,
            title,
            hostNames,
            coverImageRef.current,
            logoImageRef.current,
            introIsPlaying ? intro : null,
          );
        }
        drawPodcastBroadcastOverlays(
          context,
          canvas.width,
          canvas.height,
          elapsedMs,
          draft?.showName?.trim() || draft?.title || 'Podcast',
          draft?.topic?.trim() || '',
          hostNames,
          coverImageRef.current || logoImageRef.current,
        );
        const sceneIndex = Math.min(2, Math.floor(elapsedMs / (PODCAST_INTRO_DURATION_MS / 3)));
        if (sceneIndex !== previousScene) {
          previousScene = sceneIndex;
          setIntroScene(sceneIndex);
        }
        if (elapsedMs >= PODCAST_INTRO_DURATION_MS && !introEnded) {
          introEnded = true;
          setIntroMontageActive(false);
        }
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
      };
      drawFrame(previousFrameTime);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingBlobRef.current = null;
      originalRecordingBlobRef.current = null;
      setAudioPreset('original');
      setVideoPreset('original');
      setEffectsRendered(false);
      setRenderProgress(0);
      applyPreviewAudioPreset('original');
      setRecordingUrl('');
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        compositeVideoTrackRef.current?.stop();
        compositeVideoTrackRef.current = null;
        recordingStateRef.current = 'recorded';
        setIntroMontageActive(false);
        setOutroActive(false);
        outroActiveRef.current = false;
        if (outroTimerRef.current !== null) window.clearTimeout(outroTimerRef.current);
        outroTimerRef.current = null;
        introClipRef.current?.pause();
        outroClipRef.current?.pause();
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        audioDestinationRef.current = null;
        void closeConference(true).catch((conferenceCloseError: unknown) => {
          setConferenceError(conferenceCloseError instanceof Error ? conferenceCloseError.message : 'Could not close the guest room.');
        });
        recordingBlobRef.current = blob;
        originalRecordingBlobRef.current = blob;
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingState('recorded');
      };
      recorderRef.current = recorder;
      setActiveSection(0);
      setScrolling(true);
      recorder.start(1000);
      setRecordingState('recording');
      if (conferenceConnectionRef.current) {
        setConferenceLink(`${window.location.origin}/podcast-guest/${roomToken}`);
      } else {
        setConferenceLink('');
      }
    } catch (recordingError) {
      recordingStateRef.current = 'idle';
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      compositeVideoTrackRef.current?.stop();
      compositeVideoTrackRef.current = null;
      introClipRef.current?.pause();
      outroClipRef.current?.pause();
      introClipRef.current = null;
      outroClipRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      audioDestinationRef.current = null;
      try {
        await closeConference(false);
      } catch (conferenceCloseError) {
        setConferenceError(conferenceCloseError instanceof Error ? conferenceCloseError.message : 'Could not close the guest room.');
      }
      setIntroMontageActive(false);
      setScrolling(false);
      setError(recordingError instanceof Error ? recordingError.message : 'Could not start camera and microphone recording.');
    }
  };

  const stopRecording = () => {
    startOutro();
  };

  const restoreOriginalRecording = () => {
    const originalBlob = originalRecordingBlobRef.current;
    if (!effectsRendered || !originalBlob) return;
    recordingBlobRef.current = originalBlob;
    setRecordingUrl(URL.createObjectURL(originalBlob));
    setEffectsRendered(false);
  };

  const handleAudioPresetChange = (preset: ReelAudioPreset) => {
    if (isRenderingEffects || isSavingRecording) return;
    if (preset === audioPreset && (effectsRendered || (preset === 'original' && videoPreset === 'original'))) return;
    if (!applyPreviewAudioPreset(effectsRendered ? 'original' : preset)) return;
    restoreOriginalRecording();
    setAudioPreset(preset);
    setError('');
    if (preset !== 'original' || videoPreset !== 'original') {
      void renderPodcastEffects(preset, videoPreset).catch((renderError: unknown) => {
        setError(renderError instanceof Error ? renderError.message : 'Could not render podcast effects.');
      });
    }
  };

  const handleVideoPresetChange = (preset: ReelVideoPreset) => {
    if (isRenderingEffects || isSavingRecording) return;
    if (preset === videoPreset && (effectsRendered || (preset === 'original' && audioPreset === 'original'))) return;
    restoreOriginalRecording();
    setVideoPreset(preset);
    setError('');
    if (audioPreset !== 'original' || preset !== 'original') {
      void renderPodcastEffects(audioPreset, preset).catch((renderError: unknown) => {
        setError(renderError instanceof Error ? renderError.message : 'Could not render podcast effects.');
      });
    }
  };

  const renderPodcastEffects = async (
    selectedAudioPreset: ReelAudioPreset = audioPreset,
    selectedVideoPreset: ReelVideoPreset = videoPreset,
  ) => {
    const sourceBlob = originalRecordingBlobRef.current;
    if (!sourceBlob) throw new Error('Record a podcast before applying effects.');
    if (selectedAudioPreset === 'original' && selectedVideoPreset === 'original') return sourceBlob;

    setIsRenderingEffects(true);
    setRenderProgress(0);
    const sourceUrl = URL.createObjectURL(sourceBlob);
    try {
      const renderedBlob = await renderCaptionedReel(
        sourceUrl,
        [],
        'classic',
        false,
        setRenderProgress,
        { audioPreset: selectedAudioPreset, videoPreset: selectedVideoPreset },
        recordingSeconds,
      );
      recordingBlobRef.current = renderedBlob;
      setRecordingUrl(URL.createObjectURL(renderedBlob));
      setEffectsRendered(true);
      return renderedBlob;
    } finally {
      URL.revokeObjectURL(sourceUrl);
      setIsRenderingEffects(false);
    }
  };

  const saveAndLoadDraft = async () => {
    const currentRecording = recordingBlobRef.current;
    if (!currentRecording || !draft) return;
    if (!window.opener || window.opener.closed) {
      setError('The Podcast Studio window is no longer available. Keep this recording open and return to Podcast Studio to reopen the session.');
      return;
    }
    setIsSavingRecording(true);
    setError('');
    try {
      let blob = currentRecording;
      if ((audioPreset !== 'original' || videoPreset !== 'original') && !effectsRendered) {
        blob = await renderPodcastEffects();
      }
      if (draft.mode === 'creator') setHandoffSaving(true);
      const extension = blob.type.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
      window.opener.postMessage({
        type: 'NEXSQ_PODCAST_RECORDING_SAVED',
        sessionId,
        mode: draft.mode || 'admin',
        ownerId: draft.ownerId,
        draftId: draft.draftId,
        title: draft.title,
        script: draft.script,
        hostNames: draft.hostNames,
        recordingDurationSeconds: Math.max(1, recordingSeconds),
        recording: blob,
        fileName: `${draft.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'podcast'}-${Date.now()}.${extension}`,
      }, window.location.origin);
      if (draft.mode !== 'creator') {
        localStorage.removeItem(handoffKey(sessionId));
        window.close();
      }
    } catch (saveError) {
      setHandoffSaving(false);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this recording.');
    } finally {
      setIsSavingRecording(false);
    }
  };

  const currentSection = sections[activeSection];
  const changeSection = (direction: -1 | 1) => {
    setActiveSection((index) => Math.min(Math.max(index + direction, 0), sections.length - 1));
    setScrolling(true);
  };

  if (checkingAccess) {
    return <main className="grid min-h-screen place-items-center bg-[#080b0a] text-emerald-100">Preparing the recording desk…</main>;
  }

  if (!authorized || !draft) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#080b0a] p-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-xl font-semibold">Recording desk unavailable</h1>
          <p className="mt-3 text-sm text-white/65">{error || 'Return to the newsroom and open the teleprompter again.'}</p>
          <Button className="mt-5" onClick={() => window.close()}>Close window</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#080b0a] text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-7">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">NexSq Podcast Desk</div>
          <h1 className="truncate text-base font-semibold sm:text-lg">{draft.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {recordingState === 'recording' && <span className="flex items-center gap-2 text-sm tabular-nums text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />REC {formatTime(recordingSeconds)}</span>}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}>
            <Maximize className="h-4 w-4" /><span className="hidden sm:inline">Fullscreen</span>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close recording desk" onClick={() => window.close()}><ArrowLeft className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,36vw)]">
        <section className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">{currentSection?.heading}</p>
              <p className="mt-1 text-xs text-white/45">Segment {activeSection + 1} of {sections.length}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous segment" disabled={activeSection === 0} onClick={() => changeSection(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Next segment" disabled={activeSection >= sections.length - 1} onClick={() => changeSection(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div ref={prompterRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-12 sm:py-8">
            {activeSection === 0 && (
              <div className="mx-auto mb-6 max-w-5xl rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Episode</p>
                <p className="mt-1 text-lg font-bold text-white">{draft.title}</p>
                <p className="mt-1 text-xs text-white/65">Hosted by {introHostNames}</p>
              </div>
            )}
            <div className="mx-auto max-w-5xl whitespace-pre-wrap text-[1.65rem] font-bold leading-[1.65] text-white sm:text-4xl sm:leading-[1.7]">
              {currentSection?.body}
            </div>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-8">
            <Button variant="outline" className="gap-2" onClick={() => setScrolling((value) => !value)}>
              {scrolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {scrolling ? 'Pause scroll' : 'Resume scroll'}
            </Button>
            <label className="flex min-w-48 items-center gap-3 text-xs text-white/65">
              Scroll pace
              <input aria-label="Teleprompter scroll pace" type="range" min="6" max="55" step="1" value={scrollSpeed} onChange={(event) => setScrollSpeed(Number(event.target.value))} className="accent-emerald-400" />
              <span className="w-8 text-right tabular-nums">{scrollSpeed}</span>
            </label>
          </footer>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
          <section className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <label className="min-w-0 space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                <Video className="h-3.5 w-3.5 text-emerald-300" />
                Camera
              </span>
              <select
                aria-label="Select recording camera"
                value={selectedCameraId}
                onChange={(event) => void handleCameraChange(event)}
                disabled={recordingState === 'recording' || recordingState === 'paused' || isLoadingDevices}
                className="h-9 w-full truncate rounded-md border border-white/15 bg-[#111715] px-2 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50"
              >
                <option value="">System default</option>
                {cameraDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                <Mic className="h-3.5 w-3.5 text-emerald-300" />
                Microphone
              </span>
              <select
                aria-label="Select recording microphone"
                value={selectedMicrophoneId}
                onChange={(event) => void handleMicrophoneChange(event)}
                disabled={recordingState === 'recording' || recordingState === 'paused' || isLoadingDevices}
                className="h-9 w-full truncate rounded-md border border-white/15 bg-[#111715] px-2 text-xs text-white outline-none focus:border-emerald-400 disabled:opacity-50"
              >
                <option value="">System default</option>
                {microphoneDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <p className="col-span-2 text-[10px] text-white/45" aria-live="polite">
              {isLoadingDevices
                ? 'Connecting to selected devices…'
                : cameraReady
                  ? 'These inputs are used for both preview and recording.'
                  : 'Allow camera and microphone access to choose your recording devices.'}
            </p>
            {!cameraReady && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2"
                onClick={() => void handleRetryDeviceAccess()}
                disabled={isLoadingDevices}
              >
                {isLoadingDevices ? 'Connecting…' : 'Enable camera and microphone'}
              </Button>
            )}
          </section>
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <video
              ref={previewRef}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${activeGuests.length > 0 && !recordingUrl ? 'invisible' : ''}`}
              style={recordingUrl && !effectsRendered ? { filter: getReelVideoFilter(videoPreset) } : undefined}
            />
            {activeGuests.length > 0 && !recordingUrl && (
              <div
                className="absolute inset-0 z-10 grid bg-[#080b0a]"
                style={{ gridTemplateColumns: `repeat(${activeGuests.length + 1}, minmax(0, 1fr))` }}
              >
                {[{ guestId: 'host-preview', guestName: 'Host' }, ...activeGuests].map((guest, index) => (
                  <div key={guest.guestId} className="relative min-w-0 overflow-hidden border-r border-white/30 last:border-r-0">
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                      ref={(video) => {
                        if (!video) return;
                        const stream = index === 0
                          ? streamRef.current
                          : guestFeedsRef.current.get(guest.guestId)?.video.srcObject;
                        if (stream && video.srcObject !== stream) {
                          video.srcObject = stream;
                          void video.play().catch((playError: unknown) => {
                            setConferenceError(playError instanceof Error ? playError.message : 'Could not display a participant video.');
                          });
                        }
                      }}
                    />
                    <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded bg-black/70 px-2 py-1 text-[9px] text-white sm:bottom-3 sm:left-3 sm:text-xs">
                      {index === 0 ? 'Host' : guest.guestName}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {introMontageActive && activeGuests.length === 0 && (
              <div
                className="absolute inset-0 z-10 flex flex-col justify-between p-4 text-white transition-colors duration-1000 sm:p-6"
                style={{ background: introPreviewBackgrounds[introScene] }}
              >
                <div className="flex items-center gap-2">
                  {draft.logoImageUrl && <img src={draft.logoImageUrl} alt="" className="h-7 w-7 rounded object-contain" />}
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    NexSq Podcast · Intro {introScene + 1}/3
                  </p>
                </div>
                <div>
                  <h2 className="line-clamp-2 text-xl font-bold leading-tight sm:text-2xl">{draft.title}</h2>
                  <p className="mt-2 text-xs text-white/75">Hosted by {introHostNames}</p>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-1000"
                    style={{ width: `${((introScene + 1) / introPreviewBackgrounds.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {outroActive && activeGuests.length === 0 && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-[#07110f]/85 text-center">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300">NexSq Podcast · Outro</p>
                  <h2 className="mt-2 text-xl font-bold">{draft.title}</h2>
                  <p className="mt-1 text-xs text-white/75">Thanks for watching</p>
                </div>
              </div>
            )}
            {liveOverlaysVisible && (
              <>
                {showArtworkUrl && (
                  <img
                    src={showArtworkUrl}
                    alt=""
                    className="absolute right-3 top-3 z-20 h-14 w-[42px] rounded-md border border-white/45 bg-black/75 object-contain shadow-lg sm:h-[72px] sm:w-[54px]"
                  />
                )}
                <div className="absolute left-3 top-3 z-20 flex max-w-[68%] items-center gap-2 overflow-hidden rounded-md border border-white/20 bg-black/65 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm">
                  <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-300 sm:text-[9px]">Topic</span>
                  <span className="h-3 w-px shrink-0 bg-white/25" />
                  <span className="truncate text-[9px] font-medium sm:text-[11px]">{draft.topic?.trim() || 'Discussion topic'}</span>
                </div>
                {liveLowerThirdVisible && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 flex h-[14%] min-h-9 items-center gap-1.5 overflow-hidden border-t border-white/15 bg-gradient-to-r from-[#03100d]/90 via-[#050c0d]/85 to-[#080a0e]/90 px-2 text-white shadow-xl backdrop-blur-sm sm:gap-3 sm:px-4">
                    <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-600 to-transparent" />
                    {showArtworkUrl ? (
                      <img src={showArtworkUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover ring-1 ring-white/25 sm:h-10 sm:w-10" />
                    ) : (
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-emerald-500 to-emerald-900 text-[9px] font-bold ring-1 ring-white/25 sm:h-10 sm:w-10 sm:text-[10px]">
                        {(draft.showName?.trim() || draft.title).split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'P'}
                      </div>
                    )}
                    <p className="min-w-0 flex-[0.8] truncate text-[9px] font-bold sm:text-xs">{draft.showName?.trim() || draft.title}</p>
                    <span className="h-4 w-px shrink-0 bg-white/20" />
                    <p className="min-w-0 flex-1 truncate text-[8px] text-white/65 sm:text-[9px]">Hosted by {introHostNames}</p>
                  </div>
                )}
              </>
            )}
            {!cameraReady && !recordingUrl && <div className="absolute inset-0 grid place-items-center text-center text-sm text-white/45"><Video className="mb-2 h-6 w-6" />Camera preview</div>}
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-xs text-white/65">
            <span className="flex items-center gap-2"><Mic className="h-4 w-4 text-emerald-300" />Camera + microphone</span>
            <span className="tabular-nums">{formatTime(recordingSeconds)}</span>
          </div>
          {!conferenceLink && conferenceError && (recordingState === 'recording' || recordingState === 'paused') && (
            <p role="alert" className="rounded-md border border-amber-400/25 bg-amber-400/[0.06] p-2 text-[11px] text-amber-100">{conferenceError}</p>
          )}
          {conferenceLink && (
            <section className="space-y-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3" aria-labelledby="podcast-guests-title">
              <div>
                <h2 id="podcast-guests-title" className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserPlus className="h-4 w-4 text-emerald-300" /> Invite guests
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/55">Share this link after recording starts. Guests wait here until you admit them; up to two guests can join.</p>
              </div>
              <div className="flex min-w-0 gap-2">
                <input aria-label="Guest invite link" readOnly value={conferenceLink} className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 text-[10px] text-white/75" />
                <Button type="button" variant="outline" size="sm" onClick={() => void copyConferenceLink()} className="shrink-0 gap-1.5 border-white/20 text-xs">
                  {conferenceLinkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {conferenceLinkCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              {pendingGuests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-amber-200">Waiting for approval</p>
                  {pendingGuests.map((guest) => (
                    <div key={guest.guestId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
                      <span className="min-w-0 truncate text-xs text-white">{guest.guestName}</span>
                      <div className="flex shrink-0 gap-1.5">
                        <Button type="button" size="sm" onClick={() => void admitGuest(guest)} disabled={recordingState !== 'recording'} className="h-7 bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-500">Admit</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void rejectGuest(guest)} className="h-7 border-white/20 px-2 text-[10px]">Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeGuests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-emerald-200">In the recording</p>
                  {activeGuests.map((guest) => (
                    <div key={guest.guestId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
                      <span className="min-w-0 truncate text-xs text-white">{guest.guestName}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void removeGuest(guest)} className="h-7 shrink-0 gap-1 border-white/20 px-2 text-[10px]">
                        <UserX className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {conferenceError && <p role="alert" className="text-[11px] text-amber-200">{conferenceError}</p>}
            </section>
          )}
          {recordingState === 'idle' || recordingState === 'recorded' ? (
            <Button className="w-full gap-2 bg-red-600 text-white hover:bg-red-700" onClick={() => void startRecording()}>
              {recordingState === 'recorded' ? <RotateCcw className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              {recordingState === 'recorded' ? 'Record again' : 'Start recording'}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" disabled={outroActive} onClick={() => {
                const recorder = recorderRef.current;
                if (!recorder) return;
                if (recorder.state === 'recording') {
                  recorder.pause();
                  introClipRef.current?.pause();
                  outroClipRef.current?.pause();
                  recordingStateRef.current = 'paused';
                  setRecordingState('paused');
                  setScrolling(false);
                } else if (recorder.state === 'paused') {
                  recorder.resume();
                  if (introElapsedMsRef.current < PODCAST_INTRO_DURATION_MS) void introClipRef.current?.play().catch(() => undefined);
                  if (outroActiveRef.current) void outroClipRef.current?.play().catch(() => undefined);
                  recordingStateRef.current = 'recording';
                  setRecordingState('recording');
                  setScrolling(true);
                }
              }}>
                {recordingState === 'recording' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {recordingState === 'recording' ? 'Pause' : 'Resume'}
              </Button>
              <Button variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={stopRecording} disabled={outroActive}>
                {outroActive ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                {outroActive ? 'Outro…' : 'Stop'}
              </Button>
            </div>
          )}
          {recordingState === 'recorded' && (
            <section className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3" aria-labelledby="podcast-effects-title">
              <div>
                <h2 id="podcast-effects-title" className="text-sm font-semibold text-white">Audio and video effects</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">Changes preview and render automatically when selected.</p>
              </div>
              <MediaEnhancementTabs
                audioPreset={audioPreset}
                videoPreset={videoPreset}
                onAudioPresetChange={handleAudioPresetChange}
                onVideoPresetChange={handleVideoPresetChange}
                disabled={isRenderingEffects || isSavingRecording}
                accent="emerald"
              />
              <details className="text-[11px] text-white/45">
                <summary className="cursor-pointer text-white/60">Effect notes</summary>
                <p className="mt-1.5">Voice clarity reduces low rumble, not full noise cancellation. Warm studio adds room ambience, not surround sound. Video presets adjust light, contrast, and color.</p>
              </details>
              <p className="text-[10px] text-emerald-200/70" aria-live="polite">
                {isRenderingEffects
                  ? `Rendering effects automatically: ${renderProgress}%`
                  : effectsRendered
                    ? 'Selected effects rendered and ready to save.'
                    : 'Select a preset to render it automatically.'}
              </p>
              {isRenderingEffects && (
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Rendering podcast effects"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={renderProgress}
                >
                  <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${renderProgress}%` }} />
                </div>
              )}
            </section>
          )}
          {recordingState === 'recorded' && (
            <Button className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => void saveAndLoadDraft()} disabled={handoffSaving || isSavingRecording || isRenderingEffects}>
              {handoffSaving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isRenderingEffects || isSavingRecording
                ? isRenderingEffects ? `Rendering ${renderProgress}%` : 'Saving recording…'
                : handoffSaving
                  ? 'Saving private draft…'
                  : draft.mode === 'creator'
                    ? 'Save recording to private draft'
                    : 'Save & load into show draft'}
            </Button>
          )}
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
          <p className="mt-auto text-xs leading-relaxed text-white/40">TV output is always landscape 16:9. Hold your phone sideways. Recording starts with a 15-second intro; its 15-second outro begins at the target runtime’s final 15 seconds or when you stop early, then stays in this browser until saved.</p>
        </aside>
      </div>
    </main>
  );
}