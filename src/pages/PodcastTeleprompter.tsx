import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Maximize, Mic, Music2, Pause, Play, RotateCcw, Save, Square, UserPlus, UserX, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaEnhancementTabs } from '@/components/studio/MediaEnhancementTabs';
import { useReelAudioPreview } from '@/hooks/useReelAudioPreview';
import { supabase } from '@/integrations/supabase/client';
import {
  createPodcastConferenceParticipantId,
  createPodcastConferenceRoomToken,
  createPodcastPeerConnection,
  connectToPodcastConference,
  getPodcastConferenceIceServers,
  isPodcastConferenceSignal,
  PODCAST_STUN_ICE_SERVERS,
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
import { renderPodcastAudioCleanup, type PodcastAudioCleanupOptions } from '@/utils/podcastAudioCleanup';
import { PODCAST_SOUNDTRACKS } from '@/utils/podcastSoundtracks';
import {
  deletePodcastRecordingRecovery,
  loadPodcastRecordingRecovery,
  savePodcastRecordingRecovery,
} from '@/utils/podcastRecordingRecovery';
import {
  deletePodcastRecordingBackup,
  deletePodcastRecordingBackups,
  downloadPodcastRecordingBackup,
  getPodcastRecordingStoragePaths,
  uploadPodcastRecordingBackup,
  type PodcastRecordingStoragePaths,
} from '@/utils/podcastRecordingStorage';
import {
  drawPodcastBroadcastOverlays,
  drawPodcastIntroFrame,
  drawPodcastNextEpisodeSlot,
  drawPodcastOutroFrame,
  PODCAST_INTRO_DURATION_MS,
  PODCAST_OUTRO_DURATION_MS,
  getPodcastLowerThirdStage,
  shouldStartPodcastOutro,
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
  supabaseOriginalSaved?: boolean;
  supabaseRecordingSeconds?: number;
  supabaseLatestSaved?: boolean;
  supabaseRenderSettings?: SavedPodcastRenderSettings;
};
type SavedPodcastRenderSettings = {
  audioPreset: ReelAudioPreset;
  videoPreset: ReelVideoPreset;
  audioCleanup: PodcastAudioCleanupOptions;
  backgroundAudioUrl: string;
  backgroundAudioVolume: number;
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
const DEFAULT_AUDIO_CLEANUP: PodcastAudioCleanupOptions = {
  noiseGate: false,
  declip: false,
  declick: false,
  trimSilence: false,
  minimumSilenceSeconds: 1,
  trimStartSeconds: 0,
  trimEndSeconds: 0,
  fadeOutSeconds: 0,
};
const introPreviewBackgrounds = [
  'linear-gradient(135deg, #062116, #07110f 58%, #030605)',
  'linear-gradient(135deg, #08212a, #080f18 58%, #030605)',
  'linear-gradient(135deg, #25180a, #100e0b 58%, #030605)',
];

function getSavedPodcastRenderSettings(value: unknown): SavedPodcastRenderSettings | null {
  if (!value || typeof value !== 'object') return null;
  const settings = value as Record<string, unknown>;
  const audioPresets: ReelAudioPreset[] = ['original', 'voice-clarity', 'warm-studio', 'bass-boost', 'volume-boost'];
  const videoPresets: ReelVideoPreset[] = ['original', 'balanced', 'bright', 'vivid'];
  if (
    typeof settings.audioPreset !== 'string'
    || !audioPresets.some((preset) => preset === settings.audioPreset)
    || typeof settings.videoPreset !== 'string'
    || !videoPresets.some((preset) => preset === settings.videoPreset)
    || typeof settings.backgroundAudioUrl !== 'string'
    || (
      settings.backgroundAudioUrl !== ''
      && !PODCAST_SOUNDTRACKS.some((track) => track.url === settings.backgroundAudioUrl)
    )
    || typeof settings.backgroundAudioVolume !== 'number'
    || !Number.isFinite(settings.backgroundAudioVolume)
    || settings.backgroundAudioVolume < 0
    || settings.backgroundAudioVolume > 0.2
    || !settings.audioCleanup
    || typeof settings.audioCleanup !== 'object'
  ) return null;

  const cleanup = settings.audioCleanup as Record<string, unknown>;
  if (
    typeof cleanup.noiseGate !== 'boolean'
    || typeof cleanup.declip !== 'boolean'
    || typeof cleanup.declick !== 'boolean'
    || typeof cleanup.trimSilence !== 'boolean'
    || typeof cleanup.minimumSilenceSeconds !== 'number'
    || !Number.isFinite(cleanup.minimumSilenceSeconds)
    || cleanup.minimumSilenceSeconds < 0.5
    || cleanup.minimumSilenceSeconds > 2.5
    || typeof cleanup.trimStartSeconds !== 'number'
    || !Number.isFinite(cleanup.trimStartSeconds)
    || cleanup.trimStartSeconds < 0
    || typeof cleanup.trimEndSeconds !== 'number'
    || !Number.isFinite(cleanup.trimEndSeconds)
    || cleanup.trimEndSeconds < 0
    || typeof cleanup.fadeOutSeconds !== 'number'
    || !Number.isFinite(cleanup.fadeOutSeconds)
    || cleanup.fadeOutSeconds < 0
    || cleanup.fadeOutSeconds > 5
  ) return null;

  return {
    audioPreset: settings.audioPreset as ReelAudioPreset,
    videoPreset: settings.videoPreset as ReelVideoPreset,
    audioCleanup: {
      noiseGate: cleanup.noiseGate,
      declip: cleanup.declip,
      declick: cleanup.declick,
      trimSilence: cleanup.trimSilence,
      minimumSilenceSeconds: cleanup.minimumSilenceSeconds,
      trimStartSeconds: cleanup.trimStartSeconds,
      trimEndSeconds: cleanup.trimEndSeconds,
      fadeOutSeconds: cleanup.fadeOutSeconds,
    },
    backgroundAudioUrl: settings.backgroundAudioUrl,
    backgroundAudioVolume: settings.backgroundAudioVolume,
  };
}

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
        : /^(SEGMENT \d+:.*|ANGLE \d+:.*|STUDIO DISCUSSION|PRESENTER NOTES)$/i.test(text)
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
  cameraZoom: number,
) => {
  const participants = [{ name: 'Host', video: hostVideo }, ...guests];
  const tileWidth = width / participants.length;
  context.fillStyle = '#080b0a';
  context.fillRect(0, 0, width, height);
  participants.forEach((participant, index) => {
    const x = index * tileWidth;
    const video = participant.video;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
      const baseScale = Math.max(tileWidth / video.videoWidth, height / video.videoHeight);
      const scale = baseScale * (index === 0 ? cameraZoom : 1);
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
  const [recordingMediaDuration, setRecordingMediaDuration] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const [cameraZoom, setCameraZoom] = useState(1);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [audioPreset, setAudioPreset] = useState<ReelAudioPreset>('original');
  const [audioCleanup, setAudioCleanup] = useState<PodcastAudioCleanupOptions>(DEFAULT_AUDIO_CLEANUP);
  const [backgroundAudioUrl, setBackgroundAudioUrl] = useState('');
  const [backgroundAudioVolume, setBackgroundAudioVolume] = useState(0.1);
  const [videoPreset, setVideoPreset] = useState<ReelVideoPreset>('original');
  const [effectsRendered, setEffectsRendered] = useState(false);
  const [effectsCancelled, setEffectsCancelled] = useState(false);
  const [isRenderingEffects, setIsRenderingEffects] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(false);
  const [isPersistingRecording, setIsPersistingRecording] = useState(false);
  const [isRecoveryCopyAvailable, setIsRecoveryCopyAvailable] = useState(false);
  const [isSupabaseCopyAvailable, setIsSupabaseCopyAvailable] = useState(false);
  const [supabaseSyncNotice, setSupabaseSyncNotice] = useState('');
  const [cloudRecordingPaths, setCloudRecordingPaths] = useState<PodcastRecordingStoragePaths | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState('');
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
  const recordingSecondsRef = useRef(0);
  const renderAbortControllerRef = useRef<AbortController | null>(null);
  const cloudOriginalSavedRef = useRef(false);
  const recordingStateRef = useRef<RecordingState>('idle');
  const introElapsedMsRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const compositeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const conferenceConnectionRef = useRef<PodcastConferenceConnection | null>(null);
  const hostParticipantIdRef = useRef('');
  const cameraZoomRef = useRef(1);
  const pendingGuestsRef = useRef<PodcastGuest[]>([]);
  const activeGuestsRef = useRef<PodcastGuest[]>([]);
  const admittingGuestsRef = useRef(new Set<string>());
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
  const liveOverlayDecorationsVisible = !recordingUrl
    && (recordingState === 'recording' || recordingState === 'paused')
    && !introMontageActive
    && !outroActive;
  const liveLowerThirdStage = getPodcastLowerThirdStage(recordingSeconds * 1000);
  const liveLowerThirdVisible = !recordingUrl
    && (recordingState === 'recording' || recordingState === 'paused')
    && !outroActive
    && liveLowerThirdStage !== null;
  const showArtworkUrl = draft?.coverImageUrl || draft?.logoImageUrl;
  const hasAudioProcessing = audioCleanup.noiseGate
    || audioCleanup.declip
    || audioCleanup.declick
    || audioCleanup.trimSilence
    || audioCleanup.trimStartSeconds > 0
    || audioCleanup.trimEndSeconds > 0
    || audioCleanup.fadeOutSeconds > 0
    || Boolean(backgroundAudioUrl);
  const recordingDurationForTrim = recordingMediaDuration > 0 ? recordingMediaDuration : recordingSeconds;
  const keptRecordingDuration = Math.max(
    0,
    recordingDurationForTrim - audioCleanup.trimStartSeconds - audioCleanup.trimEndSeconds,
  );
  const maximumTrimStart = Math.max(0, recordingDurationForTrim - audioCleanup.trimEndSeconds - 0.1);
  const maximumTrimEnd = Math.max(0, recordingDurationForTrim - audioCleanup.trimStartSeconds - 0.1);
  const maximumFadeOut = Math.max(0, Math.min(5, keptRecordingDuration));

  const updateHandoffBackupMetadata = useCallback((updates: Partial<Pick<
    DraftPayload,
    'supabaseOriginalSaved' | 'supabaseRecordingSeconds' | 'supabaseLatestSaved' | 'supabaseRenderSettings'
  >>) => {
    try {
      const current = localStorage.getItem(handoffKey(sessionId));
      if (!current) return;
      const payload = JSON.parse(current) as DraftPayload;
      localStorage.setItem(handoffKey(sessionId), JSON.stringify({ ...payload, ...updates }));
    } catch (metadataError) {
      console.error('Could not update podcast recording recovery metadata:', metadataError);
    }
  }, [sessionId]);

  const persistOriginalRecordingToSupabase = useCallback(async (blob: Blob, durationSeconds: number) => {
    if (!cloudRecordingPaths) throw new Error('Secure recording storage is not ready yet.');
    setSupabaseSyncNotice('Uploading the original recording to private Supabase storage…');
    await uploadPodcastRecordingBackup(cloudRecordingPaths.original, blob);
    cloudOriginalSavedRef.current = true;
    setIsSupabaseCopyAvailable(true);
    updateHandoffBackupMetadata({
      supabaseOriginalSaved: true,
      supabaseRecordingSeconds: durationSeconds,
      supabaseLatestSaved: false,
      supabaseRenderSettings: undefined,
    });
    setSupabaseSyncNotice('Original recording backed up to private Supabase storage.');
    try {
      await deletePodcastRecordingBackup(cloudRecordingPaths.latest);
    } catch (cleanupError) {
      console.error('Could not remove the previous rendered podcast backup:', cleanupError);
    }
  }, [cloudRecordingPaths, updateHandoffBackupMetadata]);

  const syncLatestRecordingToSupabase = useCallback(async (blob: Blob, renderSettings: SavedPodcastRenderSettings) => {
    if (!cloudRecordingPaths) {
      setSupabaseSyncNotice('Could not sync this render: secure recording storage is not ready.');
      return;
    }
    setIsSyncingSupabase(true);
    try {
      if (!cloudOriginalSavedRef.current) {
        await persistOriginalRecordingToSupabase(
          originalRecordingBlobRef.current || blob,
          recordingSecondsRef.current,
        );
      }
      setSupabaseSyncNotice('Uploading the latest completed render to private Supabase storage…');
      await uploadPodcastRecordingBackup(cloudRecordingPaths.latest, blob);
      updateHandoffBackupMetadata({
        supabaseLatestSaved: true,
        supabaseRenderSettings: renderSettings,
      });
      setSupabaseSyncNotice('Latest completed render backed up to Supabase. The original is preserved separately.');
    } catch (syncError) {
      console.error('Could not sync the podcast recording to Supabase:', syncError);
      setSupabaseSyncNotice(`Supabase sync failed: ${syncError instanceof Error ? syncError.message : 'Could not upload the latest recording.'} The original take remains unchanged; check the recovery status above.`);
    } finally {
      setIsSyncingSupabase(false);
    }
  }, [cloudRecordingPaths, persistOriginalRecordingToSupabase, updateHandoffBackupMetadata]);

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
    if (admittingGuestsRef.current.has(guest.guestId)) return;
    if (activeGuestsRef.current.length >= 2) {
      setConferenceError('A recording can include up to two guests.');
      return;
    }

    admittingGuestsRef.current.add(guest.guestId);
    setConferenceError('');
    let peerConnection: RTCPeerConnection | null = null;
    try {
      let iceServers: RTCIceServer[] = [];
      try {
        iceServers = await getPodcastConferenceIceServers();
        if (!iceServers.length) {
          iceServers = [...PODCAST_STUN_ICE_SERVERS];
          setConferenceError('No TURN server is configured. Trying a STUN-assisted direct connection; some networks may block it.');
        }
      } catch (turnError) {
        iceServers = [...PODCAST_STUN_ICE_SERVERS];
        setConferenceError(
          `${turnError instanceof Error ? turnError.message : 'Self-hosted TURN is unavailable.'} Trying a STUN-assisted direct connection; some networks may block it.`,
        );
      }

      const peer = createPodcastPeerConnection({ iceServers });
      peerConnection = peer;
      guestConnectionsRef.current.set(guest.guestId, peer);
      updatePendingGuests(pendingGuestsRef.current.filter((request) => request.guestId !== guest.guestId));
      updateActiveGuests([...activeGuestsRef.current, guest]);
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
      if (peerConnection) removeGuestConnection(guest.guestId);
      setConferenceError(admissionError instanceof Error ? admissionError.message : 'Could not admit this guest.');
    } finally {
      admittingGuestsRef.current.delete(guest.guestId);
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
        setCloudRecordingPaths(getPodcastRecordingStoragePaths(user.id, sessionId));
        cloudOriginalSavedRef.current = parsedDraft.supabaseOriginalSaved === true;
        setIsSupabaseCopyAvailable(cloudOriginalSavedRef.current);
        if (cloudOriginalSavedRef.current) {
          setSupabaseSyncNotice('Original recording is backed up to private Supabase storage.');
        }

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
          if (!eligibility.canUsePodcastStudio || !draftResult.data || !['draft', 'changes_requested'].includes(draftResult.data.status)) {
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
    if (!authorized || !sessionId || !cloudRecordingPaths) return;
    let active = true;
    setIsCheckingRecovery(true);
    const restoreRecovery = async () => {
      try {
        let recovery: Awaited<ReturnType<typeof loadPodcastRecordingRecovery>> = null;
        try {
          recovery = await loadPodcastRecordingRecovery(sessionId);
        } catch (localRecoveryError) {
          console.error('Could not read the local podcast recovery copy:', localRecoveryError);
        }
        if (!active) return;
        if (recovery && (
          !(recovery.blob instanceof Blob)
          || !Number.isFinite(recovery.savedAt)
          || recovery.savedAt > Date.now()
          || Date.now() - recovery.savedAt > HANDOFF_TTL_MS
          || !Number.isFinite(recovery.recordingSeconds)
          || recovery.recordingSeconds < 0
        )) {
          try {
            await deletePodcastRecordingRecovery(sessionId);
          } catch (deleteError) {
            console.error('Could not remove an expired podcast recovery copy:', deleteError);
          }
          recovery = null;
        }
        if (recordingStateRef.current !== 'idle') return;

        let recoveryBlob = recovery?.blob || null;
        let recoverySeconds = recovery?.recordingSeconds || 0;
        let recoverySource = 'this browser';
        if (!recoveryBlob) {
          recoveryBlob = await downloadPodcastRecordingBackup(cloudRecordingPaths.original);
          if (!active || !recoveryBlob) return;
          const storedDraft = localStorage.getItem(handoffKey(sessionId));
          if (storedDraft) {
            const backupDuration = Number((JSON.parse(storedDraft) as DraftPayload).supabaseRecordingSeconds);
            if (Number.isFinite(backupDuration) && backupDuration >= 0) recoverySeconds = backupDuration;
          }
          setIsSupabaseCopyAvailable(true);
          cloudOriginalSavedRef.current = true;
          setSupabaseSyncNotice('Original recording is backed up to private Supabase storage.');
          recoverySource = 'Supabase';
          void savePodcastRecordingRecovery(sessionId, recoveryBlob, recoverySeconds).then(() => {
            if (active) setIsRecoveryCopyAvailable(true);
          }).catch((saveError: unknown) => {
            console.error('Could not cache the Supabase podcast backup in this browser:', saveError);
          });
        }
        if (!recoveryBlob) return;

        const storedDraft = localStorage.getItem(handoffKey(sessionId));
        const backupMetadata = storedDraft ? JSON.parse(storedDraft) as DraftPayload : null;
        let currentBlob = recoveryBlob;
        const savedRenderSettings = backupMetadata?.supabaseLatestSaved
          ? getSavedPodcastRenderSettings(backupMetadata.supabaseRenderSettings)
          : null;
        let latestRenderRestored = false;
        if (backupMetadata?.supabaseLatestSaved && !savedRenderSettings) {
          updateHandoffBackupMetadata({ supabaseLatestSaved: false, supabaseRenderSettings: undefined });
        }
        if (savedRenderSettings) {
          try {
            const latestBlob = await downloadPodcastRecordingBackup(cloudRecordingPaths.latest);
            if (!active) return;
            if (latestBlob) {
              currentBlob = latestBlob;
              latestRenderRestored = true;
              setAudioPreset(savedRenderSettings.audioPreset);
              setVideoPreset(savedRenderSettings.videoPreset);
              setAudioCleanup(savedRenderSettings.audioCleanup);
              setBackgroundAudioUrl(savedRenderSettings.backgroundAudioUrl);
              setBackgroundAudioVolume(savedRenderSettings.backgroundAudioVolume);
              setSupabaseSyncNotice('Latest completed render restored from private Supabase storage. The original is preserved separately.');
            } else {
              updateHandoffBackupMetadata({ supabaseLatestSaved: false, supabaseRenderSettings: undefined });
            }
          } catch (latestError) {
            console.error('Could not restore the latest podcast render from Supabase:', latestError);
            setSupabaseSyncNotice('Could not restore the latest effects render; the original recording is available.');
          }
        }

        recordingBlobRef.current = currentBlob;
        originalRecordingBlobRef.current = recoveryBlob;
        recordingSecondsRef.current = Math.max(0, recoverySeconds);
        setRecordingSeconds(recordingSecondsRef.current);
        if (recovery) setIsRecoveryCopyAvailable(true);
        setRecordingUrl(URL.createObjectURL(currentBlob));
        recordingStateRef.current = 'recorded';
        setRecordingState('recorded');
        setEffectsRendered(latestRenderRestored);
        setEffectsCancelled(false);
        setRecoveryNotice(latestRenderRestored
          ? `Recovered the original take from ${recoverySource} and restored its latest completed effects render.`
          : `Recovered the original take from ${recoverySource}. Any unfinished effects were discarded; you can retry them.`);
        if (recovery && !cloudOriginalSavedRef.current) {
          setIsPersistingRecording(true);
          void persistOriginalRecordingToSupabase(recoveryBlob, recoverySeconds).catch((uploadError: unknown) => {
            console.error('Could not restore the cloud podcast backup from the local recovery copy:', uploadError);
            setSupabaseSyncNotice(`Supabase backup retry failed: ${uploadError instanceof Error ? uploadError.message : 'Could not upload the original recording.'}`);
          }).finally(() => setIsPersistingRecording(false));
        }
      } catch (recoveryError) {
        if (active) {
          console.error('Could not restore a podcast recording backup:', recoveryError);
          setRecoveryNotice('Could not restore a recovery copy from this browser or Supabase. Keep this page open and save your recording before refreshing.');
        }
      } finally {
        if (active) setIsCheckingRecovery(false);
      }
    };

    void restoreRecovery();
    return () => { active = false; };
  }, [authorized, cloudRecordingPaths, persistOriginalRecordingToSupabase, sessionId, updateHandoffBackupMetadata]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    setRecordingMediaDuration(0);
    if (recordingUrl) {
      video.srcObject = null;
      video.src = recordingUrl;
      video.controls = true;
      video.muted = false;
      video.load();
      void video.play().catch((playError: unknown) => {
        if (video.error) return;
        if (playError instanceof Error && playError.name === 'NotAllowedError') {
          setError('Your browser blocked automatic playback with sound. Press Play in the preview to hear the recording.');
          return;
        }
        setError(playError instanceof Error ? `Could not start recording playback: ${playError.message}` : 'Could not start recording playback.');
      });
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
    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => {
        const nextSeconds = seconds + 1;
        recordingSecondsRef.current = nextSeconds;
        return nextSeconds;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recordingState]);

  useEffect(() => {
    const hasUnsavedRecording = recordingState === 'recording'
      || recordingState === 'paused'
      || isPersistingRecording
      || isSyncingSupabase
      || (recordingState === 'recorded' && !isRecoveryCopyAvailable && !isSupabaseCopyAvailable);
    if (!hasUnsavedRecording) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isPersistingRecording, isRecoveryCopyAvailable, isSupabaseCopyAvailable, isSyncingSupabase, recordingState]);

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
    renderAbortControllerRef.current?.abort();
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
    const handleHandoffResult = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (event.data?.sessionId !== sessionId) return;
      if (event.data.type === 'NEXSQ_PODCAST_RECORDING_STORED') {
        localStorage.removeItem(handoffKey(sessionId));
        try {
          await deletePodcastRecordingRecovery(sessionId);
        } catch (recoveryError) {
          console.error('Could not remove the saved podcast recovery copy:', recoveryError);
        }
        if (cloudRecordingPaths) {
          try {
            await deletePodcastRecordingBackups(cloudRecordingPaths);
          } catch (cleanupError) {
            console.error('Could not remove the saved podcast staging copies:', cleanupError);
          }
        }
        window.close();
      } else if (event.data.type === 'NEXSQ_PODCAST_RECORDING_FAILED') {
        setHandoffSaving(false);
        setError(event.data.error || 'Could not save this recording. Please try again.');
      }
    };
    window.addEventListener('message', handleHandoffResult);
    return () => window.removeEventListener('message', handleHandoffResult);
  }, [cloudRecordingPaths, sessionId]);

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
    setAudioCleanup(DEFAULT_AUDIO_CLEANUP);
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
            cameraZoomRef.current,
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
            cameraZoomRef.current,
          );
        }
        const introActive = elapsedMs < PODCAST_INTRO_DURATION_MS;
        if (!outroActiveRef.current && (!introActive || getPodcastLowerThirdStage(elapsedMs))) {
          drawPodcastBroadcastOverlays(
            context,
            canvas.width,
            canvas.height,
            elapsedMs,
            draft?.showName?.trim() || draft?.title || 'Podcast',
            draft?.topic?.trim() || '',
            hostNames,
            coverImageRef.current || logoImageRef.current,
            introActive,
          );
        }
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
      setIsRecoveryCopyAvailable(false);
      setIsSupabaseCopyAvailable(false);
      cloudOriginalSavedRef.current = false;
      updateHandoffBackupMetadata({
        supabaseOriginalSaved: false,
        supabaseRecordingSeconds: 0,
        supabaseLatestSaved: false,
        supabaseRenderSettings: undefined,
      });
      setSupabaseSyncNotice('A secure Supabase copy will be saved when this recording stops.');
      setRecoveryNotice('');
      setAudioPreset('original');
      setVideoPreset('original');
      setEffectsRendered(false);
      setRenderProgress(0);
      applyPreviewAudioPreset('original');
      setRecordingUrl('');
      setRecordingMediaDuration(0);
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('The browser could not finish encoding the recording. Try recording again.');
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        compositeVideoTrackRef.current?.stop();
        compositeVideoTrackRef.current = null;
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
        if (blob.size === 0) {
          recordingBlobRef.current = null;
          originalRecordingBlobRef.current = null;
          recordingStateRef.current = 'idle';
          setRecordingState('idle');
          setError('The browser produced an empty recording. Check camera access and try again.');
          return;
        }
        recordingStateRef.current = 'recorded';
        recordingBlobRef.current = blob;
        originalRecordingBlobRef.current = blob;
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingState('recorded');
        setIsPersistingRecording(true);
        setIsRecoveryCopyAvailable(false);
        setRecoveryNotice('Saving a recovery copy in this browser…');
        void (async () => {
          setSupabaseSyncNotice('Uploading the original recording to private Supabase storage…');
          const localSave = savePodcastRecordingRecovery(sessionId, blob, recordingSecondsRef.current)
            .then(() => {
              setIsRecoveryCopyAvailable(true);
              setRecoveryNotice('Recovery copy saved in this browser.');
            })
            .catch((recoveryError: unknown) => {
              console.error('Could not save a podcast recording recovery copy in this browser:', recoveryError);
              setRecoveryNotice('Could not save a browser recovery copy. Check the Supabase backup status below.');
            });
          const cloudSave = persistOriginalRecordingToSupabase(blob, recordingSecondsRef.current)
            .catch((uploadError: unknown) => {
              console.error('Could not save the original podcast recording to Supabase:', uploadError);
              setSupabaseSyncNotice(`Supabase upload failed: ${uploadError instanceof Error ? uploadError.message : 'Could not upload the original.'}`);
            });
          await Promise.all([localSave, cloudSave]);
          setIsPersistingRecording(false);
        })();
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
    setEffectsCancelled(false);
    updateHandoffBackupMetadata({
      supabaseLatestSaved: false,
      supabaseRenderSettings: undefined,
    });
    setSupabaseSyncNotice('Settings changed. The original remains backed up; completed renders sync automatically.');
    const originalBlob = originalRecordingBlobRef.current;
    if (!effectsRendered || !originalBlob) return;
    recordingBlobRef.current = originalBlob;
    setRecordingUrl(URL.createObjectURL(originalBlob));
    setEffectsRendered(false);
    setRenderStatus('');
  };

  const handleAudioPresetChange = (preset: ReelAudioPreset) => {
    if (isRenderingEffects || isSavingRecording) return;
    if (preset === audioPreset && (effectsRendered || (preset === 'original' && videoPreset === 'original'))) return;
    if (!applyPreviewAudioPreset(effectsRendered ? 'original' : preset)) return;
    restoreOriginalRecording();
    setAudioPreset(preset);
    setError('');
    if (preset !== 'original' || videoPreset !== 'original' || hasAudioProcessing) {
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
    if (audioPreset !== 'original' || preset !== 'original' || hasAudioProcessing) {
      void renderPodcastEffects(audioPreset, preset).catch((renderError: unknown) => {
        setError(renderError instanceof Error ? renderError.message : 'Could not render podcast effects.');
      });
    }
  };

  const handleAudioCleanupChange = <K extends keyof PodcastAudioCleanupOptions,>(
    key: K,
    value: PodcastAudioCleanupOptions[K],
  ) => {
    if (isRenderingEffects || isSavingRecording) return;
    const nextOptions = { ...audioCleanup, [key]: value };
    setAudioCleanup(nextOptions);
    restoreOriginalRecording();
  };

  const handleBackgroundAudioChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (isRenderingEffects || isSavingRecording) return;
    setBackgroundAudioUrl(event.target.value);
    setError('');
    restoreOriginalRecording();
  };

  const renderPodcastEffects = async (
    selectedAudioPreset: ReelAudioPreset = audioPreset,
    selectedVideoPreset: ReelVideoPreset = videoPreset,
    selectedAudioCleanup: PodcastAudioCleanupOptions = audioCleanup,
    selectedBackgroundAudioUrl: string = backgroundAudioUrl,
    selectedBackgroundAudioVolume = backgroundAudioVolume,
  ) => {
    const sourceBlob = originalRecordingBlobRef.current;
    if (!sourceBlob) throw new Error('Record a podcast before applying effects.');
    const shouldCleanAudio = selectedAudioCleanup.noiseGate
      || selectedAudioCleanup.declip
      || selectedAudioCleanup.declick
      || selectedAudioCleanup.trimSilence
      || selectedAudioCleanup.trimStartSeconds > 0
      || selectedAudioCleanup.trimEndSeconds > 0
      || selectedAudioCleanup.fadeOutSeconds > 0
      || Boolean(selectedBackgroundAudioUrl);
    const shouldRenderReel = selectedAudioPreset !== 'original' || selectedVideoPreset !== 'original';
    if (!shouldCleanAudio && !shouldRenderReel) {
      recordingBlobRef.current = sourceBlob;
      setRecordingUrl(URL.createObjectURL(sourceBlob));
      setEffectsRendered(false);
      setEffectsCancelled(false);
      return sourceBlob;
    }

    const renderController = new AbortController();
    renderAbortControllerRef.current = renderController;
    const { signal } = renderController;
    setIsRenderingEffects(true);
    setRenderProgress(0);
    setRenderStatus('Preparing selected effects…');
    setEffectsCancelled(false);
    try {
      let renderedBlob = sourceBlob;
      if (shouldCleanAudio) {
        let soundtrackFile: File | null = null;
        if (selectedBackgroundAudioUrl) {
          const soundtrack = PODCAST_SOUNDTRACKS.find((item) => item.url === selectedBackgroundAudioUrl);
          if (!soundtrack) throw new Error('The selected soundtrack is no longer available.');
          setRenderStatus('Loading the selected soundtrack…');
          setRenderProgress(2);
          const response = await fetch(soundtrack.url, { signal });
          if (!response.ok) throw new Error(`Could not load the selected soundtrack (${response.status}).`);
          soundtrackFile = new File([await response.blob()], `${soundtrack.name}.mp3`, { type: 'audio/mpeg' });
          if (signal.aborted) throw new Error('Rendering cancelled.');
        }
        renderedBlob = await renderPodcastAudioCleanup(
          sourceBlob,
          selectedAudioCleanup,
          (progress) => setRenderProgress(shouldRenderReel ? Math.round(progress * 0.6) : progress),
          soundtrackFile
            ? { file: soundtrackFile, volume: selectedBackgroundAudioVolume }
            : null,
          setRenderStatus,
          signal,
        );
      }

      if (shouldRenderReel) {
        setRenderStatus('Rendering video effects…');
        const sourceUrl = URL.createObjectURL(renderedBlob);
        try {
          renderedBlob = await renderCaptionedReel(
            sourceUrl,
            [],
            'classic',
            false,
            (progress) => setRenderProgress(shouldCleanAudio ? 60 + Math.round(progress * 0.4) : progress),
            { audioPreset: selectedAudioPreset, videoPreset: selectedVideoPreset },
            recordingSeconds,
            signal,
          );
        } finally {
          URL.revokeObjectURL(sourceUrl);
        }
      }

      await syncLatestRecordingToSupabase(renderedBlob, {
        audioPreset: selectedAudioPreset,
        videoPreset: selectedVideoPreset,
        audioCleanup: selectedAudioCleanup,
        backgroundAudioUrl: selectedBackgroundAudioUrl,
        backgroundAudioVolume: selectedBackgroundAudioVolume,
      });
      recordingBlobRef.current = renderedBlob;
      setRecordingUrl(URL.createObjectURL(renderedBlob));
      setEffectsRendered(true);
      setEffectsCancelled(false);
      setRenderStatus('Effects are ready to preview and save.');
      return renderedBlob;
    } catch (renderError) {
      if (signal.aborted) {
        recordingBlobRef.current = sourceBlob;
        setRecordingUrl(URL.createObjectURL(sourceBlob));
        setEffectsRendered(false);
        setEffectsCancelled(true);
        setRenderStatus('Rendering cancelled. The original recording is preserved; you can save it or retry.');
        setSupabaseSyncNotice('Rendering cancelled. Supabase keeps the original and the last completed render.');
        return sourceBlob;
      }
      setRenderStatus('Rendering failed.');
      throw renderError;
    } finally {
      if (renderAbortControllerRef.current === renderController) renderAbortControllerRef.current = null;
      setIsRenderingEffects(false);
    }
  };

  const cancelEffectRendering = () => {
    renderAbortControllerRef.current?.abort();
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
      if (
        (audioPreset !== 'original' || videoPreset !== 'original' || hasAudioProcessing)
        && !effectsRendered
        && !effectsCancelled
      ) {
        blob = await renderPodcastEffects();
      }
      setHandoffSaving(true);
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
            <label className="col-span-2 flex items-center gap-3 text-[10px] text-white/65">
              <span className="shrink-0">Camera framing</span>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={cameraZoom}
                aria-label="Camera framing zoom"
                onChange={(event) => {
                  const zoom = Number(event.target.value);
                  cameraZoomRef.current = zoom;
                  setCameraZoom(zoom);
                }}
                className="min-w-0 flex-1 accent-emerald-400"
              />
              <span className="w-10 shrink-0 text-right tabular-nums">{cameraZoom.toFixed(2)}×</span>
            </label>
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
              onLoadedMetadata={(event) => {
                const duration = event.currentTarget.duration;
                if (recordingUrl && Number.isFinite(duration) && duration > 0) {
                  setRecordingMediaDuration(duration);
                }
              }}
              onError={(event) => {
                if (!recordingUrl) return;
                const mediaErrorCode = event.currentTarget.error?.code;
                const source = effectsRendered ? 'processed recording' : 'original recording';
                const blob = recordingBlobRef.current;
                const details = blob ? ` ${blob.type || 'unknown format'}, ${blob.size} bytes.` : '';
                if (effectsRendered && originalRecordingBlobRef.current) {
                  const originalBlob = originalRecordingBlobRef.current;
                  recordingBlobRef.current = originalBlob;
                  setRecordingUrl(URL.createObjectURL(originalBlob));
                  setEffectsRendered(false);
                  setError(`The ${source} could not be decoded${mediaErrorCode ? ` (media error ${mediaErrorCode})` : ''}.${details} The original recording was restored; disable an effect or retry.`);
                  return;
                }
                setError(`The ${source} could not be decoded${mediaErrorCode ? ` (media error ${mediaErrorCode})` : ''}.${details} Record again and retry.`);
              }}
              style={{
                ...(recordingUrl && !effectsRendered ? { filter: getReelVideoFilter(videoPreset) } : {}),
                ...(!recordingUrl ? { transform: `scale(${cameraZoom})` } : {}),
              }}
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
                      style={index === 0 ? { transform: `scale(${cameraZoom})` } : undefined}
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
                  <h2 className="mt-2 text-xl font-bold">{draft.title}</h2>
                  <p className="mt-1 text-xs text-white/75">Thanks for watching</p>
                </div>
              </div>
            )}
            {(liveOverlayDecorationsVisible || liveLowerThirdVisible) && (
              <>
                {liveOverlayDecorationsVisible && showArtworkUrl && (
                  <img
                    src={showArtworkUrl}
                    alt=""
                    className="absolute right-3 top-3 z-20 h-14 w-[42px] rounded-md border border-white/45 bg-black/75 object-contain shadow-lg sm:h-[72px] sm:w-[54px]"
                  />
                )}
                {liveOverlayDecorationsVisible && liveLowerThirdStage?.stage !== 1 && (
                  <div className="absolute left-3 top-3 z-20 flex max-w-[68%] items-center gap-2 overflow-hidden rounded-md border border-white/20 bg-black/65 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm">
                    <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-300 sm:text-[9px]">Topic</span>
                    <span className="h-3 w-px shrink-0 bg-white/25" />
                    <span className="truncate text-[9px] font-medium sm:text-[11px]">{draft.topic?.trim() || 'Discussion topic'}</span>
                  </div>
                )}
                {liveLowerThirdVisible && (
                  <div className="absolute bottom-0 left-0 right-0 z-20 flex h-[14%] min-h-9 items-center gap-1.5 overflow-hidden border-t border-white/15 bg-gradient-to-r from-[#03100d]/90 via-[#050c0d]/85 to-[#080a0e]/90 px-2 text-white shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-700 ease-out sm:gap-3 sm:px-4">
                    <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-600 to-transparent" />
                    {showArtworkUrl ? (
                      <img src={showArtworkUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover ring-1 ring-white/25 sm:h-10 sm:w-10" />
                    ) : (
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-emerald-500 to-emerald-900 text-[9px] font-bold ring-1 ring-white/25 sm:h-10 sm:w-10 sm:text-[10px]">
                        {(draft.showName?.trim() || draft.title).split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'P'}
                      </div>
                    )}
                    <div key={liveLowerThirdStage?.stage} className="min-w-0 flex-1 animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-500 ease-out">
                      <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-emerald-300 sm:text-[9px]">
                        {liveLowerThirdStage?.stage === 0 ? 'Podcast' : liveLowerThirdStage?.stage === 1 ? 'Topic' : 'Host'}
                      </p>
                      <p className="truncate text-[9px] font-bold sm:text-xs">
                        {liveLowerThirdStage?.stage === 0
                          ? draft.showName?.trim() || draft.title
                          : liveLowerThirdStage?.stage === 1
                            ? draft.topic?.trim() || 'Discussion topic'
                            : introHostNames}
                      </p>
                    </div>
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
            <Button
              className="w-full gap-2 bg-red-600 text-white hover:bg-red-700"
              onClick={() => void startRecording()}
              disabled={isCheckingRecovery || isPersistingRecording || isRenderingEffects || isSavingRecording}
            >
              {recordingState === 'recorded' ? <RotateCcw className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              {isCheckingRecovery
                ? 'Checking for a saved take…'
                : isPersistingRecording
                  ? 'Saving original recording…'
                  : recordingState === 'recorded' ? 'Record again' : 'Start recording'}
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
            <p className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-white/55" aria-live="polite">
              {recoveryNotice || (isRecoveryCopyAvailable
                ? 'A recovery copy is saved in this browser. Browser storage can be cleared, so save your recording to a draft too.'
                : isSupabaseCopyAvailable
                  ? 'The original is backed up to Supabase. Browser recovery storage is not available for this take.'
                  : 'No recovery copy is available yet. Keep this page open or save your recording before refreshing.')}
            </p>
          )}
          {recordingState === 'recorded' && supabaseSyncNotice && (
            <p
              className={`rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed ${supabaseSyncNotice.toLowerCase().includes('failed') ? 'text-amber-200' : 'text-emerald-200/75'}`}
              aria-live="polite"
            >
              {supabaseSyncNotice}
            </p>
          )}
          {recordingState === 'recorded' && (
            <section className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3" aria-labelledby="podcast-effects-title">
              <div>
                <h2 id="podcast-effects-title" className="text-sm font-semibold text-white">Audio and video effects</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">Choose optional cleanup and a soundtrack, then apply or save.</p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                  Effects run locally in this browser using FFmpeg; the recording is not uploaded to a processing service.
                </p>
              </div>
              <MediaEnhancementTabs
                audioPreset={audioPreset}
                videoPreset={videoPreset}
                onAudioPresetChange={handleAudioPresetChange}
                onVideoPresetChange={handleVideoPresetChange}
                disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                accent="emerald"
              />
              <fieldset className="space-y-3 rounded-md border border-white/10 p-2.5">
                <legend className="px-1 text-[11px] font-medium text-white/75">Trim & fade</legend>
                <p className="text-[10px] leading-relaxed text-white/50">
                  Trim values remove time from the beginning or end of both video and audio. A fade softens the final audio, including background room noise.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[10px] text-white/65">
                    Trim from beginning (seconds)
                    <input
                      type="number"
                      min="0"
                      max={maximumTrimStart.toFixed(1)}
                      step="0.1"
                      value={audioCleanup.trimStartSeconds}
                      aria-label="Trim from beginning in seconds"
                      disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                      onChange={(event) => handleAudioCleanupChange(
                        'trimStartSeconds',
                        Math.min(maximumTrimStart, Math.max(0, Number(event.target.value) || 0)),
                      )}
                      className="h-8 w-full rounded border border-white/10 bg-[#111715] px-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-white/65">
                    Trim from end (seconds)
                    <input
                      type="number"
                      min="0"
                      max={maximumTrimEnd.toFixed(1)}
                      step="0.1"
                      value={audioCleanup.trimEndSeconds}
                      aria-label="Trim from end in seconds"
                      disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                      onChange={(event) => handleAudioCleanupChange(
                        'trimEndSeconds',
                        Math.min(maximumTrimEnd, Math.max(0, Number(event.target.value) || 0)),
                      )}
                      className="h-8 w-full rounded border border-white/10 bg-[#111715] px-2 text-white"
                    />
                  </label>
                </div>
                <p className="text-[10px] tabular-nums text-white/45">
                  Remaining: {formatTime(audioCleanup.trimStartSeconds)}–{formatTime(Math.max(audioCleanup.trimStartSeconds, recordingDurationForTrim - audioCleanup.trimEndSeconds))} ({keptRecordingDuration.toFixed(1)}s)
                </p>
                <label className="flex items-center gap-3 text-[10px] text-white/65">
                  Fade out last audio
                  <input
                    type="range"
                    min="0"
                    max={maximumFadeOut}
                    step="0.25"
                    value={Math.min(audioCleanup.fadeOutSeconds, maximumFadeOut)}
                    aria-label="Audio fade-out duration"
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording || maximumFadeOut === 0}
                    onChange={(event) => handleAudioCleanupChange('fadeOutSeconds', Number(event.target.value))}
                    className="min-w-0 flex-1 accent-emerald-400"
                  />
                  <span className="w-10 text-right tabular-nums">{Math.min(audioCleanup.fadeOutSeconds, maximumFadeOut).toFixed(2)}s</span>
                </label>
              </fieldset>
              <fieldset className="space-y-2 rounded-md border border-white/10 p-2.5">
                <legend className="px-1 text-[11px] font-medium text-white/75">Background soundtrack</legend>
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  <Music2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span className="shrink-0">Optional track</span>
                  <select
                    value={backgroundAudioUrl}
                    aria-label="Choose background soundtrack"
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                    onChange={handleBackgroundAudioChange}
                    className="h-8 min-w-0 flex-1 rounded border border-white/10 bg-[#111715] px-2 text-[10px] text-white"
                  >
                    <option value="">None — voice only</option>
                    {PODCAST_SOUNDTRACKS.map((soundtrack) => (
                      <option key={soundtrack.url} value={soundtrack.url}>{soundtrack.name}</option>
                    ))}
                  </select>
                </label>
                {backgroundAudioUrl && (
                  <>
                    <label className="flex items-center gap-3 pl-5 text-[10px] text-white/55">
                      Background volume
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={Math.round(backgroundAudioVolume * 100)}
                        aria-label="Background soundtrack volume"
                        disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                        onChange={(event) => {
                          setBackgroundAudioVolume(Number(event.target.value) / 100);
                          restoreOriginalRecording();
                        }}
                        className="min-w-0 flex-1 accent-emerald-400"
                      />
                      <span className="w-8 text-right tabular-nums">{Math.round(backgroundAudioVolume * 100)}%</span>
                    </label>
                    <p className="pl-5 text-[10px] text-white/45">Mixed under the voice after recording; shorter tracks repeat to fill the recording.</p>
                  </>
                )}
              </fieldset>
              <fieldset className="space-y-2 rounded-md border border-white/10 p-2.5">
                <legend className="px-1 text-[11px] font-medium text-white/75">Audio cleanup (runs in your browser)</legend>
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={audioCleanup.noiseGate}
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                    onChange={(event) => handleAudioCleanupChange('noiseGate', event.target.checked)}
                    className="accent-emerald-400"
                  />
                  Reduce background noise between speech
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={audioCleanup.declip}
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                    onChange={(event) => handleAudioCleanupChange('declip', event.target.checked)}
                    className="accent-emerald-400"
                  />
                  Repair clipped/distorted peaks
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={audioCleanup.declick}
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                    onChange={(event) => handleAudioCleanupChange('declick', event.target.checked)}
                    className="accent-emerald-400"
                  />
                  Reduce clicks and pops
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={audioCleanup.trimSilence}
                    disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                    onChange={(event) => handleAudioCleanupChange('trimSilence', event.target.checked)}
                    className="accent-emerald-400"
                  />
                  Remove long silent gaps (video stays in sync)
                </label>
                {audioCleanup.trimSilence && (
                  <label className="flex items-center gap-3 pl-6 text-[10px] text-white/55">
                    Silence longer than
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.25"
                      value={audioCleanup.minimumSilenceSeconds}
                      aria-label="Minimum silence to remove"
                      disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                      onChange={(event) => handleAudioCleanupChange('minimumSilenceSeconds', Number(event.target.value))}
                      className="min-w-0 flex-1 accent-emerald-400"
                    />
                    <span className="w-10 text-right tabular-nums">{audioCleanup.minimumSilenceSeconds.toFixed(2)}s</span>
                  </label>
                )}
              </fieldset>
              {hasAudioProcessing && !effectsRendered && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void renderPodcastEffects().catch((renderError: unknown) => {
                    setError(renderError instanceof Error ? renderError.message : 'Could not clean the podcast audio.');
                  })}
                  disabled={isRenderingEffects || isSavingRecording || isPersistingRecording}
                  className="w-full border-emerald-400/30 text-emerald-100"
                >
                  Apply audio changes
                </Button>
              )}
              <details className="text-[11px] text-white/45">
                <summary className="cursor-pointer text-white/60">Effect notes</summary>
                <p className="mt-1.5">The noise gate reduces steady noise in pauses, not under speech. De-clipping and click repair can reduce mild artifacts but cannot restore audio that was lost to severe distortion. Silence removal cuts long gaps and re-encodes the video to keep it synchronized. Voice clarity reduces low rumble; warm studio adds room ambience; video presets adjust light, contrast, and color.</p>
              </details>
              <p className="text-[10px] text-emerald-200/70" aria-live="polite">
                {isRenderingEffects
                  ? `${renderStatus || 'Rendering audio/video effects…'} ${renderProgress}%`
                  : effectsRendered
                    ? renderStatus || 'Selected effects rendered and ready to save.'
                    : effectsCancelled
                      ? renderStatus || 'Rendering cancelled. The original recording is preserved.'
                    : hasAudioProcessing
                      ? 'Apply audio changes, or save to render the selected effects.'
                      : 'Select a preset to render it automatically.'}
              </p>
              {isRenderingEffects && (
                <div className="space-y-2">
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
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-red-400/30 text-red-200"
                    onClick={cancelEffectRendering}
                    disabled={isSyncingSupabase}
                  >
                    {isSyncingSupabase ? 'Saving render to Supabase…' : 'Cancel rendering'}
                  </Button>
                  <p className="text-center text-[10px] text-white/45">
                    {isSyncingSupabase
                      ? 'The completed render is being saved privately; the original is already preserved.'
                      : 'Rendering may take a few minutes on slower devices. Cancelling keeps the original take.'}
                  </p>
                </div>
              )}
            </section>
          )}
          {recordingState === 'recorded' && (
            <Button className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => void saveAndLoadDraft()} disabled={handoffSaving || isSavingRecording || isRenderingEffects || isPersistingRecording}>
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