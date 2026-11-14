import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileVideo, Loader2, Mic2, Play, Save, Send, Trash2, Video, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import apiUrl from '@/lib/api';
import { readJsonResponse } from '@/lib/readJsonResponse';
import { supabase } from '@/integrations/supabase/client';
import { getPodcastStudioEligibility } from '@/lib/podcastStudioEligibility';

const PRIVATE_BUCKET = 'creator-podcast-drafts';
const SIGNED_ASSET_TTL_SECONDS = 12 * 60 * 60;

type PodcastDraft = {
  id: string;
  title: string;
  topic: string;
  target_duration_minutes: number;
  description: string;
  script: string;
  host_names: string;
  recording_path: string | null;
  cover_image_path: string | null;
  logo_image_path: string | null;
  intro_video_path: string | null;
  outro_video_path: string | null;
  status: 'draft' | 'pending_review' | 'changes_requested' | 'published';
  reviewer_notes: string | null;
  submitted_at: string | null;
};

type SavedDraft = Pick<
  PodcastDraft,
  'id' | 'title' | 'topic' | 'target_duration_minutes' | 'description' | 'script' | 'host_names'
  | 'recording_path' | 'cover_image_path' | 'logo_image_path' | 'intro_video_path' | 'outro_video_path'
>;

type ScriptResponse = { error?: string; script?: string };

type PendingRecording = {
  sessionId: string;
  draft: SavedDraft;
  paths: Omit<SavedDraft, 'id' | 'title' | 'topic' | 'target_duration_minutes' | 'description' | 'script' | 'host_names'>;
};

const createDraftId = () => globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (digit) => {
    const random = Math.random() * 16 | 0;
    return (digit === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });

const videoMetadata = (file: File) => new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    URL.revokeObjectURL(url);
    resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
  };
  video.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error(`Could not read the video dimensions for ${file.name}.`));
  };
  video.src = url;
});

export default function CreatorPodcastStudio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [drafts, setDrafts] = useState<PodcastDraft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [script, setScript] = useState('');
  const [hostNames, setHostNames] = useState('');
  const [duration, setDuration] = useState(10);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null);
  const [logoImagePath, setLogoImagePath] = useState<string | null>(null);
  const [introVideoPath, setIntroVideoPath] = useState<string | null>(null);
  const [outroVideoPath, setOutroVideoPath] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [introVideo, setIntroVideo] = useState<File | null>(null);
  const [outroVideo, setOutroVideo] = useState<File | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pendingRecordingRef = useRef<PendingRecording | null>(null);
  const recordingWindowRef = useRef<Window | null>(null);

  const loadDrafts = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: draftsError } = await supabase.from('creator_podcast_drafts')
      .select('id, title, topic, target_duration_minutes, description, script, host_names, recording_path, cover_image_path, logo_image_path, intro_video_path, outro_video_path, status, reviewer_notes, submitted_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });
    if (draftsError) throw draftsError;
    setDrafts((data || []) as PodcastDraft[]);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const [eligibility, pendingResult, approvedResult] = await Promise.all([
          getPodcastStudioEligibility(user.id),
          supabase.from('studio_show_applications')
            .select('id')
            .eq('applicant_id', user.id)
            .eq('status', 'pending')
            .limit(1),
          supabase.from('studio_show_applications')
            .select('id')
            .eq('applicant_id', user.id)
            .eq('status', 'approved')
            .limit(1),
        ]);
        if (!active) return;
        setEligible(eligibility.eligible);
        if (pendingResult.error) throw pendingResult.error;
        if (approvedResult.error) throw approvedResult.error;

        const hasPendingApplication = Boolean(pendingResult.data?.length);
        const hasApprovedApplication = Boolean(approvedResult.data?.length);
        setApplicationStatus(hasApprovedApplication ? 'approved' : hasPendingApplication ? 'pending' : 'none');
        await loadDrafts();
      } catch (loadError) {
        console.error('Could not load creator Podcast Studio:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load Podcast Studio.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [user, loadDrafts]);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  useEffect(() => () => recordingWindowRef.current?.close(), []);

  useEffect(() => {
    const handleRecordingSaved = async (event: MessageEvent) => {
      const message = event.data;
      const pending = pendingRecordingRef.current;
      if (
        !pending
        || !user
        || event.origin !== window.location.origin
        || event.source !== recordingWindowRef.current
        || message?.type !== 'NEXSQ_PODCAST_RECORDING_SAVED'
        || message.mode !== 'creator'
        || message.sessionId !== pending.sessionId
        || message.draftId !== pending.draft.id
        || message.ownerId !== user.id
        || !(message.recording instanceof Blob)
      ) return;

      let uploadedPath: string | null = null;
      let persisted = false;
      try {
        const extension = message.recording.type.includes('mp4') ? 'mp4' : 'webm';
        uploadedPath = `${user.id}/${pending.draft.id}/recording-${Date.now()}.${extension}`;
        const recording = new Blob([message.recording], { type: extension === 'mp4' ? 'video/mp4' : 'video/webm' });
        const { error: uploadError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .upload(uploadedPath, recording, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;

        const { error: saveError } = await supabase.rpc('save_creator_podcast_draft', {
          p_id: pending.draft.id,
          p_title: pending.draft.title,
          p_topic: pending.draft.topic,
          p_target_duration_minutes: pending.draft.target_duration_minutes,
          p_description: pending.draft.description,
          p_script: pending.draft.script,
          p_host_names: pending.draft.host_names,
          p_recording_path: uploadedPath,
          p_cover_image_path: pending.paths.cover_image_path,
          p_logo_image_path: pending.paths.logo_image_path,
          p_intro_video_path: pending.paths.intro_video_path,
          p_outro_video_path: pending.paths.outro_video_path,
        });
        if (saveError) throw saveError;
        persisted = true;

        event.source?.postMessage({
          type: 'NEXSQ_PODCAST_RECORDING_STORED',
          sessionId: pending.sessionId,
        }, { targetOrigin: window.location.origin } as WindowPostMessageOptions);
        window.localStorage.removeItem(`podcast-recording:${pending.sessionId}`);
        recordingWindowRef.current = null;
        pendingRecordingRef.current = null;
        setRecordingPath(uploadedPath);

        if (pending.paths.recording_path && pending.paths.recording_path !== uploadedPath) {
          const { error: cleanupError } = await supabase.storage
            .from(PRIVATE_BUCKET)
            .remove([pending.paths.recording_path]);
          if (cleanupError) console.error('Could not clean up the replaced podcast recording:', cleanupError);
        }
        try {
          await loadDrafts();
        } catch (refreshError) {
          console.error('Podcast recording saved but the draft list could not refresh:', refreshError);
        }
        toast({ title: 'Private podcast draft saved', description: 'It is not public until an administrator publishes it.' });
      } catch (saveError) {
        if (uploadedPath && !persisted) {
          const { error: cleanupError } = await supabase.storage.from(PRIVATE_BUCKET).remove([uploadedPath]);
          if (cleanupError) console.error('Could not clean up failed podcast recording upload:', cleanupError);
        }
        if (persisted) {
          console.error('Podcast recording is saved, but follow-up cleanup failed:', saveError);
        } else {
          event.source?.postMessage({
            type: 'NEXSQ_PODCAST_RECORDING_FAILED',
            sessionId: pending.sessionId,
            error: saveError instanceof Error ? saveError.message : 'Could not save this recording.',
          }, { targetOrigin: window.location.origin } as WindowPostMessageOptions);
        }
        toast({
          title: persisted ? 'Podcast draft saved' : 'Podcast draft could not be saved',
          description: persisted
            ? 'The recording is saved privately. Some cleanup or refresh could not finish.'
            : saveError instanceof Error ? saveError.message : 'Please try saving the recording again.',
          variant: persisted ? 'default' : 'destructive',
        });
      }
    };

    window.addEventListener('message', handleRecordingSaved);
    return () => window.removeEventListener('message', handleRecordingSaved);
  }, [user, toast, loadDrafts]);

  const resetEditor = () => {
    setDraftId(null);
    setTitle('');
    setTopic('');
    setDescription('');
    setScript('');
    setHostNames('');
    setDuration(10);
    setRecordingPath(null);
    setCoverImagePath(null);
    setLogoImagePath(null);
    setIntroVideoPath(null);
    setOutroVideoPath(null);
    setCoverImage(null);
    setLogoImage(null);
    setIntroVideo(null);
    setOutroVideo(null);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
  };

  const uploadAsset = async (file: File, id: string, name: string) => {
    const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
    const path = `${user?.id}/${id}/${name}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    return path;
  };

  const saveDraft = async (): Promise<PendingRecording['draft'] & PendingRecording['paths']> => {
    if (!user) throw new Error('Sign in before saving a podcast draft.');
    if (title.trim().length < 2) throw new Error('Enter a podcast title before saving.');
    const id = draftId || createDraftId();
    const nextCoverPath = coverImagePath;
    const nextLogoPath = logoImagePath;
    const nextIntroPath = introVideoPath;
    const nextOutroPath = outroVideoPath;
    const saved = {
      id,
      title: title.trim(),
      topic: topic.trim(),
      target_duration_minutes: duration,
      description: description.trim(),
      script,
      host_names: hostNames.trim(),
      recording_path: recordingPath,
      cover_image_path: nextCoverPath,
      logo_image_path: nextLogoPath,
      intro_video_path: nextIntroPath,
      outro_video_path: nextOutroPath,
    };
    const newPaths: string[] = [];
    try {
      if (coverImage) {
        saved.cover_image_path = await uploadAsset(coverImage, id, 'cover');
        newPaths.push(saved.cover_image_path);
      }
      if (logoImage) {
        saved.logo_image_path = await uploadAsset(logoImage, id, 'logo');
        newPaths.push(saved.logo_image_path);
      }
      if (introVideo) {
        saved.intro_video_path = await uploadAsset(introVideo, id, 'intro');
        newPaths.push(saved.intro_video_path);
      }
      if (outroVideo) {
        saved.outro_video_path = await uploadAsset(outroVideo, id, 'outro');
        newPaths.push(saved.outro_video_path);
      }
      const { error: saveError } = await supabase.rpc('save_creator_podcast_draft', {
        p_id: saved.id,
        p_title: saved.title,
        p_topic: saved.topic,
        p_target_duration_minutes: saved.target_duration_minutes,
        p_description: saved.description,
        p_script: saved.script,
        p_host_names: saved.host_names,
        p_recording_path: saved.recording_path,
        p_cover_image_path: saved.cover_image_path,
        p_logo_image_path: saved.logo_image_path,
        p_intro_video_path: saved.intro_video_path,
        p_outro_video_path: saved.outro_video_path,
      });
      if (saveError) throw saveError;
    } catch (saveError) {
      if (newPaths.length) {
        const { error: cleanupError } = await supabase.storage.from(PRIVATE_BUCKET).remove(newPaths);
        if (cleanupError) console.error('Could not clean up failed podcast asset uploads:', cleanupError);
      }
      throw saveError;
    }

    const replacedPaths = [
      coverImage ? coverImagePath : null,
      logoImage ? logoImagePath : null,
      introVideo ? introVideoPath : null,
      outroVideo ? outroVideoPath : null,
    ].filter((path): path is string => Boolean(path));
    if (replacedPaths.length) {
      const { error: cleanupError } = await supabase.storage.from(PRIVATE_BUCKET).remove(replacedPaths);
      if (cleanupError) console.error('Could not clean up replaced podcast assets:', cleanupError);
    }

    setDraftId(id);
    setCoverImagePath(saved.cover_image_path);
    setLogoImagePath(saved.logo_image_path);
    setIntroVideoPath(saved.intro_video_path);
    setOutroVideoPath(saved.outro_video_path);
    setCoverImage(null);
    setLogoImage(null);
    setIntroVideo(null);
    setOutroVideo(null);
    try {
      await loadDrafts();
    } catch (refreshError) {
      console.error('Podcast draft saved but the list could not refresh:', refreshError);
    }
    return saved;
  };

  const handleSaveDraft = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await saveDraft();
      toast({ title: 'Podcast draft saved privately' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this podcast draft.');
    } finally {
      setSaving(false);
    }
  };

  const generateScript = async () => {
    if (!topic.trim()) {
      setError('Enter a conversation topic first.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in to generate a podcast script.');
      const response = await fetch(apiUrl('/api/daily-podcast/script'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customCategory: 'Creator topic',
          customTopic: topic.trim(),
          hostNames: hostNames.trim() || 'Host 1, Host 2',
          showTitle: title.trim() || 'Creator Podcast',
          duration,
        }),
      });
      const result = await readJsonResponse<ScriptResponse>(response);
      if (!response.ok) throw new Error(result.error || `Could not generate a script (HTTP ${response.status}).`);
      setScript(result.script || '');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate a podcast script.');
    } finally {
      setGenerating(false);
    }
  };

  const signAsset = async (path: string | null) => {
    if (!path) return null;
    const { data, error: signError } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, SIGNED_ASSET_TTL_SECONDS);
    if (signError) throw signError;
    return data.signedUrl;
  };

  const startRecording = async () => {
    if (saving || !script.trim()) {
      setError('Add a script before opening the teleprompter.');
      return;
    }
    const recordingWindow = window.open('', 'NexSqPodcastRecording', 'popup=yes,width=1440,height=900,left=0,top=0');
    if (!recordingWindow) {
      setError('Allow popups for this site, then open the teleprompter again.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await saveDraft();
      const [coverUrl, logoUrl, introUrl, outroUrl] = await Promise.all([
        signAsset(saved.cover_image_path),
        signAsset(saved.logo_image_path),
        signAsset(saved.intro_video_path),
        signAsset(saved.outro_video_path),
      ]);
      const sessionId = createDraftId();
      const payload = {
        mode: 'creator',
        ownerId: user?.id,
        draftId: saved.id,
        title: saved.title,
        script: saved.script,
        hostNames: saved.host_names,
        duration: saved.target_duration_minutes,
        coverImageUrl: coverUrl,
        logoImageUrl: logoUrl,
        introVideoUrl: introUrl,
        outroVideoUrl: outroUrl,
        createdAt: Date.now(),
      };
      window.localStorage.setItem(`podcast-recording:${sessionId}`, JSON.stringify(payload));
      pendingRecordingRef.current = {
        sessionId,
        draft: saved,
        paths: {
          recording_path: saved.recording_path,
          cover_image_path: saved.cover_image_path,
          logo_image_path: saved.logo_image_path,
          intro_video_path: saved.intro_video_path,
          outro_video_path: saved.outro_video_path,
        },
      };
      recordingWindowRef.current = recordingWindow;
      recordingWindow.location.href = `/podcast-teleprompter/${sessionId}`;
    } catch (startError) {
      recordingWindow.close();
      setError(startError instanceof Error ? startError.message : 'Could not open the teleprompter.');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!draftId || !recordingPath || applicationStatus !== 'approved' || submitting) return;
    setSubmitting(true);
    setError('');
    const { error: submitError } = await supabase.rpc('submit_creator_podcast_draft', {
      p_draft_id: draftId,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    await loadDrafts();
    toast({ title: 'Podcast submitted for review', description: 'It will remain private until the NexSq team publishes it.' });
  };

  const loadDraft = async (draft: PodcastDraft) => {
    setDraftId(draft.id);
    setTitle(draft.title);
    setTopic(draft.topic);
    setDescription(draft.description);
    setScript(draft.script);
    setHostNames(draft.host_names);
    setDuration(draft.target_duration_minutes);
    setRecordingPath(draft.recording_path);
    setCoverImagePath(draft.cover_image_path);
    setLogoImagePath(draft.logo_image_path);
    setIntroVideoPath(draft.intro_video_path);
    setOutroVideoPath(draft.outro_video_path);
    setCoverImage(null);
    setLogoImage(null);
    setIntroVideo(null);
    setOutroVideo(null);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
    if (draft.recording_path) {
      const { data, error: signError } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .createSignedUrl(draft.recording_path, 60 * 60);
      if (signError) {
        setError(signError.message);
        return;
      }
      setRecordingUrl(data.signedUrl);
    }
  };

  const deleteDraft = async () => {
    if (!draftId) return;
    const paths = [recordingPath, coverImagePath, logoImagePath, introVideoPath, outroVideoPath]
      .filter((path): path is string => Boolean(path));
    const { error: deleteError } = await supabase.rpc('delete_creator_podcast_draft', {
      p_draft_id: draftId,
    });
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (paths.length) {
      const { error: cleanupError } = await supabase.storage.from(PRIVATE_BUCKET).remove(paths);
      if (cleanupError) {
        console.error('Could not clean up deleted podcast draft media:', cleanupError);
        toast({ title: 'Draft deleted, but some media could not be removed', description: cleanupError.message, variant: 'destructive' });
      }
    }
    resetEditor();
    await loadDrafts();
    toast({ title: 'Podcast draft deleted' });
  };

  const validateImage = (file: File, setFile: (value: File) => void) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Branding images must be 10 MB or smaller.');
      return;
    }
    setError('');
    setFile(file);
  };

  const validateCustomVideo = async (file: File, kind: 'intro' | 'outro') => {
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      setError('Choose a video file for the custom intro or outro.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('Intro and outro videos must be 500 MB or smaller.');
      return;
    }
    try {
      const metadata = await videoMetadata(file);
      if (metadata.width <= metadata.height) {
        throw new Error('TV show intros and outros must be landscape. Choose a landscape video.');
      }
      if (!Number.isFinite(metadata.duration)) throw new Error('Could not read the custom video duration.');
      if (kind === 'intro' && metadata.duration > 15) {
        throw new Error('Custom intro videos must be 15 seconds or shorter.');
      }
      if (kind === 'intro') setIntroVideo(file);
      else setOutroVideo(file);
      setError('');
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Could not validate this video.');
    }
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }

  if (!user || !eligible) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Button variant="ghost" onClick={() => navigate('/studio')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Studio</Button>
        <section className="rounded-xl border p-6">
          <h1 className="text-xl font-semibold">Podcast Studio is locked</h1>
          {error
            ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
            : <p className="mt-2 text-sm text-muted-foreground">A Studio channel needs at least 10 reels and 1 subscriber to use Podcast Studio.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 pb-20 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2" onClick={() => navigate('/studio')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Studio</Button>
          <h1 className="text-2xl font-bold">Creator Podcast Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a script, brand your intro and outro, then record in the landscape teleprompter.</p>
        </div>
        <Button variant="outline" onClick={resetEditor}>New podcast draft</Button>
      </header>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
        <p className="font-medium">Your drafts are private until the NexSq team publishes them.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {applicationStatus === 'approved'
            ? 'Your show application is approved. You can submit completed podcast drafts for admin review.'
            : applicationStatus === 'pending'
              ? 'Your show application is under review. You can prepare and save private drafts while you wait.'
              : 'You can prepare private drafts now. Apply for a TV show slot and wait for approval before submitting episodes.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <section className="space-y-5 rounded-xl border p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Podcast title
              <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Host name(s)
              <Input value={hostNames} onChange={(event) => setHostNames(event.target.value)} maxLength={120} placeholder="One or two presenters" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className="space-y-1.5 text-sm font-medium">
              Conversation topic
              <Input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="What should this episode explore?" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Target runtime
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {[10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void generateScript()} disabled={generating || !topic.trim()} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate from topic'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setScript('')} disabled={!script}>Clear script</Button>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">
            Podcast script
            <textarea value={script} onChange={(event) => setScript(event.target.value)} rows={18} maxLength={40000} placeholder="Generate a script from your topic or write your own." className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Episode description <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={1200} className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>

          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">Brand your system intro and outro</h2>
            <p className="text-xs text-muted-foreground">The system intro is 15 seconds and the system outro is 8 seconds. Add your artwork and logo, or upload prebuilt landscape video clips. Longer outro videos are trimmed to 8 seconds.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium">
                Cover image / banner
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && validateImage(event.target.files[0], setCoverImage)} />
                {coverImage && <span className="block truncate text-muted-foreground">{coverImage.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Show logo
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && validateImage(event.target.files[0], setLogoImage)} />
                {logoImage && <span className="block truncate text-muted-foreground">{logoImage.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Optional prebuilt intro video (max 15 seconds)
                <Input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => event.target.files?.[0] && void validateCustomVideo(event.target.files[0], 'intro')} />
                {introVideo && <span className="block truncate text-muted-foreground">{introVideo.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Optional prebuilt outro video (first 8 seconds used)
                <Input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => event.target.files?.[0] && void validateCustomVideo(event.target.files[0], 'outro')} />
                {outroVideo && <span className="block truncate text-muted-foreground">{outroVideo.name}</span>}
              </label>
            </div>
          </div>

          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save private draft
            </Button>
            <Button type="button" onClick={() => void startRecording()} disabled={saving || !script.trim()} className="gap-2 bg-red-700 text-white hover:bg-red-800">
              <Video className="h-4 w-4" />Open landscape teleprompter
            </Button>
            <Button type="button" variant="outline" onClick={() => void submitForReview()} disabled={!draftId || !recordingPath || applicationStatus !== 'approved' || submitting || drafts.find((draft) => draft.id === draftId)?.status === 'pending_review' || drafts.find((draft) => draft.id === draftId)?.status === 'published'} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit to admin
            </Button>
            {draftId && drafts.find((draft) => draft.id === draftId)?.status !== 'pending_review' && drafts.find((draft) => draft.id === draftId)?.status !== 'published' && (
              <Button type="button" variant="ghost" onClick={() => void deleteDraft()} className="gap-2 text-destructive"><Trash2 className="h-4 w-4" />Delete draft</Button>
            )}
          </div>

          {recordingUrl && <video src={recordingUrl} controls playsInline className="w-full rounded-lg bg-black" />}
          {recordingPath && !recordingUrl && <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileVideo className="h-4 w-4" />A recording is saved in this draft.</p>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">Your podcast drafts</h2>
            {drafts.length ? (
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <button key={draft.id} type="button" onClick={() => void loadDraft(draft)} className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${draft.id === draftId ? 'border-primary' : ''}`}>
                    <span className="block truncate text-sm font-medium">{draft.title}</span>
                    <span className="mt-1 block text-xs capitalize text-muted-foreground">{draft.status.replace('_', ' ')}</span>
                    {draft.reviewer_notes && <span className="mt-1 block text-xs text-amber-700">{draft.reviewer_notes}</span>}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Your saved recordings and scripts will appear here.</p>}
          </section>
          <section className="rounded-xl border bg-muted/20 p-4 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Mic2 className="h-4 w-4" />TV format guide</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">All TV episodes must be landscape (16:9). Hold your phone sideways when recording. Your saved recording remains private until an administrator approves and publishes it.</p>
          </section>
          {recordingPath && <div className="flex items-center gap-2 text-xs text-emerald-700"><Play className="h-3.5 w-3.5" />Recording saved privately</div>}
        </aside>
      </div>
    </main>
  );
}
