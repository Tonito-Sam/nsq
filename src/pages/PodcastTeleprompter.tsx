import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Mic, Pause, Play, RotateCcw, Save, Square, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  drawPodcastIntroFrame,
  drawPodcastOutroFrame,
  PODCAST_INTRO_DURATION_MS,
  PODCAST_OUTRO_DURATION_MS,
} from '@/utils/podcastIntroMontage';

type DraftPayload = {
  title: string;
  script: string;
  hostNames?: string;
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
  const [introMontageActive, setIntroMontageActive] = useState(false);
  const [introScene, setIntroScene] = useState(0);
  const [outroActive, setOutroActive] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [error, setError] = useState('');
  const prompterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);
  const recordingStateRef = useRef<RecordingState>('idle');
  const introElapsedMsRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const compositeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const introClipRef = useRef<HTMLVideoElement | null>(null);
  const outroClipRef = useRef<HTMLVideoElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const outroActiveRef = useRef(false);
  const outroStartedAtRef = useRef(0);
  const outroTimerRef = useRef<number | null>(null);

  const sections = draft ? parseSections(draft.script, draft.title) : [];
  const sectionCount = sections.length;
  const activeSectionBody = sections[activeSection]?.body || '';

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
          const [eligibilityResult, draftResult] = await Promise.all([
            supabase.rpc('creator_can_use_podcast_studio'),
            supabase.from('creator_podcast_drafts')
              .select('id, status')
              .eq('id', parsedDraft.draftId)
              .eq('owner_id', user.id)
              .maybeSingle(),
          ]);
          if (eligibilityResult.error) throw eligibilityResult.error;
          if (draftResult.error) throw draftResult.error;
          if (!eligibilityResult.data || !draftResult.data || !['draft', 'changes_requested'].includes(draftResult.data.status)) {
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
    } else if (streamRef.current) {
      video.src = '';
      video.srcObject = streamRef.current;
      video.controls = false;
      video.muted = true;
      void video.play().catch(() => undefined);
    }
  }, [authorized, recordingUrl]);

  useEffect(() => {
    if (recordingState !== 'recording') return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recordingState]);

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
            setScrolling(false);
            if (!outroActiveRef.current) {
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
              outroTimerRef.current = window.setTimeout(() => {
                outroActiveRef.current = false;
                setOutroActive(false);
                const recorder = recorderRef.current;
                if (recorder && recorder.state !== 'inactive') recorder.stop();
              }, PODCAST_OUTRO_DURATION_MS);
            }
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
  }, [scrolling, scrollSpeed, activeSection, activeSectionBody, authorized, recordingState, sectionCount]);

  useEffect(() => {
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
    if (draft) setScrolling(true);
  }, [activeSection, draft]);

  useEffect(() => () => {
    recorderRef.current?.stop();
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

  const ensureCamera = async () => {
    let stream = streamRef.current;
    if (!stream) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone recording are not supported in this browser.');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
        audio: true,
      });
      streamRef.current = stream;
    }

    const video = previewRef.current;
    if (video && video.srcObject !== stream) {
      video.pause();
      video.removeAttribute('src');
      video.srcObject = stream;
      video.controls = false;
      video.muted = true;
      await video.play().catch(() => undefined);
    }
    return stream;
  };

  const startRecording = async () => {
    setError('');
    try {
      const cameraStream = await ensureCamera();
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
      if (introClip || outroClip) {
        const AudioContextConstructor = window.AudioContext;
        if (!AudioContextConstructor) throw new Error('Custom intro/outro audio is not supported in this browser.');
        const audioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        const audioDestination = audioContext.createMediaStreamDestination();
        audioContext.createMediaStreamSource(new MediaStream(audioTracks)).connect(audioDestination);
        [introClip, outroClip].forEach((clip) => {
          if (clip) audioContext.createMediaElementSource(clip).connect(audioDestination);
        });
        await audioContext.resume();
        outputAudioTracks = audioDestination.stream.getAudioTracks();
        if (introClip) await introClip.play();
      }

      compositeVideoTrackRef.current = compositeVideoTrack;
      const recordingStream = new MediaStream([compositeVideoTrack, ...outputAudioTracks]);

      let elapsedMs = 0;
      let previousFrameTime = performance.now();
      let previousScene = -1;
      let introEnded = false;
      const hostNames = draft?.hostNames?.trim() || 'Your host';
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
        if (outroActiveRef.current) {
          const outro = outroClipRef.current;
          if (outro && outro.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            drawVideoCover(context, outro, canvas.width, canvas.height);
          } else {
            drawPodcastOutroFrame(context, canvas.width, canvas.height, performance.now() - outroStartedAtRef.current, title, hostNames, coverImageRef.current, logoImageRef.current);
          }
        } else {
          const intro = introClipRef.current;
          const introIsPlaying = elapsedMs < PODCAST_INTRO_DURATION_MS
            && intro
            && !intro.ended
            && intro.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
          if (introIsPlaying) {
            drawVideoCover(context, intro, canvas.width, canvas.height);
          } else {
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
            );
          }
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
        recordingBlobRef.current = blob;
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingState('recorded');
      };
      recorderRef.current = recorder;
      setActiveSection(0);
      setScrolling(true);
      recorder.start(1000);
      setRecordingState('recording');
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
      setIntroMontageActive(false);
      setScrolling(false);
      setError(recordingError instanceof Error ? recordingError.message : 'Could not start camera and microphone recording.');
    }
  };

  const stopRecording = () => {
    setScrolling(false);
    outroActiveRef.current = false;
    setOutroActive(false);
    if (outroTimerRef.current !== null) window.clearTimeout(outroTimerRef.current);
    outroTimerRef.current = null;
    introClipRef.current?.pause();
    outroClipRef.current?.pause();
    recordingStateRef.current = 'paused';
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const saveAndLoadDraft = () => {
    const blob = recordingBlobRef.current;
    if (!blob || !draft) return;
    if (!window.opener || window.opener.closed) {
      setError('The Podcast Studio window is no longer available. Keep this recording open and return to Podcast Studio to reopen the session.');
      return;
    }
    if (draft.mode === 'creator') setHandoffSaving(true);
    window.opener.postMessage({
      type: 'NEXSQ_PODCAST_RECORDING_SAVED',
      sessionId,
      mode: draft.mode || 'admin',
      ownerId: draft.ownerId,
      draftId: draft.draftId,
      title: draft.title,
      script: draft.script,
      hostNames: draft.hostNames,
      recording: blob,
      fileName: `${draft.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'podcast'}-${Date.now()}.webm`,
    }, window.location.origin);
    if (draft.mode !== 'creator') {
      localStorage.removeItem(handoffKey(sessionId));
      window.close();
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
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
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
            <video ref={previewRef} autoPlay playsInline className="h-full w-full object-cover" />
            {introMontageActive && (
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
                  <p className="mt-2 text-xs text-white/75">Hosted by {draft.hostNames?.trim() || 'Your host'}</p>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-1000"
                    style={{ width: `${((introScene + 1) / introPreviewBackgrounds.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {outroActive && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-[#07110f]/85 text-center">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300">NexSq Podcast · Outro</p>
                  <h2 className="mt-2 text-xl font-bold">{draft.title}</h2>
                  <p className="mt-1 text-xs text-white/75">Thanks for watching</p>
                </div>
              </div>
            )}
            {!streamRef.current && !recordingUrl && <div className="absolute inset-0 grid place-items-center text-center text-sm text-white/45"><Video className="mb-2 h-6 w-6" />Camera preview</div>}
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-xs text-white/65">
            <span className="flex items-center gap-2"><Mic className="h-4 w-4 text-emerald-300" />Camera + microphone</span>
            <span className="tabular-nums">{formatTime(recordingSeconds)}</span>
          </div>
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
              <Button variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={stopRecording}><Square className="h-4 w-4" />Stop</Button>
            </div>
          )}
          {recordingState === 'recorded' && (
            <Button className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" onClick={saveAndLoadDraft} disabled={handoffSaving}>
              {handoffSaving ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {handoffSaving ? 'Saving private draft…' : draft.mode === 'creator' ? 'Save recording to private draft' : 'Save & load into show draft'}
            </Button>
          )}
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
          <p className="mt-auto text-xs leading-relaxed text-white/40">TV output is always landscape 16:9. Hold your phone sideways. Recording starts with a 15-second intro and ends with an 8-second outro, then stays in this browser until saved.</p>
        </aside>
      </div>
    </main>
  );
}