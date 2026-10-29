import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Mic, Pause, Play, RotateCcw, Save, Square, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type DraftPayload = { title: string; script: string };
type ScriptSection = { heading: string; body: string };
type RecordingState = 'idle' | 'recording' | 'paused' | 'recorded';

const handoffKey = (sessionId: string) => `podcast-recording:${sessionId}`;

function parseSections(script: string): ScriptSection[] {
  const sections: ScriptSection[] = [];
  let heading = '';
  let lines: string[] = [];

  script.split(/\r?\n/).forEach((line) => {
    const isHeading = /^(OPENING|SEGMENT \d+:.*|CLOSING)$/.test(line.trim());
    if (isHeading) {
      if (heading) sections.push({ heading, body: lines.join('\n').trim() });
      heading = line.trim();
      lines = [];
    } else if (heading) {
      lines.push(line);
    }
  });

  if (heading) sections.push({ heading, body: lines.join('\n').trim() });
  return sections.length ? sections : [{ heading: 'Rundown', body: script.trim() }];
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

export default function PodcastTeleprompter() {
  const { sessionId = '' } = useParams();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [scrolling, setScrolling] = useState(true);
  const [scrollSpeed, setScrollSpeed] = useState(18);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [error, setError] = useState('');
  const prompterRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingBlobRef = useRef<Blob | null>(null);

  const sections = draft ? parseSections(draft.script) : [];

  useEffect(() => {
    let active = true;
    const verifyAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Sign in with an admin account before opening the recording desk.');
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('privilege')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!['admin', 'superadmin'].includes(profile?.privilege || '')) {
          throw new Error('The recording desk is available to Studio administrators only.');
        }
        if (active) setAuthorized(true);
      } catch (accessError) {
        if (active) setError(accessError instanceof Error ? accessError.message : 'Could not verify admin access.');
      } finally {
        if (active) setCheckingAccess(false);
      }
    };

    verifyAdmin();

    if (sessionId) {
      try {
        const storedDraft = localStorage.getItem(handoffKey(sessionId));
        if (storedDraft) {
          setDraft(JSON.parse(storedDraft) as DraftPayload);
          localStorage.removeItem(handoffKey(sessionId));
        } else {
          setError('This recording session has expired. Return to the newsroom and open the teleprompter again.');
        }
      } catch {
        setError('Could not load the podcast script for this recording session.');
      }
    }

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
    let previousTime = 0;
    const scroll = (time: number) => {
      if (previousTime) container.scrollTop += ((time - previousTime) / 1000) * scrollSpeed;
      previousTime = time;
      if (container.scrollTop + container.clientHeight < container.scrollHeight - 1) {
        frame = window.requestAnimationFrame(scroll);
      } else {
        setScrolling(false);
      }
    };
    frame = window.requestAnimationFrame(scroll);
    return () => window.cancelAnimationFrame(frame);
  }, [scrolling, scrollSpeed, activeSection, authorized]);

  useEffect(() => {
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
    if (draft) setScrolling(true);
  }, [activeSection, draft]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!recordingUrl) return;
    return () => URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

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
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone recording are not supported in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      await previewRef.current.play().catch(() => undefined);
    }
    return stream;
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await ensureCamera();
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingBlobRef.current = null;
      setRecordingUrl('');
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        recordingBlobRef.current = blob;
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingState('recorded');
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setRecordingState('recording');
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : 'Could not start camera and microphone recording.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const saveAndLoadDraft = () => {
    const blob = recordingBlobRef.current;
    if (!blob || !draft) return;
    if (!window.opener || window.opener.closed) {
      setError('The newsroom window is no longer available. Keep this recording open and return to the newsroom to reopen the session.');
      return;
    }
    window.opener.postMessage({
      type: 'NEXSQ_PODCAST_RECORDING_SAVED',
      sessionId,
      title: draft.title,
      script: draft.script,
      recording: blob,
      fileName: `${draft.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'podcast'}-${Date.now()}.webm`,
    }, window.location.origin);
    window.close();
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
              <Button variant="outline" className="gap-2" onClick={() => {
                const recorder = recorderRef.current;
                if (!recorder) return;
                if (recorder.state === 'recording') { recorder.pause(); setRecordingState('paused'); }
                else if (recorder.state === 'paused') { recorder.resume(); setRecordingState('recording'); }
              }}>
                {recordingState === 'recording' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {recordingState === 'recording' ? 'Pause' : 'Resume'}
              </Button>
              <Button variant="outline" className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={stopRecording}><Square className="h-4 w-4" />Stop</Button>
            </div>
          )}
          {recordingState === 'recorded' && (
            <Button className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" onClick={saveAndLoadDraft}>
              <Save className="h-4 w-4" />Save & load into show draft
            </Button>
          )}
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
          <p className="mt-auto text-xs leading-relaxed text-white/40">The recording stays in this browser until you save it to the show draft. Camera and microphone access are required.</p>
        </aside>
      </div>
    </main>
  );
}