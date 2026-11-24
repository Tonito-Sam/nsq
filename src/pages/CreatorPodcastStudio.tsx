import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, CalendarDays, CircleStop, Download, DollarSign, Facebook, FileVideo, ImagePlus, Instagram, Loader2, MessageCircle, Mic2, Pencil, Play, Plus, RotateCcw, Save, Scissors, Settings, Share2, Trash2, UserRound, Video, Wand2 } from 'lucide-react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Header } from '@/components/Header';
import { PodcastEpisodeCard } from '@/components/podcast/PodcastEpisodeCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import apiUrl from '@/lib/api';
import { readJsonResponse } from '@/lib/readJsonResponse';
import { supabase } from '@/integrations/supabase/client';
import { getPodcastStudioEligibility } from '@/lib/podcastStudioEligibility';
import { buildPodcastBrandedOutro, buildPodcastVoiceoverIntro } from '@/utils/podcastVoiceoverIntro';
import { getNextPodcastBroadcastSlot, PODCAST_INTRO_DURATION_MS } from '@/utils/podcastIntroMontage';
import { PODCAST_SOUNDTRACKS } from '@/utils/podcastSoundtracks';
import { type ReelAudioPreset } from '@/utils/animatedReelCaptions';
import { insertSharedFeedPost, insertVideoMoment } from '@/lib/feedShare';
import {
  extractPodcastShorts,
  PODCAST_SHORT_COUNT,
  PODCAST_SHORT_DURATION_SECONDS,
  type PodcastShortsProgressPhase,
} from '@/utils/podcastShorts';

const PRIVATE_BUCKET = 'creator-podcast-drafts';
const SIGNED_ASSET_TTL_SECONDS = 12 * 60 * 60;
const PODCAST_COVER_ASPECT = 16 / 7;
const VOICE_EFFECTS: { value: ReelAudioPreset; label: string }[] = [
  { value: 'original', label: 'Original voice' },
  { value: 'voice-clarity', label: 'Voice clarity' },
  { value: 'warm-studio', label: 'Warm studio' },
  { value: 'bass-boost', label: 'Bass boost' },
  { value: 'volume-boost', label: 'Volume boost' },
];
type PodcastShortShareTarget = 'facebook' | 'instagram' | 'whatsapp' | 'whatsapp-status';

type PodcastDraft = {
  id: string;
  show_id: string | null;
  episode_id: string | null;
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

type PodcastEpisode = {
  id: string;
  show_id: string;
  title: string;
  topic: string | null;
  host_names: string | null;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number;
  created_at: string;
  scheduled_time: string | null;
  views: number | null;
  shares: number | null;
  likes: number | null;
  is_active: boolean;
};

type PodcastRevenueOrder = {
  id: string;
  invoice_number: string;
  order_number: string;
  podcast_name: string;
  gross_amount: number;
  platform_fee_amount: number;
  creator_net_amount: number;
  currency: string;
  service_period_start: string;
  service_period_end: string;
  paid_at: string;
};

type PodcastRevenueSummary = {
  paid_orders: number;
  unique_subscribers: number;
  gross_revenue: number;
  platform_fees: number;
  creator_earnings: number;
  last_30_days_net: number;
};

type GeneratedPodcastShort = {
  id: string;
  episodeId: string;
  episodeTitle: string;
  index: number;
  startSeconds: number;
  durationSeconds: number;
  storagePath: string;
  videoUrl: string;
  previewUrl: string;
  caption: string;
  publishedVideoId: string | null;
};

type SavedPodcastShort = {
  id: string;
  episode_id: string;
  episode_title: string;
  clip_index: number;
  storage_path: string;
  caption: string;
  start_seconds: number;
  duration_seconds: number;
  published_video_id: string | null;
};

type PodcastShortSaveRow = {
  owner_id: string;
  show_id: string;
  episode_id: string;
  episode_title: string;
  clip_index: number;
  storage_path: string;
  caption: string;
  start_seconds: number;
  duration_seconds: number;
  published_video_id: null;
};

type PodcastShowBrand = {
  id: string;
  title: string;
  description: string;
  category: string;
  podcastName: string | null;
  podcastDescription: string | null;
  subscriptionMode: 'free' | 'paid';
  subscriptionPrice: number;
  podcastCoverUrl: string | null;
  podcastLogoUrl: string | null;
  podcastIntroUrl: string | null;
  podcastOutroUrl: string | null;
  brandColor: string | null;
  broadcastDays?: string[] | null;
  timeSlotStart?: string | null;
  timeSlotEnd?: string | null;
  timeZone?: string | null;
};

type PodcastShowUpdate = Partial<{
  cover_url: string | null;
  logo_url: string | null;
  intro_url: string | null;
  outro_url: string | null;
  podcast_name: string;
  podcast_description: string;
  subscription_mode: 'free' | 'paid';
  subscription_price: number;
}>;

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

const createCroppedCoverFile = async (imageUrl: string, cropArea: Area) => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Could not load the selected cover image.'));
    element.src = imageUrl;
  });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the cropped cover image.');

  canvas.width = 1600;
  canvas.height = Math.round(canvas.width / PODCAST_COVER_ASPECT);
  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Could not export the cropped cover image.')),
      'image/jpeg',
      0.9,
    );
  });
  return new File([blob], 'podcast-cover.jpg', { type: 'image/jpeg' });
};

const createDraftId = () => globalThis.crypto?.randomUUID?.()
  || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (digit) => {
    const random = Math.random() * 16 | 0;
    return (digit === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });

const getManagedBroadcastAssetPath = (
  assetUrl: string,
  kind: 'intro' | 'outro',
  ownerId: string,
  showId: string,
) => {
  try {
    const publicBucketPath = '/storage/v1/object/public/studio-videos/';
    const pathname = new URL(assetUrl).pathname;
    const bucketPathIndex = pathname.indexOf(publicBucketPath);
    if (bucketPathIndex < 0) return null;
    const storagePath = decodeURIComponent(pathname.slice(bucketPathIndex + publicBucketPath.length));
    const expectedPrefix = `${ownerId}/podcast-shows/${showId}/broadcast/${kind}-`;
    return storagePath.startsWith(expectedPrefix) ? storagePath : null;
  } catch {
    return null;
  }
};

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

const resolvePodcastVideoUrl = async (videoUrl: string) => {
  const privatePrefix = 'podcast-private://';
  if (!videoUrl.startsWith(privatePrefix)) return videoUrl;
  const assetPath = videoUrl.slice(privatePrefix.length);
  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(assetPath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

const toLocalDateTimeInput = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const formatClipTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const formatPodcastMoney = (amount: number, currency = 'USD') => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency,
}).format(Number(amount) || 0);

const formatPodcastDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const getPodcastErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    const code = 'code' in error && typeof error.code === 'string' ? `Code: ${error.code}` : '';
    return [error.message, details, hint, code].filter(Boolean).join('\n');
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

const toGeneratedPodcastShort = (short: SavedPodcastShort): GeneratedPodcastShort => {
  const videoUrl = supabase.storage.from('studio-videos').getPublicUrl(short.storage_path).data.publicUrl;
  return {
    id: short.id,
    episodeId: short.episode_id,
    episodeTitle: short.episode_title,
    index: short.clip_index,
    startSeconds: short.start_seconds,
    durationSeconds: short.duration_seconds,
    storagePath: short.storage_path,
    videoUrl,
    previewUrl: videoUrl,
    caption: short.caption,
    publishedVideoId: short.published_video_id,
  };
};

export default function CreatorPodcastStudio({
  embedded = false,
  show,
  onPodcastBrandUpdated,
}: {
  embedded?: boolean;
  show?: PodcastShowBrand;
  onPodcastBrandUpdated?: (updatedBrand: PodcastShowUpdate) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [embeddedPodcastTab, setEmbeddedPodcastTab] = useState<'episodes' | 'pshorts' | 'revenue' | 'create' | 'settings'>('episodes');
  const [applicationStatus, setApplicationStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const [drafts, setDrafts] = useState<PodcastDraft[]>([]);
  const [publishedEpisodes, setPublishedEpisodes] = useState<PodcastEpisode[]>([]);
  const [updatingPublishedEpisodeId, setUpdatingPublishedEpisodeId] = useState<string | null>(null);
  const [podcastRevenueOrders, setPodcastRevenueOrders] = useState<PodcastRevenueOrder[]>([]);
  const [podcastRevenueSummary, setPodcastRevenueSummary] = useState<PodcastRevenueSummary | null>(null);
  const [loadingPodcastRevenue, setLoadingPodcastRevenue] = useState(false);
  const [podcastRevenueError, setPodcastRevenueError] = useState('');
  const [generatedPshorts, setGeneratedPshorts] = useState<GeneratedPodcastShort[]>([]);
  const [generatingPshortEpisodeId, setGeneratingPshortEpisodeId] = useState<string | null>(null);
  const [episodeToReextract, setEpisodeToReextract] = useState<PodcastEpisode | null>(null);
  const [pshortToDelete, setPshortToDelete] = useState<GeneratedPodcastShort | null>(null);
  const [deletingPshortId, setDeletingPshortId] = useState<string | null>(null);
  const [loadingSavedPshorts, setLoadingSavedPshorts] = useState(false);
  const [pshortGenerationProgress, setPshortGenerationProgress] = useState(0);
  const [pshortProgressPhase, setPshortProgressPhase] = useState<PodcastShortsProgressPhase>('extracting');
  const [pshortScanSeconds, setPshortScanSeconds] = useState(0);
  const [pshortModelProgress, setPshortModelProgress] = useState(0);
  const [sharePshortsToFeed, setSharePshortsToFeed] = useState(false);
  const [sharePshortsToMoments, setSharePshortsToMoments] = useState(false);
  const [publishingPshortIds, setPublishingPshortIds] = useState<string[]>([]);
  const [publishedPshortIds, setPublishedPshortIds] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [script, setScript] = useState('');
  const [hostNames, setHostNames] = useState('');
  const [defaultHostName, setDefaultHostName] = useState('');
  const [loadedShow, setLoadedShow] = useState<PodcastShowBrand>();
  const [broadcastTab, setBroadcastTab] = useState<'create' | 'saved'>('create');
  const [editingBroadcastDefault, setEditingBroadcastDefault] = useState<'intro' | 'outro' | null>(null);
  const [broadcastDefaultToDelete, setBroadcastDefaultToDelete] = useState<'intro' | 'outro' | null>(null);
  const [deletingBroadcastDefault, setDeletingBroadcastDefault] = useState<'intro' | 'outro' | null>(null);
  const [duration, setDuration] = useState(10);
  const [releaseMode, setReleaseMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledPremiere, setScheduledPremiere] = useState('');
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null);
  const [logoImagePath, setLogoImagePath] = useState<string | null>(null);
  const [introVideoPath, setIntroVideoPath] = useState<string | null>(null);
  const [outroVideoPath, setOutroVideoPath] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [introVideo, setIntroVideo] = useState<File | null>(null);
  const [outroVideo, setOutroVideo] = useState<File | null>(null);
  const [outroAudio, setOutroAudio] = useState<File | null>(null);
  const [introVoiceover, setIntroVoiceover] = useState<File | null>(null);
  const [introVoiceoverNeedsBuild, setIntroVoiceoverNeedsBuild] = useState(false);
  const [introVoiceoverUrl, setIntroVoiceoverUrl] = useState('');
  const [introVideoPreviewUrl, setIntroVideoPreviewUrl] = useState('');
  const [outroVideoPreviewUrl, setOutroVideoPreviewUrl] = useState('');
  const [outroAudioPreviewUrl, setOutroAudioPreviewUrl] = useState('');
  const [selectedSoundtrackUrl, setSelectedSoundtrackUrl] = useState(PODCAST_SOUNDTRACKS[0]?.url || '');
  const [soundtrackVolume, setSoundtrackVolume] = useState(18);
  const [voiceoverVolume, setVoiceoverVolume] = useState(100);
  const [voiceEffect, setVoiceEffect] = useState<ReelAudioPreset>('original');
  const [recordingVoiceover, setRecordingVoiceover] = useState(false);
  const [recordingOutroAudio, setRecordingOutroAudio] = useState(false);
  const [buildingIntro, setBuildingIntro] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [savingArtwork, setSavingArtwork] = useState<'banner_url' | 'logo_url' | null>(null);
  const [savingBroadcastDefaults, setSavingBroadcastDefaults] = useState(false);
  const [buildingOutro, setBuildingOutro] = useState(false);
  const [podcastName, setPodcastName] = useState('');
  const [podcastDescription, setPodcastDescription] = useState('');
  const [subscriptionMode, setSubscriptionMode] = useState<'free' | 'paid'>('free');
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [savingPodcastSettings, setSavingPodcastSettings] = useState(false);
  const [bannerCropImage, setBannerCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processingCover, setProcessingCover] = useState(false);
  const pendingRecordingRef = useRef<PendingRecording | null>(null);
  const recordingWindowRef = useRef<Window | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerCropImageUrlRef = useRef<string | null>(null);
  const introEditorRef = useRef<HTMLDetailsElement>(null);
  const outroEditorRef = useRef<HTMLElement>(null);
  const introVoiceRecorderRef = useRef<MediaRecorder | null>(null);
  const introVoiceStreamRef = useRef<MediaStream | null>(null);
  const introVoiceChunksRef = useRef<Blob[]>([]);
  const introVoiceStopTimerRef = useRef<number | null>(null);
  const outroAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const outroAudioStreamRef = useRef<MediaStream | null>(null);
  const outroAudioChunksRef = useRef<Blob[]>([]);
  const outroAudioStopTimerRef = useRef<number | null>(null);
  const outroAudioInputRef = useRef<HTMLInputElement>(null);
  const discardOutroAudioRecordingRef = useRef(false);
  const soundtrackPreviewRef = useRef<HTMLAudioElement>(null);
  const voiceoverPreviewRef = useRef<HTMLAudioElement>(null);
  const activeShow = show || loadedShow;
  const podcastShowId = activeShow?.id;
  const podcastDisplayName = activeShow?.podcastName?.trim() || activeShow?.title?.trim() || 'Podcast channel';
  const publishedEpisodeIdsKey = publishedEpisodes.map((episode) => episode.id).join(',');

  useEffect(() => {
    let active = true;
    const loadSavedPshorts = async () => {
      const episodeIds = publishedEpisodeIdsKey.split(',').filter(Boolean);
      if (!user?.id || !episodeIds.length) {
        setGeneratedPshorts([]);
        setPublishedPshortIds([]);
        setLoadingSavedPshorts(false);
        return;
      }

      setLoadingSavedPshorts(true);
      const { data, error: savedShortsError } = await supabase
        .from('creator_podcast_podshorts')
        .select('id, episode_id, episode_title, clip_index, storage_path, caption, start_seconds, duration_seconds, published_video_id')
        .in('episode_id', episodeIds)
        .order('episode_id')
        .order('clip_index');
      if (!active) return;
      if (savedShortsError) {
        console.error('Could not load saved Podshorts:', savedShortsError);
        toast({
          title: 'Could not load saved Podshorts',
          description: savedShortsError.message,
          variant: 'destructive',
        });
      } else {
        const savedShorts = (data || []) as SavedPodcastShort[];
        const generatedShorts = savedShorts.map(toGeneratedPodcastShort);
        setGeneratedPshorts(generatedShorts);
        setPublishedPshortIds(generatedShorts.flatMap((short) => (
          short.publishedVideoId ? [short.id] : []
        )));
      }
      setLoadingSavedPshorts(false);
    };

    void loadSavedPshorts();
    return () => { active = false; };
  }, [publishedEpisodeIdsKey, toast, user?.id]);

  useEffect(() => {
    setPodcastName(activeShow?.podcastName || '');
    setPodcastDescription(activeShow?.podcastDescription || '');
    setSubscriptionMode(activeShow?.subscriptionMode || 'free');
    setSubscriptionPrice(activeShow?.subscriptionPrice || 0);
  }, [activeShow?.id, activeShow?.podcastName, activeShow?.podcastDescription, activeShow?.subscriptionMode, activeShow?.subscriptionPrice]);

  useEffect(() => {
    if (soundtrackPreviewRef.current) soundtrackPreviewRef.current.volume = soundtrackVolume / 100;
  }, [selectedSoundtrackUrl, soundtrackVolume]);

  useEffect(() => {
    if (voiceoverPreviewRef.current) voiceoverPreviewRef.current.volume = voiceoverVolume / 100;
  }, [introVoiceoverUrl, voiceoverVolume]);

  const loadPodcastRevenue = async () => {
    if (!activeShow?.id) return;
    setLoadingPodcastRevenue(true);
    setPodcastRevenueError('');
    try {
      const [summaryResult, ordersResult] = await Promise.all([
        supabase.rpc('get_podcast_subscription_revenue_summary', { p_show_id: activeShow.id }),
        supabase
          .from('podcast_subscription_orders')
          .select('id, invoice_number, order_number, podcast_name, gross_amount, platform_fee_amount, creator_net_amount, currency, service_period_start, service_period_end, paid_at')
          .eq('show_id', activeShow.id)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false })
          .limit(50),
      ]);
      if (summaryResult.error) throw summaryResult.error;
      if (ordersResult.error) throw ordersResult.error;
      setPodcastRevenueSummary(summaryResult.data as PodcastRevenueSummary);
      setPodcastRevenueOrders((ordersResult.data || []) as PodcastRevenueOrder[]);
    } catch (revenueError) {
      console.error('Could not load Podcast subscription revenue:', revenueError);
      setPodcastRevenueError(revenueError instanceof Error ? revenueError.message : 'Could not load Podcast revenue.');
    } finally {
      setLoadingPodcastRevenue(false);
    }
  };

  const generatePshorts = async (episode: PodcastEpisode, reextract = false) => {
    if (generatingPshortEpisodeId || !user?.id) return;
    if (!reextract && generatedPshorts.some((short) => short.episodeId === episode.id)) return;
    setGeneratingPshortEpisodeId(episode.id);
    setPshortGenerationProgress(0);
    setPshortProgressPhase('measuring');
    setPshortScanSeconds(0);
    setPshortModelProgress(0);
    const uploadedPaths: string[] = [];
    let recordsSaved = false;
    let previousRows: SavedPodcastShort[] = [];
    try {
      const { data: existingRows, error: existingError } = await supabase
        .from('creator_podcast_podshorts')
        .select('id, episode_id, episode_title, clip_index, storage_path, caption, start_seconds, duration_seconds, published_video_id')
        .eq('episode_id', episode.id)
        .order('clip_index');
      if (existingError) throw existingError;
      previousRows = (existingRows || []) as SavedPodcastShort[];
      if (previousRows.length && !reextract) {
        const existingShorts = previousRows.map(toGeneratedPodcastShort);
        setGeneratedPshorts((current) => [
          ...current.filter((short) => short.episodeId !== episode.id),
          ...existingShorts,
        ]);
        setPublishedPshortIds((current) => [
          ...current.filter((id) => !existingShorts.some((short) => short.id === id)),
          ...existingShorts.flatMap((short) => short.publishedVideoId ? [short.id] : []),
        ]);
        return;
      }

      const segments = await extractPodcastShorts(episode.video_url, (completed, _total, phase, scannedSeconds, modelProgress) => {
        setPshortGenerationProgress(completed);
        setPshortProgressPhase(phase);
        setPshortScanSeconds(scannedSeconds);
        if (modelProgress !== undefined) setPshortModelProgress(Math.floor(modelProgress));
        if (phase === 'extracting' && scannedSeconds > 0) {
          setPublishedEpisodes((current) => current.map((item) => (
            item.id === episode.id ? { ...item, duration: scannedSeconds } : item
          )));
        }
      }, episode.duration, activeShow?.podcastName?.trim() || activeShow?.title || 'Podcast channel');
      const rowsToSave: PodcastShortSaveRow[] = [];
      for (const segment of segments) {
        const contentType = segment.blob.type || 'video/webm';
        const extension = contentType.includes('mp4') ? 'mp4' : 'webm';
        const storagePath = `${user.id}/podcast-podshorts/${episode.id}/${Date.now()}-${segment.index + 1}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('studio-videos').upload(
          storagePath,
          segment.blob,
          { cacheControl: '3600', contentType, upsert: false },
        );
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);
        rowsToSave.push({
          owner_id: user.id,
          show_id: episode.show_id,
          episode_id: episode.id,
          episode_title: episode.title,
          clip_index: segment.index,
          storage_path: storagePath,
          caption: `${episode.title} — Podshort ${segment.index + 1}`,
          start_seconds: Math.floor(segment.startSeconds),
          duration_seconds: PODCAST_SHORT_DURATION_SECONDS,
          published_video_id: null,
        });
      }

      const { data: savedRows, error: saveError } = await supabase
        .from('creator_podcast_podshorts')
        .upsert(rowsToSave, { onConflict: 'episode_id,clip_index' })
        .select('id, episode_id, episode_title, clip_index, storage_path, caption, start_seconds, duration_seconds, published_video_id');
      if (saveError) throw saveError;
      recordsSaved = true;
      if (!savedRows || savedRows.length !== segments.length) {
        throw new Error('The clips were uploaded, but their saved records could not be confirmed.');
      }

      const nextPshorts = (savedRows as SavedPodcastShort[]).map(toGeneratedPodcastShort);
      setGeneratedPshorts((current) => [
        ...current.filter((short) => short.episodeId !== episode.id),
        ...nextPshorts,
      ]);
      setPublishedPshortIds((current) => [
        ...current.filter((id) => !nextPshorts.some((short) => short.id === id)),
        ...nextPshorts.flatMap((short) => short.publishedVideoId ? [short.id] : []),
      ]);
      const captionedCount = segments.filter((segment) => segment.captionsApplied).length;
      const captionStatus = captionedCount === segments.length
        ? ' Captions and highlighted keywords were added.'
        : captionedCount > 0
          ? ` Captions and highlighted keywords were added to ${captionedCount} of ${segments.length} clips; speech was not detected in the others.`
          : ' No clear speech was detected, so the clips were saved without captions.';
      const obsoletePaths = reextract
        ? previousRows
          .filter((row) => !row.published_video_id && !nextPshorts.some((short) => short.storagePath === row.storage_path))
          .map((row) => row.storage_path)
        : [];
      let cleanupWarning = '';
      if (obsoletePaths.length) {
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove(obsoletePaths);
        if (cleanupError) {
          console.error('Re-extracted Podshorts saved, but old clip files could not be removed:', cleanupError);
          cleanupWarning = ` Old unpublished clip files could not be removed: ${cleanupError.message}`;
        }
      }
      toast({
        title: reextract ? 'Podshorts re-extracted' : 'Podshorts saved',
        description: `Your three ${PODCAST_SHORT_DURATION_SECONDS}-second clips are saved and ready to preview or share.${captionStatus}${cleanupWarning}`,
        variant: cleanupWarning ? 'destructive' : 'default',
      });
    } catch (generationError) {
      if (!recordsSaved && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove(uploadedPaths);
        if (cleanupError) console.error('Could not clean up failed Podshort uploads:', cleanupError);
      }
      toast({
        title: 'Could not create Podshorts',
        description: generationError instanceof Error ? generationError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPshortEpisodeId(null);
    }
  };

  const updatePshortCaption = (shortId: string, caption: string) => {
    setGeneratedPshorts((current) => current.map((short) => (
      short.id === shortId ? { ...short, caption } : short
    )));
  };

  const savePshortCaption = async (shortId: string, caption: string) => {
    const { error: captionError } = await supabase
      .from('creator_podcast_podshorts')
      .update({ caption })
      .eq('id', shortId);
    if (captionError) {
      console.error('Could not save Podshort caption:', captionError);
      toast({
        title: 'Could not save caption',
        description: captionError.message,
        variant: 'destructive',
      });
    }
  };

  const deletePshort = async (short: GeneratedPodcastShort) => {
    if (!user?.id || deletingPshortId) return;
    setDeletingPshortId(short.id);
    try {
      const { data: deletedRow, error: deleteError } = await supabase
        .from('creator_podcast_podshorts')
        .delete()
        .eq('id', short.id)
        .eq('owner_id', user.id)
        .select('id')
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!deletedRow) throw new Error('This saved Podshort could not be found or you do not have permission to delete it.');

      setGeneratedPshorts((current) => current.filter((item) => item.id !== short.id));
      setPublishedPshortIds((current) => current.filter((id) => id !== short.id));
      setPshortToDelete(null);

      if (short.publishedVideoId) {
        toast({
          title: 'Saved Podshort removed',
          description: 'Its already-published Studio video remains available.',
        });
        return;
      }

      const { error: storageError } = await supabase.storage
        .from('studio-videos')
        .remove([short.storagePath]);
      if (storageError) {
        console.error('Saved Podshort removed, but its unused clip file could not be deleted:', storageError);
        toast({
          title: 'Podshort removed with a cleanup warning',
          description: `The saved clip was removed, but its file could not be deleted: ${storageError.message}`,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Podshort deleted', description: 'The saved clip and its unused file were removed.' });
    } catch (deleteError) {
      console.error('Could not delete Podshort:', deleteError);
      toast({
        title: 'Could not delete Podshort',
        description: deleteError instanceof Error ? deleteError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingPshortId(null);
    }
  };

  const loadPshortFile = async (short: GeneratedPodcastShort) => {
    const { data, error: downloadError } = await supabase.storage
      .from('studio-videos')
      .download(short.storagePath);
    if (downloadError) throw downloadError;
    if (!data) throw new Error('The saved Podshort file was empty.');
    const extension = short.storagePath.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm';
    return new File([data], `podshort-${short.index + 1}.${extension}`, {
      type: data.type || `video/${extension}`,
    });
  };

  const triggerPshortDownload = (file: File) => {
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  };

  const downloadPshort = async (short: GeneratedPodcastShort) => {
    try {
      triggerPshortDownload(await loadPshortFile(short));
    } catch (downloadError) {
      console.error('Could not download Podshort:', downloadError);
      toast({
        title: 'Could not download Podshort',
        description: downloadError instanceof Error ? downloadError.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const sharePshort = async (short: GeneratedPodcastShort, target: PodcastShortShareTarget) => {
    const caption = short.caption.trim() || `${short.episodeTitle} — Podshort ${short.index + 1}`;
    if (target === 'facebook') {
      const shareUrl = new URL('https://www.facebook.com/sharer/sharer.php');
      shareUrl.searchParams.set('u', short.videoUrl);
      shareUrl.searchParams.set('quote', caption);
      window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer');
      return;
    }
    if (target === 'whatsapp') {
      const shareText = `${caption}\n${short.videoUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
      return;
    }

    let file: File | null = null;
    try {
      file = await loadPshortFile(short);
      if (
        typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: short.episodeTitle, text: caption });
        return;
      }

      triggerPshortDownload(file);
      toast({
        title: `${target === 'instagram' ? 'Instagram' : 'WhatsApp Status'} sharing is not available here`,
        description: 'The clip was downloaded. Open the app and upload it from your device.',
      });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      if (file && shareError instanceof DOMException && shareError.name === 'NotAllowedError') {
        triggerPshortDownload(file);
        toast({
          title: `${target === 'instagram' ? 'Instagram' : 'WhatsApp Status'} sharing is unavailable`,
          description: 'The clip was downloaded. Open the app and upload it from your device.',
        });
        return;
      }
      console.error(`Could not share Podshort to ${target}:`, shareError);
      toast({
        title: 'Could not share Podshort',
        description: shareError instanceof Error ? shareError.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const publishPshort = async (short: GeneratedPodcastShort) => {
    if (!user?.id || publishingPshortIds.includes(short.id) || publishedPshortIds.includes(short.id)) return;
    setPublishingPshortIds((current) => [...current, short.id]);
    try {
      const { data: channel, error: channelError } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (channelError) throw channelError;
      if (!channel) throw new Error('Create a Studio channel before publishing Podshorts.');

      const caption = short.caption.trim() || `${short.episodeTitle} — Podshort ${short.index + 1}`;
      const { data: createdVideo, error: insertError } = await supabase.from('studio_videos').insert({
        user_id: user.id,
        channel_id: channel.id,
        is_reel: true,
        video_url: short.videoUrl,
        caption,
        categories: ['Podcast', 'Podshorts'],
        share_to_feeds: sharePshortsToFeed,
        likes: 0,
        views: 0,
        created_at: new Date().toISOString(),
        duration: short.durationSeconds,
      }).select('id').single();
      if (insertError) throw insertError;
      const { error: savedStatusError } = await supabase
        .from('creator_podcast_podshorts')
        .update({ published_video_id: createdVideo.id })
        .eq('id', short.id);
      if (savedStatusError) console.error('Podshort was published, but its saved status could not be updated:', savedStatusError);

      const shareFailures: string[] = [];
      if (sharePshortsToFeed) {
        try {
          await insertSharedFeedPost({
            supabaseClient: supabase,
            userId: user.id,
            caption,
            mediaUrl: short.videoUrl,
            categories: ['Podcast', 'Podshorts'],
            audience: 'public',
            sourceType: 'video',
          });
        } catch (shareError) {
          console.error('Could not share Podshort to Feed:', shareError);
          shareFailures.push('Feed');
        }
      }
      if (sharePshortsToMoments) {
        try {
          await insertVideoMoment({
            supabaseClient: supabase,
            userId: user.id,
            caption,
            description: `Podshort from ${short.episodeTitle}`,
            mediaUrl: short.videoUrl,
          });
        } catch (shareError) {
          console.error('Could not share Podshort to Moments:', shareError);
          shareFailures.push('Moments');
        }
      }

      setPublishedPshortIds((current) => [...current, short.id]);
      setGeneratedPshorts((current) => current.map((item) => (
        item.id === short.id ? { ...item, publishedVideoId: createdVideo.id } : item
      )));
      const failures = [...shareFailures];
      if (savedStatusError) failures.push('saved status');
      toast({
        title: 'Podshort added to Studio',
        description: failures.length
          ? `The clip is in Studio, but updating its ${failures.join(' and ')} failed.`
          : 'Your clip is ready in Studio' + (sharePshortsToFeed || sharePshortsToMoments ? ' and has been shared.' : '.'),
        variant: failures.length ? 'destructive' : 'default',
      });
    } catch (publishError) {
      toast({
        title: 'Could not publish Podshort',
        description: publishError instanceof Error ? publishError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPublishingPshortIds((current) => current.filter((id) => id !== short.id));
    }
  };

  const loadDrafts = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: draftsError } = await supabase.from('creator_podcast_drafts')
      .select('id, show_id, episode_id, title, topic, target_duration_minutes, description, script, host_names, recording_path, cover_image_path, logo_image_path, intro_video_path, outro_video_path, status, reviewer_notes, submitted_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });
    if (draftsError) throw draftsError;
    const loadedDrafts = (data || []) as PodcastDraft[];
    setDrafts(loadedDrafts.filter((draft) => draft.status !== 'published'));

    const episodeIds = loadedDrafts.flatMap((draft) =>
      draft.status === 'published'
        && (!podcastShowId || draft.show_id === podcastShowId)
        && draft.episode_id
        ? [draft.episode_id]
        : []);
    if (!episodeIds.length) {
      setPublishedEpisodes([]);
      return;
    }

    let episodesQuery = supabase.from('studio_episodes')
      .select('id, show_id, title, topic, host_names, description, video_url, thumbnail_url, duration, created_at, scheduled_time, views, shares, likes, is_active')
      .in('id', episodeIds)
      .order('created_at', { ascending: false });
    if (podcastShowId) episodesQuery = episodesQuery.eq('show_id', podcastShowId);
    const { data: episodes, error: episodesError } = await episodesQuery;
    if (episodesError) throw episodesError;
    setPublishedEpisodes(await Promise.all((episodes || []).map(async (episode) => ({
      ...episode,
      video_url: await resolvePodcastVideoUrl(episode.video_url),
    }))));
  }, [podcastShowId, user?.id]);

  const setPublishedEpisodeActive = async (episode: PodcastEpisode) => {
    const isActive = !episode.is_active;
    if (!isActive && !window.confirm(`Unpublish "${episode.title}"? It will be hidden from listeners but not deleted.`)) return;
    setUpdatingPublishedEpisodeId(episode.id);
    try {
      const { error } = await supabase.rpc('set_studio_show_episode_active', {
        p_episode_id: episode.id,
        p_is_active: isActive,
      });
      if (error) throw error;

      toast({
        title: isActive ? 'Podcast episode published' : 'Podcast episode unpublished',
        description: isActive ? 'Listeners can access this episode again.' : 'The episode file was preserved.',
      });
      try {
        await loadDrafts();
      } catch (refreshError) {
        console.error('Episode publication changed but the Podcast list could not refresh:', refreshError);
        toast({
          title: 'Episode updated, but the list could not refresh',
          description: getPodcastErrorMessage(refreshError, 'Refresh the page to see the latest status.'),
          variant: 'destructive',
        });
      }
    } catch (updateError) {
      toast({
        title: `Could not ${isActive ? 'publish' : 'unpublish'} Podcast episode`,
        description: getPodcastErrorMessage(updateError, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setUpdatingPublishedEpisodeId(null);
    }
  };

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
        const [eligibility, pendingResult, approvedResult, userProfileResult] = await Promise.all([
          getPodcastStudioEligibility(user.id),
          supabase.from('studio_show_applications')
            .select('id')
            .eq('applicant_id', user.id)
            .eq('status', 'pending')
            .limit(1),
          supabase.from('studio_show_applications')
            .select('id, approved_show_id, show_title, description, category, preferred_days, timezone')
            .eq('applicant_id', user.id)
            .eq('status', 'approved')
            .limit(1),
          supabase.from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle(),
        ]);
        if (!active) return;
        setEligible(eligibility.eligible);
        if (pendingResult.error) throw pendingResult.error;
        if (approvedResult.error) throw approvedResult.error;

        if (userProfileResult.error) {
          console.error('Could not load podcast host name from profile:', userProfileResult.error);
        }
        const metadataHostName = [
          user.user_metadata?.full_name,
          user.user_metadata?.name,
          user.user_metadata?.username,
        ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
        const emailHostName = user.email?.split('@')[0]?.trim();
        const profileHostName = userProfileResult.data?.username?.trim();
        const resolvedHostName = profileHostName || metadataHostName || emailHostName || '';
        setDefaultHostName(resolvedHostName);
        setHostNames((current) => current.trim() ? current : resolvedHostName);
        if (userProfileResult.error && !resolvedHostName) {
          toast({
            title: 'Could not load your default host name',
            description: 'Enter the presenter name manually before creating an intro or outro.',
            variant: 'destructive',
          });
        }

        const hasPendingApplication = Boolean(pendingResult.data?.length);
        const hasApprovedApplication = Boolean(approvedResult.data?.length);
        setApplicationStatus(hasApprovedApplication ? 'approved' : hasPendingApplication ? 'pending' : 'none');
        const approvedApplication = approvedResult.data?.[0];
        if (show?.id || !approvedApplication?.approved_show_id) {
          setLoadedShow(undefined);
        } else {
          const [showResult, podcastBrandResult] = await Promise.all([
            supabase.from('studio_shows')
              .select('title, description, category, brand_color, approved_days, time_slot_start, time_slot_end')
              .eq('id', approvedApplication.approved_show_id)
              .maybeSingle(),
            supabase
              .from('studio_podcast_branding')
              .select('podcast_name, podcast_description, subscription_mode, subscription_price, cover_url, logo_url, intro_url, outro_url')
              .eq('show_id', approvedApplication.approved_show_id)
              .maybeSingle(),
          ]);
          if (!active) return;
          if (showResult.error) throw showResult.error;
          if (podcastBrandResult.error) {
            console.error('Could not load Podcast branding and broadcast defaults:', podcastBrandResult.error);
            toast({
              title: 'Could not load Podcast branding',
              description: podcastBrandResult.error.message,
              variant: 'destructive',
            });
          }
          const showDetails = showResult.data;
          const podcastBrand = podcastBrandResult.error ? null : podcastBrandResult.data;
          setLoadedShow({
            id: approvedApplication.approved_show_id,
            title: showDetails?.title || approvedApplication.show_title,
            description: showDetails?.description || approvedApplication.description || '',
            category: showDetails?.category || approvedApplication.category || '',
            podcastName: podcastBrand?.podcast_name || null,
            podcastDescription: podcastBrand?.podcast_description || null,
            subscriptionMode: podcastBrand?.subscription_mode === 'paid' ? 'paid' : 'free',
            subscriptionPrice: Number(podcastBrand?.subscription_price || 0),
            podcastCoverUrl: podcastBrand?.cover_url || null,
            podcastLogoUrl: podcastBrand?.logo_url || null,
            podcastIntroUrl: podcastBrand?.intro_url || null,
            podcastOutroUrl: podcastBrand?.outro_url || null,
            brandColor: showDetails?.brand_color || null,
            broadcastDays: showDetails?.approved_days?.length
              ? showDetails.approved_days
              : approvedApplication.preferred_days || [],
            timeSlotStart: showDetails?.time_slot_start || null,
            timeSlotEnd: showDetails?.time_slot_end || null,
            timeZone: approvedApplication.timezone || 'UTC',
          });
        }
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
  }, [user, loadDrafts, podcastShowId, show?.id, toast]);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  useEffect(() => {
    if (!introVoiceover) {
      setIntroVoiceoverUrl('');
      return;
    }
    const url = URL.createObjectURL(introVoiceover);
    setIntroVoiceoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [introVoiceover]);

  useEffect(() => {
    if (!introVideo) {
      setIntroVideoPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(introVideo);
    setIntroVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [introVideo]);

  useEffect(() => {
    if (!outroVideo) {
      setOutroVideoPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(outroVideo);
    setOutroVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outroVideo]);

  useEffect(() => {
    if (!outroAudio) {
      setOutroAudioPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(outroAudio);
    setOutroAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outroAudio]);

  useEffect(() => {
    if (broadcastTab !== 'create' || !editingBroadcastDefault) return;
    const frameId = window.requestAnimationFrame(() => {
      if (editingBroadcastDefault === 'intro') {
        if (introEditorRef.current) introEditorRef.current.open = true;
        introEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        outroEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [broadcastTab, editingBroadcastDefault]);

  useEffect(() => () => {
    if (introVoiceStopTimerRef.current !== null) window.clearTimeout(introVoiceStopTimerRef.current);
    const recorder = introVoiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    introVoiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (outroAudioStopTimerRef.current !== null) window.clearTimeout(outroAudioStopTimerRef.current);
    const outroAudioRecorder = outroAudioRecorderRef.current;
    discardOutroAudioRecordingRef.current = true;
    if (outroAudioRecorder && outroAudioRecorder.state !== 'inactive') outroAudioRecorder.stop();
    outroAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
        const recordingDurationSeconds = Math.floor(Number(message.recordingDurationSeconds));
        if (!Number.isFinite(recordingDurationSeconds) || recordingDurationSeconds < 1 || recordingDurationSeconds > 21600) {
          throw new Error('Could not determine the recording length. Record the episode again before saving it.');
        }
        const extension = message.recording.type.includes('mp4') ? 'mp4' : 'webm';
        uploadedPath = `${user.id}/${pending.draft.id}/recording-${Date.now()}.${extension}`;
        const recording = new Blob([message.recording], { type: extension === 'mp4' ? 'video/mp4' : 'video/webm' });
        const { error: uploadError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .upload(uploadedPath, recording, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;

        const { error: durationError } = await supabase.rpc('save_creator_podcast_recording_duration', {
          p_draft_id: pending.draft.id,
          p_duration_seconds: recordingDurationSeconds,
        });
        if (durationError) throw durationError;

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
        toast({ title: 'Private episode draft saved', description: 'It stays private until you publish it.' });
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
    stopVoiceoverRecording();
    discardOutroAudioRecordingRef.current = recordingOutroAudio;
    stopOutroAudioRecording();
    setDraftId(null);
    setTopic('');
    setDescription('');
    setScript('');
    setHostNames(defaultHostName);
    setDuration(10);
    setReleaseMode('immediate');
    setScheduledPremiere('');
    setRecordingPath(null);
    setCoverImagePath(null);
    setLogoImagePath(null);
    setIntroVideoPath(null);
    setOutroVideoPath(null);
    setCoverImage(null);
    setLogoImage(null);
    setIntroVideo(null);
    setOutroVideo(null);
    setOutroAudio(null);
    setIntroVoiceover(null);
    setIntroVoiceoverNeedsBuild(false);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
  };

  const stopVoiceoverRecording = () => {
    if (introVoiceStopTimerRef.current !== null) {
      window.clearTimeout(introVoiceStopTimerRef.current);
      introVoiceStopTimerRef.current = null;
    }
    const recorder = introVoiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const stopOutroAudioRecording = () => {
    if (outroAudioStopTimerRef.current !== null) {
      window.clearTimeout(outroAudioStopTimerRef.current);
      outroAudioStopTimerRef.current = null;
    }
    const recorder = outroAudioRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const recordOutroAudio = async () => {
    if (recordingOutroAudio) {
      stopOutroAudioRecording();
      return;
    }
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      outroAudioStreamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      outroAudioChunksRef.current = [];
      outroAudioRecorderRef.current = recorder;
      discardOutroAudioRecordingRef.current = false;
      let recorderFailed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) outroAudioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailed = true;
        setError('Could not record outro audio. Check your microphone and try again.');
        setRecordingOutroAudio(false);
      };
      recorder.onstop = () => {
        const chunks = outroAudioChunksRef.current;
        const type = recorder.mimeType || 'audio/webm';
        const audio = new Blob(chunks, { type });
        if (audio.size && !discardOutroAudioRecordingRef.current) {
          setOutroAudio(new File([audio], `podcast-outro-audio.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
        } else if (!audio.size && !recorderFailed && !discardOutroAudioRecordingRef.current) {
          setError('No outro audio was captured. Please record again.');
        }
        discardOutroAudioRecordingRef.current = false;
        if (outroAudioStopTimerRef.current !== null) {
          window.clearTimeout(outroAudioStopTimerRef.current);
          outroAudioStopTimerRef.current = null;
        }
        outroAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
        outroAudioStreamRef.current = null;
        outroAudioRecorderRef.current = null;
        setRecordingOutroAudio(false);
      };
      recorder.start(250);
      setOutroAudio(null);
      setRecordingOutroAudio(true);
      outroAudioStopTimerRef.current = window.setTimeout(stopOutroAudioRecording, 15_000);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : 'Could not start outro audio recording.');
      outroAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
      outroAudioStreamRef.current = null;
      outroAudioRecorderRef.current = null;
      setRecordingOutroAudio(false);
    }
  };

  const recordIntroVoiceover = async () => {
    if (recordingVoiceover) {
      stopVoiceoverRecording();
      return;
    }
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      introVoiceStreamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      introVoiceChunksRef.current = [];
      introVoiceRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) introVoiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Could not record the intro voiceover. Check your microphone and try again.');
        setRecordingVoiceover(false);
        introVoiceStreamRef.current?.getTracks().forEach((track) => track.stop());
        introVoiceStreamRef.current = null;
      };
      recorder.onstop = () => {
        const chunks = introVoiceChunksRef.current;
        const type = recorder.mimeType || 'audio/webm';
        const voiceover = new Blob(chunks, { type });
        if (voiceover.size) {
          setIntroVoiceover(new File([voiceover], `podcast-voiceover.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type }));
          setIntroVoiceoverNeedsBuild(true);
        } else {
          setError('No voiceover audio was captured. Please record again.');
        }
        introVoiceStreamRef.current?.getTracks().forEach((track) => track.stop());
        introVoiceStreamRef.current = null;
        introVoiceRecorderRef.current = null;
        setRecordingVoiceover(false);
      };
      recorder.start(250);
      setIntroVoiceover(null);
      setRecordingVoiceover(true);
      introVoiceStopTimerRef.current = window.setTimeout(stopVoiceoverRecording, 15_000);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : 'Could not start voiceover recording.');
      introVoiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      introVoiceStreamRef.current = null;
    }
  };

  const getBroadcastHostName = () => {
    const name = hostNames.trim() || defaultHostName.trim();
    if (!name) throw new Error('Enter the presenter name before creating a branded intro or outro.');
    return name;
  };

  const createVoiceoverIntro = async () => {
    if (!introVoiceover) {
      setError('Record a voiceover before creating your branded intro.');
      return;
    }
    if (!selectedSoundtrackUrl) {
      setError('Choose a soundtrack before creating your branded intro.');
      return;
    }
    setBuildingIntro(true);
    setError('');
    let coverPreviewUrl: string | null = null;
    let logoPreviewUrl: string | null = null;
    let existingIntroPreviewUrl: string | null = null;
    try {
      if (coverImage) coverPreviewUrl = URL.createObjectURL(coverImage);
      if (logoImage) logoPreviewUrl = URL.createObjectURL(logoImage);
      if (introVideo) {
        existingIntroPreviewUrl = URL.createObjectURL(introVideo);
      } else if (introVideoPath) {
        const { data, error: signError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .createSignedUrl(introVideoPath, SIGNED_ASSET_TTL_SECONDS);
        if (signError) throw signError;
        existingIntroPreviewUrl = data.signedUrl;
      }
      const generatedIntro = await buildPodcastVoiceoverIntro({
        title: podcastDisplayName,
        hostNames: getBroadcastHostName(),
        soundtrackUrl: selectedSoundtrackUrl,
        voiceover: introVoiceover,
        soundtrackVolume,
        voiceoverVolume,
        voiceEffect,
        visualIntroUrl: existingIntroPreviewUrl,
        coverImageUrl: coverPreviewUrl || activeShow?.podcastCoverUrl,
        logoImageUrl: logoPreviewUrl || activeShow?.podcastLogoUrl,
      });
      setIntroVideo(generatedIntro);
      setIntroVoiceoverNeedsBuild(false);
      await saveGeneratedBroadcastDefault(generatedIntro, 'intro');
    } catch (introError) {
      setError(introError instanceof Error ? introError.message : 'Could not create the podcast voiceover intro.');
    } finally {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      if (introVideo && existingIntroPreviewUrl) URL.revokeObjectURL(existingIntroPreviewUrl);
      setBuildingIntro(false);
    }
  };

  const createBrandedOutro = async () => {
    setBuildingOutro(true);
    setError('');
    let coverPreviewUrl: string | null = null;
    let logoPreviewUrl: string | null = null;
    try {
      if (coverImage) coverPreviewUrl = URL.createObjectURL(coverImage);
      if (logoImage) logoPreviewUrl = URL.createObjectURL(logoImage);
      const generatedOutro = await buildPodcastBrandedOutro({
        showName: podcastDisplayName,
        hostNames: getBroadcastHostName(),
        coverImageUrl: coverPreviewUrl || activeShow?.podcastCoverUrl,
        logoImageUrl: logoPreviewUrl || activeShow?.podcastLogoUrl,
        audioFile: outroAudio,
      });
      setOutroVideo(generatedOutro);
      await saveGeneratedBroadcastDefault(generatedOutro, 'outro');
    } catch (outroError) {
      setError(outroError instanceof Error ? outroError.message : 'Could not create the branded podcast outro.');
    } finally {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setBuildingOutro(false);
    }
  };

  const applyBroadcastDefaults = (introUrl: string | null, outroUrl: string | null) => {
    onPodcastBrandUpdated?.({ intro_url: introUrl, outro_url: outroUrl });
    setLoadedShow((current) => current ? {
      ...current,
      podcastIntroUrl: introUrl,
      podcastOutroUrl: outroUrl,
    } : current);
  };

  const saveGeneratedBroadcastDefault = async (file: File, kind: 'intro' | 'outro') => {
    if (!activeShow) {
      throw new Error('Open an approved Podcast show to save reusable intros and outros.');
    }

    setSavingBroadcastDefaults(true);
    const uploadedPaths: string[] = [];
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!currentUser) throw new Error('Sign in to save your show intro and outro.');

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${currentUser.id}/podcast-shows/${activeShow.id}/broadcast/${kind}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('studio-videos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type.split(';')[0],
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const publicUrl = supabase.storage.from('studio-videos').getPublicUrl(path).data.publicUrl;
      const previousUrl = kind === 'intro' ? activeShow.podcastIntroUrl : activeShow.podcastOutroUrl;
      const introUrl = kind === 'intro' ? publicUrl : activeShow.podcastIntroUrl;
      const outroUrl = kind === 'outro' ? publicUrl : activeShow.podcastOutroUrl;
      const { error: updateError } = await supabase.rpc('update_studio_podcast_broadcast_defaults', {
        p_show_id: activeShow.id,
        p_intro_url: introUrl,
        p_outro_url: outroUrl,
      });
      if (updateError) throw updateError;

      applyBroadcastDefaults(introUrl, outroUrl);
      if (kind === 'intro') {
        setIntroVideo(null);
        setIntroVideoPath(null);
      } else {
        setOutroVideo(null);
        setOutroVideoPath(null);
      }
      setEditingBroadcastDefault(null);
      setBroadcastTab('saved');
      let cleanupWarning = '';
      if (previousUrl && previousUrl !== publicUrl) {
        const previousPath = getManagedBroadcastAssetPath(previousUrl, kind, currentUser.id, activeShow.id);
        if (previousPath) {
          const { error: cleanupError } = await supabase.storage.from('studio-videos').remove([previousPath]);
          if (cleanupError) {
            console.error(`Could not clean up replaced show ${kind}:`, cleanupError);
            cleanupWarning = `The new ${kind} was saved, but the previous file could not be removed: ${cleanupError.message}`;
          }
        }
      }
      toast({
        title: `Show ${kind} saved`,
        description: cleanupWarning || `This ${kind} will be available for new episodes.`,
        variant: cleanupWarning ? 'destructive' : 'default',
      });
    } catch (saveError) {
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove(uploadedPaths);
        if (cleanupError) console.error(`Could not clean up failed show ${kind} upload:`, cleanupError);
      }
      throw saveError;
    } finally {
      setSavingBroadcastDefaults(false);
    }
  };

  const saveBroadcastDefaults = async () => {
    if (!activeShow || savingBroadcastDefaults) return;
    setSavingBroadcastDefaults(true);
    setError('');
    const uploadedPaths: string[] = [];
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!currentUser) throw new Error('Sign in to save your show intro and outro.');

      const readDraftAsset = async (path: string, fileName: string) => {
        const { data, error: signError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .createSignedUrl(path, SIGNED_ASSET_TTL_SECONDS);
        if (signError) throw signError;
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error('Could not load the selected saved intro or outro.');
        const blob = await response.blob();
        return new File([blob], fileName, { type: blob.type || 'video/webm' });
      };

      const introFile = introVideo || (introVideoPath ? await readDraftAsset(introVideoPath, 'podcast-intro.webm') : null);
      const outroFile = outroVideo || (outroVideoPath ? await readDraftAsset(outroVideoPath, 'podcast-outro.webm') : null);
      if (!introFile && !outroFile) {
        throw new Error('Create or select an intro or outro before saving show defaults.');
      }

      const uploadDefault = async (file: File, kind: 'intro' | 'outro') => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${currentUser.id}/podcast-shows/${activeShow.id}/broadcast/${kind}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('studio-videos').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type.split(';')[0],
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        return supabase.storage.from('studio-videos').getPublicUrl(path).data.publicUrl;
      };

      const introUrl = introFile ? await uploadDefault(introFile, 'intro') : activeShow.podcastIntroUrl;
      const outroUrl = outroFile ? await uploadDefault(outroFile, 'outro') : activeShow.podcastOutroUrl;
      const { error: updateError } = await supabase.rpc('update_studio_podcast_broadcast_defaults', {
        p_show_id: activeShow.id,
        p_intro_url: introUrl,
        p_outro_url: outroUrl,
      });
      if (updateError) throw updateError;

      applyBroadcastDefaults(introUrl, outroUrl);
      setIntroVideo(null);
      setOutroVideo(null);
      setIntroVideoPath(null);
      setOutroVideoPath(null);
      setEditingBroadcastDefault(null);
      setBroadcastTab('saved');
      toast({ title: 'Show intro and outro saved', description: 'New episodes will use these by default.' });
    } catch (saveError) {
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove(uploadedPaths);
        if (cleanupError) console.error('Could not clean up failed show intro/outro uploads:', cleanupError);
      }
      setError(saveError instanceof Error ? saveError.message : 'Could not save show intro and outro defaults.');
    } finally {
      setSavingBroadcastDefaults(false);
    }
  };

  const deleteBroadcastDefault = async (kind: 'intro' | 'outro') => {
    if (!activeShow || !user?.id || deletingBroadcastDefault) return;
    setDeletingBroadcastDefault(kind);
    try {
      const oldUrl = kind === 'intro' ? activeShow.podcastIntroUrl : activeShow.podcastOutroUrl;
      const introUrl = kind === 'intro' ? null : activeShow.podcastIntroUrl;
      const outroUrl = kind === 'outro' ? null : activeShow.podcastOutroUrl;
      const { error: updateError } = await supabase.rpc('update_studio_podcast_broadcast_defaults', {
        p_show_id: activeShow.id,
        p_intro_url: introUrl,
        p_outro_url: outroUrl,
      });
      if (updateError) throw updateError;

      applyBroadcastDefaults(introUrl, outroUrl);
      setBroadcastDefaultToDelete(null);
      setEditingBroadcastDefault(null);

      const oldPath = oldUrl
        ? getManagedBroadcastAssetPath(oldUrl, kind, user.id, activeShow.id)
        : null;
      if (oldPath) {
        const { error: removeError } = await supabase.storage.from('studio-videos').remove([oldPath]);
        if (removeError) {
          console.error(`Could not remove deleted show ${kind} asset:`, removeError);
          toast({
            title: `Show ${kind} removed`,
            description: `It will no longer be used for new episodes, but its storage file could not be deleted: ${removeError.message}`,
            variant: 'destructive',
          });
          return;
        }
      }

      toast({
        title: `Show ${kind} removed`,
        description: oldUrl && !oldPath
          ? `This ${kind} will no longer be used for new episodes. Its file was left untouched because it is outside this show's managed storage folder.`
          : `This ${kind} will no longer be used for new episodes.`,
      });
    } catch (deleteError) {
      console.error(`Could not delete saved show ${kind}:`, deleteError);
      toast({
        title: `Could not delete show ${kind}`,
        description: deleteError instanceof Error ? deleteError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingBroadcastDefault(null);
    }
  };

  const focusBroadcastEditor = (kind: 'intro' | 'outro') => {
    setEditingBroadcastDefault(kind);
    setBroadcastTab('create');
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
    if (introVoiceoverNeedsBuild) {
      throw new Error('Create the branded voiceover intro before saving or recording this draft.');
    }
    if (!user) throw new Error('Sign in before saving an episode draft.');
    const episodeTitle = topic.trim();
    if (episodeTitle.length < 2 || episodeTitle.length > 120) {
      throw new Error('Enter a conversation topic between 2 and 120 characters to use as the episode title.');
    }
    const id = draftId || createDraftId();
    const nextCoverPath = coverImagePath;
    const nextLogoPath = logoImagePath;
    const nextIntroPath = introVideoPath;
    const nextOutroPath = outroVideoPath;
    const saved = {
      id,
      title: episodeTitle,
      topic: episodeTitle,
      target_duration_minutes: duration,
      description: description.trim(),
      script,
      host_names: hostNames.trim() || defaultHostName,
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
      toast({ title: 'Episode draft saved privately' });
    } catch (saveError) {
      setError(getPodcastErrorMessage(saveError, 'Could not save this episode draft.'));
    } finally {
      setSaving(false);
    }
  };

  const generateScript = async () => {
    if (!topic.trim()) {
      const message = 'Enter a conversation topic first.';
      setError(message);
      toast({ title: 'Topic required', description: message, variant: 'destructive' });
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
          hostNames: hostNames.trim() || defaultHostName || 'Host 1, Host 2',
          showTitle: podcastDisplayName,
          duration,
        }),
      });
      let result: ScriptResponse;
      try {
        result = await readJsonResponse<ScriptResponse>(response);
      } catch (responseError) {
        if (response.status >= 500) {
          throw new Error('The podcast script service is unavailable. Check that the backend is running, then try again.');
        }
        throw responseError;
      }
      if (!response.ok) throw new Error(result.error || `Could not generate a script (HTTP ${response.status}).`);
      const generatedScript = result.script?.trim();
      if (!generatedScript) throw new Error('The script generator returned an empty result. Please try again.');
      setScript(generatedScript);
      toast({ title: 'Podcast script generated', description: 'Review and edit the script before recording.' });
    } catch (generationError) {
      const message = generationError instanceof TypeError
        ? 'Could not connect to the podcast script service. Check that the backend is running, then try again.'
        : generationError instanceof Error
          ? generationError.message
          : 'Could not generate a podcast script.';
      setError(message);
      toast({ title: 'Could not generate script', description: message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const savePodcastSettings = async () => {
    if (!activeShow || savingPodcastSettings) return;
    setSavingPodcastSettings(true);
    try {
      const cleanName = podcastName.trim();
      const cleanDescription = podcastDescription.trim();
      const cleanPrice = subscriptionMode === 'paid' ? Number(subscriptionPrice) : 0;
      const { error: settingsError } = await supabase.rpc('update_studio_podcast_settings', {
        p_show_id: activeShow.id,
        p_podcast_name: cleanName,
        p_podcast_description: cleanDescription,
        p_subscription_mode: subscriptionMode,
        p_subscription_price: cleanPrice,
      });
      if (settingsError) throw settingsError;
      setPodcastName(cleanName);
      setPodcastDescription(cleanDescription);
      setSubscriptionPrice(cleanPrice);
      onPodcastBrandUpdated?.({
        podcast_name: cleanName,
        podcast_description: cleanDescription,
        subscription_mode: subscriptionMode,
        subscription_price: cleanPrice,
      });
      setLoadedShow((current) => current ? {
        ...current,
        podcastName: cleanName,
        podcastDescription: cleanDescription,
        subscriptionMode,
        subscriptionPrice: cleanPrice,
      } : current);
      toast({ title: 'Podcast settings saved' });
    } catch (settingsError) {
      toast({
        title: 'Could not save Podcast settings',
        description: settingsError instanceof Error ? settingsError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingPodcastSettings(false);
    }
  };

  const updatePodcastArtwork = async (field: 'banner_url' | 'logo_url', file: File): Promise<boolean> => {
    if (!activeShow || savingArtwork) return false;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Choose a supported image', description: 'Use a JPG, PNG, or WebP image.', variant: 'destructive' });
      return false;
    }

    setSavingArtwork(field);
    let uploadedPath: string | null = null;
    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!currentUser) throw new Error('Sign in to update your show artwork.');

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const artworkType = field === 'banner_url' ? 'cover' : 'logo';
      const assetPath = `${currentUser.id}/podcast-shows/${activeShow.id}/${artworkType}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('studio-videos').upload(assetPath, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPath = assetPath;

      const imageUrl = supabase.storage.from('studio-videos').getPublicUrl(assetPath).data.publicUrl;
      const updatedBrand: PodcastShowUpdate = {
        logo_url: field === 'logo_url' ? imageUrl : activeShow.podcastLogoUrl,
        cover_url: field === 'banner_url' ? imageUrl : activeShow.podcastCoverUrl,
      };

      const { error: updateError } = await supabase.rpc('update_studio_podcast_branding', {
        p_show_id: activeShow.id,
        p_podcast_cover_url: updatedBrand.cover_url,
        p_podcast_logo_url: updatedBrand.logo_url,
      });
      if (updateError) throw updateError;

      uploadedPath = null;
      onPodcastBrandUpdated?.(updatedBrand);
      setLoadedShow((current) => current ? {
        ...current,
        podcastLogoUrl: updatedBrand.logo_url ?? activeShow.podcastLogoUrl,
        podcastCoverUrl: updatedBrand.cover_url ?? activeShow.podcastCoverUrl,
      } : current);
      toast({ title: field === 'banner_url' ? 'Podcast cover updated' : 'Podcast logo updated' });
      return true;
    } catch (updateError) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove([uploadedPath]);
        if (cleanupError) console.error('Could not clean up an unused show artwork upload:', cleanupError);
      }
      toast({
        title: field === 'banner_url' ? 'Could not update podcast cover' : 'Could not update podcast logo',
        description: updateError instanceof Error ? updateError.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSavingArtwork(null);
    }
  };

  const closeBannerCrop = () => {
    if (bannerCropImageUrlRef.current) URL.revokeObjectURL(bannerCropImageUrlRef.current);
    bannerCropImageUrlRef.current = null;
    setBannerCropImage(null);
    setCroppedAreaPixels(null);
  };

  const handleCoverCropSave = async () => {
    if (!bannerCropImage || !croppedAreaPixels || processingCover || savingArtwork) return;
    setProcessingCover(true);
    try {
      const croppedFile = await createCroppedCoverFile(bannerCropImage, croppedAreaPixels);
      if (await updatePodcastArtwork('banner_url', croppedFile)) closeBannerCrop();
    } catch (cropError) {
      toast({
        title: 'Could not crop cover image',
        description: cropError instanceof Error ? cropError.message : 'Please choose another image.',
        variant: 'destructive',
      });
    } finally {
      setProcessingCover(false);
    }
  };

  const handlePodcastArtworkSelect = (field: 'banner_url' | 'logo_url', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (field === 'logo_url') {
      void updatePodcastArtwork(field, file);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Choose a supported image', description: 'Use a JPG, PNG, or WebP image.', variant: 'destructive' });
      return;
    }
    if (bannerCropImageUrlRef.current) URL.revokeObjectURL(bannerCropImageUrlRef.current);
    const imageUrl = URL.createObjectURL(file);
    bannerCropImageUrlRef.current = imageUrl;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setBannerCropImage(imageUrl);
  };

  useEffect(() => () => {
    if (bannerCropImageUrlRef.current) URL.revokeObjectURL(bannerCropImageUrlRef.current);
  }, []);

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
    if (!hostNames.trim() && !defaultHostName.trim()) {
      setError('Enter the presenter name before recording so the intro and outro are branded correctly.');
      return;
    }
    const recordingWindow = window.open('about:blank', '_blank', 'popup=yes,width=1440,height=900,left=0,top=0');
    if (!recordingWindow) {
      setError('Allow popups for this site, then open the teleprompter again.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = await saveDraft();
      const [coverUrl, logoUrl, draftIntroUrl, draftOutroUrl] = await Promise.all([
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
        showName: activeShow?.podcastName?.trim() || activeShow?.title || saved.title,
        topic: saved.topic,
        script: saved.script,
        hostNames: saved.host_names,
        duration: saved.target_duration_minutes,
        nextEpisodeSlot: getNextPodcastBroadcastSlot(
          activeShow?.broadcastDays || [],
          activeShow?.timeSlotStart,
          activeShow?.timeSlotEnd,
          activeShow?.timeZone || 'UTC',
        ),
        coverImageUrl: coverUrl || activeShow?.podcastCoverUrl,
        logoImageUrl: logoUrl || activeShow?.podcastLogoUrl,
        introVideoUrl: draftIntroUrl || activeShow?.podcastIntroUrl || null,
        outroVideoUrl: draftOutroUrl || activeShow?.podcastOutroUrl || null,
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
      recordingWindow.location.href = new URL(`/podcast-teleprompter/${sessionId}`, window.location.origin).toString();
    } catch (startError) {
      console.error('Could not prepare creator Podcast recording:', startError);
      const message = getPodcastErrorMessage(startError, 'Could not open the teleprompter.');
      setError(message);
      if (!recordingWindow.closed) {
        recordingWindow.document.title = 'Could not open the teleprompter';
        recordingWindow.document.body.textContent = `The teleprompter could not be prepared. ${message}`;
      }
    } finally {
      setSaving(false);
    }
  };

  const publishEpisode = async () => {
    if (!draftId || !recordingPath || applicationStatus !== 'approved' || publishing) return;
    let scheduledAt: string | null = null;
    if (releaseMode === 'scheduled') {
      const premiereDate = new Date(scheduledPremiere);
      if (!scheduledPremiere || !Number.isFinite(premiereDate.getTime()) || premiereDate.getTime() <= Date.now()) {
        setError('Choose a future date and time for the premiere.');
        return;
      }
      scheduledAt = premiereDate.toISOString();
    }

    setPublishing(true);
    setError('');
    try {
      const saved = await saveDraft();
      const { error: publishError } = await supabase.rpc('publish_creator_podcast_episode', {
        p_draft_id: saved.id,
        p_scheduled_time: scheduledAt,
      });
      if (publishError) throw publishError;

      resetEditor();
      try {
        await loadDrafts();
        toast({
          title: scheduledAt ? 'Episode premiere scheduled' : 'Episode published',
          description: scheduledAt
            ? `Premieres ${new Date(scheduledAt).toLocaleString()}.`
            : 'Your episode is now available to your Podcast subscribers.',
        });
      } catch (refreshError) {
        console.error('Episode published but the episode list could not refresh:', refreshError);
        toast({
          title: 'Episode published',
          description: 'The episode is live, but the list could not refresh. Reopen the page to see it.',
        });
      }
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Could not publish this episode.');
    } finally {
      setPublishing(false);
    }
  };

  const loadDraft = async (draft: PodcastDraft) => {
    stopVoiceoverRecording();
    setReleaseMode('immediate');
    setScheduledPremiere('');
    setDraftId(draft.id);
    setTopic(draft.topic.trim() || draft.title);
    setDescription(draft.description);
    setScript(draft.script);
    setHostNames(draft.host_names.trim() || defaultHostName);
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
    setIntroVoiceover(null);
    setIntroVoiceoverNeedsBuild(false);
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
      if (kind === 'intro') {
        setIntroVideo(file);
        if (introVoiceover) setIntroVoiceoverNeedsBuild(true);
      }
      else setOutroVideo(file);
      setError('');
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Could not validate this video.');
    }
  };

  const PageContainer = embedded ? 'div' : 'main';
  const renderPage = (content: ReactNode) => embedded
    ? content
    : (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <Header />
        {content}
      </div>
    );

  if (loading) {
    return renderPage(
      <PageContainer className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </PageContainer>,
    );
  }

  if (!user || !eligible) {
    return renderPage(
      <PageContainer className="mx-auto max-w-2xl space-y-4 p-6">
        {!embedded && <Button variant="ghost" onClick={() => navigate('/studio')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Studio</Button>}
        <section className="rounded-xl border p-6">
          <h1 className="text-xl font-semibold">Podcast Studio is locked</h1>
          {error
            ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
            : <p className="mt-2 text-sm text-muted-foreground">A Studio channel needs at least 10 reels and 1 subscriber to use Podcast Studio.</p>}
        </section>
      </PageContainer>,
    );
  }

  return renderPage(
    <PageContainer className={`mx-auto max-w-5xl space-y-5 p-4 sm:p-6 ${embedded ? '' : 'pb-20'}`}>
      {embedded && show && (
        <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm" aria-label={`${podcastDisplayName} Podcast`}>
          <div
            className="relative aspect-[16/7] overflow-hidden"
            style={{
              backgroundColor: show.brandColor || '#7c3aed',
              backgroundImage: !show.podcastCoverUrl
                ? `linear-gradient(135deg, ${show.brandColor || '#7c3aed'} 0%, #ec4899 50%, #f59e0b 100%)`
                : undefined,
            }}
          >
            {show.podcastCoverUrl && <img src={show.podcastCoverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/20 backdrop-blur-md">
              <Mic2 className="h-3 w-3" /> Podcast
            </span>
            <input
              ref={bannerInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => handlePodcastArtworkSelect('banner_url', event)}
              aria-label="Choose a new cover image"
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={savingArtwork !== null}
              className="absolute bottom-3 right-3 hidden min-h-10 items-center gap-2 rounded-full bg-black/65 px-4 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-60 md:inline-flex"
              aria-label="Edit podcast cover image"
            >
              {savingArtwork === 'banner_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {savingArtwork === 'banner_url' ? 'Saving cover…' : 'Edit podcast cover'}
            </button>
          </div>
          <div className="px-5 pb-5 sm:px-7">
            <div className="-mt-10 flex items-end gap-3 sm:-mt-12 sm:gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xl ring-4 ring-card sm:h-24 sm:w-24">
                {show.podcastLogoUrl
                  ? <img src={show.podcastLogoUrl} alt={`${podcastDisplayName} logo`} className="h-full w-full object-contain p-2" />
                  : <Mic2 className="h-9 w-9 text-violet-700" />}
                <input
                  ref={logoInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handlePodcastArtworkSelect('logo_url', event)}
                  aria-label="Choose a new podcast logo"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={savingArtwork !== null}
                  className="absolute bottom-1 right-1 hidden h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white ring-2 ring-white transition-colors hover:bg-black disabled:opacity-60 md:flex"
                  aria-label={savingArtwork === 'logo_url' ? 'Saving podcast logo' : 'Edit podcast logo'}
                  title={savingArtwork === 'logo_url' ? 'Saving podcast logo…' : 'Edit podcast logo'}
                >
                  {savingArtwork === 'logo_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </button>
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-xs font-medium text-muted-foreground">Podcast channel</p>
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{podcastDisplayName}</h1>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-xs text-muted-foreground md:hidden">
              Podcast branding is shown here. Use NexSq in a desktop or laptop browser to update the cover or logo.
            </p>
          </div>
        </section>
      )}

      {embedded && show && (
        <div role="tablist" aria-label="Podcast sections" className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2">
          <button
            type="button"
            role="tab"
            id="podcast-episodes-tab"
            aria-controls="podcast-episodes-panel"
            aria-selected={embeddedPodcastTab === 'episodes'}
            onClick={() => setEmbeddedPodcastTab('episodes')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              embeddedPodcastTab === 'episodes'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Mic2 aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Podcast episodes
          </button>
          <button
            type="button"
            role="tab"
            id="podcast-pshorts-tab"
            aria-controls="podcast-pshorts-panel"
            aria-selected={embeddedPodcastTab === 'pshorts'}
            onClick={() => setEmbeddedPodcastTab('pshorts')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              embeddedPodcastTab === 'pshorts'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Scissors aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Podshorts
          </button>
          <button
            type="button"
            role="tab"
            id="podcast-revenue-tab"
            aria-controls="podcast-revenue-panel"
            aria-selected={embeddedPodcastTab === 'revenue'}
            onClick={() => {
              setEmbeddedPodcastTab('revenue');
              void loadPodcastRevenue();
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              embeddedPodcastTab === 'revenue'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <DollarSign aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Revenue
          </button>
          <button
            type="button"
            role="tab"
            id="podcast-create-tab"
            aria-controls="podcast-create-panel"
            aria-selected={embeddedPodcastTab === 'create'}
            onClick={() => setEmbeddedPodcastTab('create')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              embeddedPodcastTab === 'create'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Plus aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Create podcast
          </button>
          <button
            type="button"
            role="tab"
            id="podcast-settings-tab"
            aria-controls="podcast-settings-panel"
            aria-selected={embeddedPodcastTab === 'settings'}
            onClick={() => setEmbeddedPodcastTab('settings')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              embeddedPodcastTab === 'settings'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <Settings aria-hidden="true" className="mr-2 inline h-4 w-4" />
            Settings
          </button>
        </div>
      )}

      {embedded && show && (
        <section
          id="podcast-episodes-panel"
          role="tabpanel"
          aria-labelledby="podcast-episodes-tab"
          hidden={embeddedPodcastTab !== 'episodes'}
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="podcast-episodes-heading" className="text-lg font-semibold">Podcast episodes</h2>
              <p className="text-sm text-muted-foreground">Manage which podcast episodes are published to listeners.</p>
            </div>
            {publishedEpisodes.length > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {publishedEpisodes.length} {publishedEpisodes.length === 1 ? 'episode' : 'episodes'}
              </span>
            )}
          </div>
          {publishedEpisodes.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publishedEpisodes.map((episode) => (
                <div key={episode.id} className="space-y-2">
                  <PodcastEpisodeCard
                    episode={episode}
                    showId={show.id}
                    podcastName={show.podcastName?.trim() || show.title}
                    channelLogoUrl={show.podcastLogoUrl}
                    trackViews={false}
                  />
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${episode.is_active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                      {episode.is_active ? 'Published' : 'Unpublished'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={episode.is_active ? 'outline' : 'default'}
                      disabled={updatingPublishedEpisodeId !== null}
                      onClick={() => void setPublishedEpisodeActive(episode)}
                    >
                      {updatingPublishedEpisodeId === episode.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : null}
                      {episode.is_active ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">No episodes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your published and scheduled episodes will appear here.</p>
            </div>
          )}
        </section>
      )}

      {embedded && show && (
        <section
          id="podcast-revenue-panel"
          role="tabpanel"
          aria-labelledby="podcast-revenue-tab"
          hidden={embeddedPodcastTab !== 'revenue'}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Podcast revenue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid subscription orders, platform fees, and your net earnings.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void loadPodcastRevenue()}
              disabled={loadingPodcastRevenue}
            >
              {loadingPodcastRevenue && <Loader2 className="h-4 w-4 animate-spin" />}
              Refresh
            </Button>
          </div>

          {loadingPodcastRevenue ? (
            <div className="grid min-h-32 place-items-center rounded-xl border" role="status" aria-label="Loading Podcast revenue">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : podcastRevenueError ? (
            <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="text-destructive">{podcastRevenueError}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadPodcastRevenue()}>Try again</Button>
            </div>
          ) : podcastRevenueSummary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'Gross subscription sales', value: formatPodcastMoney(podcastRevenueSummary.gross_revenue) },
                  { label: 'NexSq platform fees', value: formatPodcastMoney(podcastRevenueSummary.platform_fees) },
                  { label: 'Your net earnings', value: formatPodcastMoney(podcastRevenueSummary.creator_earnings) },
                  { label: 'Net earnings · last 30 days', value: formatPodcastMoney(podcastRevenueSummary.last_30_days_net) },
                  { label: 'Paid orders', value: Number(podcastRevenueSummary.paid_orders || 0).toLocaleString() },
                  { label: 'Unique subscribers', value: Number(podcastRevenueSummary.unique_subscribers || 0).toLocaleString() },
                ].map((metric) => (
                  <article key={metric.label} className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-xl font-bold tabular-nums">{metric.value}</p>
                  </article>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">Recent subscription orders</h3>
                  <p className="text-xs text-muted-foreground">Showing the latest 50 paid orders.</p>
                </div>
                {podcastRevenueOrders.length ? (
                  <div className="space-y-2">
                    {podcastRevenueOrders.map((order) => (
                      <article key={order.id} className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{order.podcast_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Invoice {order.invoice_number} · Order {order.order_number}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Paid {formatPodcastDate(order.paid_at)} · Subscription {formatPodcastDate(order.service_period_start)} - {formatPodcastDate(order.service_period_end)}
                            </p>
                          </div>
                          <div className="text-right text-sm tabular-nums">
                            <p className="font-semibold">{formatPodcastMoney(order.creator_net_amount, order.currency)} net</p>
                            <p className="text-xs text-muted-foreground">
                              {formatPodcastMoney(order.gross_amount, order.currency)} gross · {formatPodcastMoney(order.platform_fee_amount, order.currency)} fee
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="font-medium">No paid subscription orders yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Your order activity will appear here after a paid subscription.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}

      {embedded && show && (
        <section
          id="podcast-pshorts-panel"
          role="tabpanel"
          aria-labelledby="podcast-pshorts-tab"
          hidden={embeddedPodcastTab !== 'pshorts'}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Podshorts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create three 9:16 vertical clips. Each ends with a card inviting viewers to subscribe to the channel for the full episode.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Speech captions and highlighted keywords are generated on your device. The speech model downloads once and is then cached; episode audio is not sent to a transcription service.
              </p>
            </div>
            <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
              {PODCAST_SHORT_COUNT} clips · {PODCAST_SHORT_DURATION_SECONDS}s each
            </span>
          </div>

          {publishedEpisodes.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {publishedEpisodes.map((episode) => {
                const hasSavedShorts = generatedPshorts.some((short) => short.episodeId === episode.id);
                return (
                  <article key={episode.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold">{episode.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {episode.duration > 0
                          ? `Uses the beginning, midpoint, and end of the ${formatClipTime(episode.duration)} episode.`
                          : 'Finds the beginning, midpoint, and end after reading the episode duration.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => void generatePshorts(episode)}
                        disabled={loadingSavedPshorts || generatingPshortEpisodeId !== null || hasSavedShorts}
                      >
                        {generatingPshortEpisodeId === episode.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : hasSavedShorts
                            ? <Save className="h-4 w-4" />
                            : <Scissors className="h-4 w-4" />}
                        {generatingPshortEpisodeId === episode.id
                          ? pshortProgressPhase === 'measuring'
                            ? `Measuring ${formatClipTime(pshortScanSeconds)}`
                            : pshortProgressPhase === 'loadingModel'
                              ? `Loading speech model ${pshortModelProgress}%`
                              : pshortProgressPhase === 'transcribing'
                                ? `Transcribing ${pshortGenerationProgress}/${PODCAST_SHORT_COUNT}`
                                : pshortProgressPhase === 'renderingCaptions'
                                  ? `Adding captions ${pshortGenerationProgress}/${PODCAST_SHORT_COUNT}`
                                  : `Extracting ${pshortGenerationProgress}/${PODCAST_SHORT_COUNT}`
                          : hasSavedShorts ? 'Clips saved' : 'Extract 3 clips'}
                      </Button>
                      {hasSavedShorts && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => setEpisodeToReextract(episode)}
                          disabled={loadingSavedPshorts || generatingPshortEpisodeId !== null}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Re-extract
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">No published episodes to clip yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Publish an episode first, then return here to make Podshorts.</p>
            </div>
          )}

          {generatedPshorts.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Saved Podshorts</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Your clips remain available here after you refresh.</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sharePshortsToFeed}
                      onChange={(event) => setSharePshortsToFeed(event.target.checked)}
                    />
                    Share to Feed
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sharePshortsToMoments}
                      onChange={(event) => setSharePshortsToMoments(event.target.checked)}
                    />
                    Share to Moments
                  </label>
                </div>
              </div>

              {Array.from(new Set(generatedPshorts.map((short) => short.episodeId))).map((episodeId) => {
                const episodeShorts = generatedPshorts.filter((short) => short.episodeId === episodeId);
                return (
                  <section key={episodeId} className="space-y-3">
                    <h4 className="font-medium">Clips from {episodeShorts[0].episodeTitle}</h4>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {episodeShorts.map((short) => {
                        const isPublished = publishedPshortIds.includes(short.id);
                        const isPublishing = publishingPshortIds.includes(short.id);
                        const isDeleting = deletingPshortId === short.id;
                        return (
                          <article key={short.id} className="overflow-hidden rounded-xl border bg-card">
                            <video
                              src={short.previewUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="aspect-[9/16] w-full bg-black object-contain"
                              aria-label={`Preview Podshort ${short.index + 1} from ${short.episodeTitle}`}
                            />
                            <div className="space-y-3 p-4">
                              <div>
                                <h4 className="font-semibold">Podshort {short.index + 1}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {formatClipTime(short.startSeconds)}–{formatClipTime(short.startSeconds + short.durationSeconds)}
                                </p>
                              </div>
                              <label className="block space-y-1.5 text-xs font-medium">
                                Caption
                                <Input
                                  value={short.caption}
                                  onChange={(event) => updatePshortCaption(short.id, event.target.value)}
                                  onBlur={() => void savePshortCaption(short.id, short.caption)}
                                  maxLength={180}
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => void downloadPshort(short)}>
                                  <Download className="h-4 w-4" />
                                  Download
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" size="sm" variant="outline" className="gap-2">
                                      <Share2 className="h-4 w-4" />
                                      Share
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-64">
                                    <DropdownMenuLabel>Share this Podshort</DropdownMenuLabel>
                                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                      Facebook and WhatsApp share a link. Instagram and Status use your device share sheet when supported.
                                    </p>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => void sharePshort(short, 'facebook')}>
                                      <Facebook className="mr-2 h-4 w-4 text-blue-600" />
                                      Facebook
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => void sharePshort(short, 'instagram')}>
                                      <Instagram className="mr-2 h-4 w-4 text-pink-600" />
                                      Instagram
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => void sharePshort(short, 'whatsapp')}>
                                      <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                                      WhatsApp
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => void sharePshort(short, 'whatsapp-status')}>
                                      <UserRound className="mr-2 h-4 w-4 text-green-600" />
                                      WhatsApp Status
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => void publishPshort(short)}
                                  disabled={isPublishing || isPublished || !short.caption.trim()}
                                >
                                  {isPublishing
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : isPublished
                                      ? <Share2 className="h-4 w-4" />
                                      : <Video className="h-4 w-4" />}
                                  {isPublishing ? 'Publishing…' : isPublished ? 'Added to Studio' : 'Publish Podshort'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-destructive hover:text-destructive"
                                  onClick={() => setPshortToDelete(short)}
                                  disabled={isPublishing || isDeleting || deletingPshortId !== null}
                                >
                                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div
        id={embedded ? 'podcast-create-panel' : undefined}
        role={embedded ? 'tabpanel' : undefined}
        aria-labelledby={embedded ? 'podcast-create-tab' : undefined}
        hidden={embedded && embeddedPodcastTab !== 'create'}
        className="space-y-5"
      >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!embedded && <Button variant="ghost" className="-ml-3 mb-2" onClick={() => navigate('/studio')}><ArrowLeft className="mr-2 h-4 w-4" />Back to Studio</Button>}
          {embedded
            ? <h2 className="text-2xl font-bold">Creator Podcast Studio</h2>
            : <h1 className="text-2xl font-bold">Creator Podcast Studio</h1>}
          <p className="mt-1 text-sm text-muted-foreground">Create an episode, brand your intro and outro, then record in the landscape teleprompter.</p>
        </div>
        <Button variant="outline" onClick={resetEditor}>New episode</Button>
      </header>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
        <p className="font-medium">Your episode drafts stay private until you publish them.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {applicationStatus === 'approved'
            ? 'Your Podcast channel is approved. Publish episodes immediately or schedule their premiere after recording.'
            : applicationStatus === 'pending'
              ? 'Your show application is under review. You can prepare and save private drafts while you wait.'
              : 'You can prepare private episode drafts now. Apply for a TV show slot before publishing.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <section className="space-y-5 rounded-xl border p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Podcast Channel Name
              <Input value={podcastDisplayName} readOnly aria-readonly="true" />
              <span className="block text-xs font-normal text-muted-foreground">
                Your conversation topic below will be used as the episode title.
              </span>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Host name(s)
              <Input value={hostNames} onChange={(event) => setHostNames(event.target.value)} maxLength={120} placeholder="One or two presenters" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className="space-y-1.5 text-sm font-medium">
              Conversation topic (episode title)
              <Input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={120} placeholder="What should this episode explore?" />
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

          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          <label className="block space-y-1.5 text-sm font-medium">
            Presenter guide / podcast script
            <textarea value={script} onChange={(event) => setScript(event.target.value)} rows={18} maxLength={40000} placeholder="Generate a guided rundown from your topic or write your own." className="w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
            <span className="block text-xs font-normal text-muted-foreground">
              Topic-only generations are paced conversation guides with angles, synopses, and prompts—not dialogue to read word for word.
            </span>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Episode description <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={1200} className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>

          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">Brand your system intro and outro</h2>
            <p className="text-xs text-muted-foreground">The system intro and outro are each 15 seconds. The outro displays the next approved show slot; if recording reaches its target runtime, the outro begins during the final 15 seconds. Add your artwork and logo, or upload prebuilt landscape video clips.</p>
            <Tabs
              value={broadcastTab}
              onValueChange={(value) => {
                if (value === 'create' || value === 'saved') setBroadcastTab(value);
              }}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create new intro/outro</TabsTrigger>
                <TabsTrigger value="saved">Saved intro/outro</TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium">
                Cover image / banner
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && validateImage(event.target.files[0], setCoverImage)} />
                {coverImage && <span className="block truncate text-muted-foreground">{coverImage.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Podcast logo
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && validateImage(event.target.files[0], setLogoImage)} />
                {logoImage && <span className="block truncate text-muted-foreground">{logoImage.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Optional prebuilt intro video (max 15 seconds)
                <Input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={recordingVoiceover || buildingIntro || saving} onChange={(event) => event.target.files?.[0] && void validateCustomVideo(event.target.files[0], 'intro')} />
                {introVideo && <span className="block truncate text-muted-foreground">{introVideo.name}</span>}
              </label>
              <label className="space-y-1.5 text-xs font-medium">
                Optional prebuilt outro video (loops during the 15-second outro)
                <Input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={recordingOutroAudio || buildingOutro || saving || savingBroadcastDefaults} onChange={(event) => event.target.files?.[0] && void validateCustomVideo(event.target.files[0], 'outro')} />
                {outroVideo && <span className="block truncate text-muted-foreground">{outroVideo.name}</span>}
              </label>
            </div>
            <details ref={introEditorRef} className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {editingBroadcastDefault === 'intro' ? 'Edit saved intro' : 'Create a spoken intro with music'}
              </summary>
              <div className="mt-3 space-y-3">
                {editingBroadcastDefault === 'intro' && (
                  <p role="status" className="text-xs text-muted-foreground">
                    Record a replacement voiceover and save it to replace the current saved intro.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Record up to 15 seconds of your voice. The generated intro is exactly 15 seconds; it uses the first 15 seconds of the soundtrack (looping shorter tracks), mixed under your voice. Choose separate volumes and a voice effect before creating it.
                </p>
                <label className="block space-y-1.5 text-xs font-medium">
                  Background soundtrack
                  <select
                    value={selectedSoundtrackUrl}
                    onChange={(event) => {
                      setSelectedSoundtrackUrl(event.target.value);
                      if (introVoiceover) setIntroVoiceoverNeedsBuild(true);
                    }}
                    disabled={!PODCAST_SOUNDTRACKS.length || recordingVoiceover || buildingIntro}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PODCAST_SOUNDTRACKS.map((soundtrack) => (
                      <option key={soundtrack.url} value={soundtrack.url}>{soundtrack.name}</option>
                    ))}
                    {!PODCAST_SOUNDTRACKS.length && <option value="">No soundtracks available</option>}
                  </select>
                </label>
                {selectedSoundtrackUrl && (
                  <audio
                    key={selectedSoundtrackUrl}
                    ref={soundtrackPreviewRef}
                    controls
                    loop
                    preload="none"
                    src={selectedSoundtrackUrl}
                    onTimeUpdate={(event) => {
                      if (event.currentTarget.currentTime >= PODCAST_INTRO_DURATION_MS / 1000) {
                        event.currentTarget.pause();
                        event.currentTarget.currentTime = PODCAST_INTRO_DURATION_MS / 1000;
                      }
                    }}
                    className="w-full"
                    aria-label="Preview soundtrack, limited to 15 seconds"
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-xs font-medium">
                    Soundtrack volume <output className="float-right">{soundtrackVolume}%</output>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={soundtrackVolume}
                      aria-label="Soundtrack volume"
                      onChange={(event) => {
                        setSoundtrackVolume(Number(event.target.value));
                        if (introVoiceover) setIntroVoiceoverNeedsBuild(true);
                      }}
                      className="w-full accent-primary"
                    />
                  </label>
                  <label className="block space-y-1.5 text-xs font-medium">
                    Voiceover volume <output className="float-right">{voiceoverVolume}%</output>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={voiceoverVolume}
                      aria-label="Voiceover volume"
                      onChange={(event) => {
                        setVoiceoverVolume(Number(event.target.value));
                        if (introVoiceover) setIntroVoiceoverNeedsBuild(true);
                      }}
                      className="w-full accent-primary"
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-xs font-medium">
                  Voice effect
                  <select
                    value={voiceEffect}
                    onChange={(event) => {
                      const selectedEffect = VOICE_EFFECTS.find((effect) => effect.value === event.target.value);
                      if (!selectedEffect) return;
                      setVoiceEffect(selectedEffect.value);
                      if (introVoiceover) setIntroVoiceoverNeedsBuild(true);
                    }}
                    disabled={recordingVoiceover || buildingIntro}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {VOICE_EFFECTS.map((effect) => (
                      <option key={effect.value} value={effect.value}>{effect.label}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={recordingVoiceover ? 'destructive' : 'outline'}
                    onClick={() => void recordIntroVoiceover()}
                    disabled={recordingOutroAudio || saving || buildingIntro}
                    className="gap-2"
                  >
                    {recordingVoiceover ? <CircleStop className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                    {recordingVoiceover ? 'Stop voiceover' : 'Record voiceover'}
                  </Button>
                  {recordingVoiceover && <span className="text-xs text-red-600">Recording · stops automatically after 15 seconds</span>}
                </div>
                {introVoiceoverUrl && (
                  <label className="block space-y-1.5 text-xs font-medium">
                    Preview your voice (up to 15 seconds)
                    <audio ref={voiceoverPreviewRef} controls src={introVoiceoverUrl} className="w-full" />
                  </label>
                )}
                {introVoiceoverNeedsBuild && (
                  <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
                    Mixer settings changed. Recreate the 15-second intro to apply them before saving.
                  </p>
                )}
                <Button
                  type="button"
                  onClick={() => void createVoiceoverIntro()}
                  disabled={!introVoiceover || !selectedSoundtrackUrl || recordingVoiceover || buildingIntro || saving || savingBroadcastDefaults}
                  className="gap-2"
                >
                  {buildingIntro ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                  {buildingIntro ? 'Creating and saving intro…' : editingBroadcastDefault === 'intro' ? 'Save intro changes' : 'Create new branded voiceover intro'}
                </Button>
                {introVideoPreviewUrl && (
                  <video src={introVideoPreviewUrl} controls playsInline className="w-full rounded-md bg-black" />
                )}
                {!PODCAST_SOUNDTRACKS.length && (
                  <p role="alert" className="text-xs text-destructive">No soundtrack files were found in the repository soundtrack folder.</p>
                )}
              </div>
            </details>
            <section ref={outroEditorRef} className="space-y-3 rounded-md border p-3">
              <div>
                <h3 className="text-sm font-semibold">Branded outro</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a 15-second NexSq end card with your Podcast artwork, show name, and host. Record or upload optional audio to play over the end card; audio is trimmed to 15 seconds. The next approved slot is added to each episode when it is recorded.
                </p>
                {editingBroadcastDefault === 'outro' && (
                  <p role="status" className="mt-2 text-xs text-muted-foreground">
                    Update the host or artwork above, then save to replace the current saved outro.
                  </p>
                )}
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <label className="block space-y-1.5 text-xs font-medium">
                  Optional outro audio
                  <Input
                    ref={outroAudioInputRef}
                    type="file"
                    accept="audio/*"
                    disabled={recordingVoiceover || recordingOutroAudio || buildingOutro || saving || savingBroadcastDefaults}
                    onChange={(event) => {
                      setOutroAudio(event.target.files?.[0] || null);
                      setError('');
                    }}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={recordingOutroAudio ? 'destructive' : 'outline'}
                    onClick={() => void recordOutroAudio()}
                    disabled={recordingVoiceover || buildingOutro || saving || savingBroadcastDefaults}
                    className="gap-2"
                  >
                    {recordingOutroAudio ? <CircleStop className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                    {recordingOutroAudio ? 'Stop outro audio' : 'Record outro audio'}
                  </Button>
                  {recordingOutroAudio && <span className="text-xs text-red-600">Recording · stops automatically after 15 seconds</span>}
                  {outroAudio && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOutroAudio(null);
                        if (outroAudioInputRef.current) outroAudioInputRef.current.value = '';
                      }}
                    >
                      Remove audio
                    </Button>
                  )}
                </div>
                {outroAudioPreviewUrl && (
                  <audio src={outroAudioPreviewUrl} controls className="w-full" aria-label="Preview outro audio" />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void createBrandedOutro()}
                disabled={recordingOutroAudio || buildingOutro || saving || savingBroadcastDefaults}
                className="gap-2"
              >
                {buildingOutro ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {buildingOutro ? 'Creating and saving outro…' : editingBroadcastDefault === 'outro' ? 'Save outro changes' : 'Create new branded outro'}
              </Button>
              {outroVideoPreviewUrl && (
                <video src={outroVideoPreviewUrl} controls playsInline className="w-full rounded-md bg-black" />
              )}
            </section>
            {activeShow && (introVideo || outroVideo || introVideoPath || outroVideoPath) && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveBroadcastDefaults()}
                disabled={savingBroadcastDefaults || saving || buildingIntro || buildingOutro}
                className="w-full gap-2"
              >
                {savingBroadcastDefaults && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingBroadcastDefaults ? 'Saving show defaults…' : 'Save selected intro/outro as show defaults'}
              </Button>
            )}
              </TabsContent>
              <TabsContent value="saved" className="space-y-3">
                {activeShow ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Saved sequences are used for new episodes. The next approved broadcast time is added dynamically when an episode is recorded.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <article className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">Saved intro</h3>
                          {!activeShow.podcastIntroUrl && <span className="text-xs text-muted-foreground">Not created</span>}
                        </div>
                        {activeShow.podcastIntroUrl ? (
                          <>
                            <video
                              src={activeShow.podcastIntroUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full rounded-md bg-black"
                              aria-label="Saved podcast intro"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => focusBroadcastEditor('intro')} className="gap-1.5">
                                <Pencil className="h-3.5 w-3.5" />
                                Edit/replace
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => setBroadcastDefaultToDelete('intro')}
                                disabled={Boolean(deletingBroadcastDefault) || savingBroadcastDefaults}
                                className="gap-1.5"
                              >
                                {deletingBroadcastDefault === 'intro' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            No saved intro yet. Use the Create tab to make one.
                          </p>
                        )}
                      </article>
                      <article className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">Saved outro</h3>
                          {!activeShow.podcastOutroUrl && <span className="text-xs text-muted-foreground">Not created</span>}
                        </div>
                        {activeShow.podcastOutroUrl ? (
                          <>
                            <video
                              src={activeShow.podcastOutroUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full rounded-md bg-black"
                              aria-label="Saved podcast outro"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => focusBroadcastEditor('outro')} className="gap-1.5">
                                <Pencil className="h-3.5 w-3.5" />
                                Edit/replace
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => setBroadcastDefaultToDelete('outro')}
                                disabled={Boolean(deletingBroadcastDefault) || savingBroadcastDefaults}
                                className="gap-1.5"
                              >
                                {deletingBroadcastDefault === 'outro' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            No saved outro yet. Use the Create tab to make one.
                          </p>
                        )}
                      </article>
                    </div>
                  </>
                ) : (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Saved intro and outro sequences are available after your Podcast channel is approved.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <section className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Episode release</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${releaseMode === 'immediate' ? 'border-primary bg-primary/5' : ''}`}>
                <input
                  type="radio"
                  name="episode-release"
                  value="immediate"
                  checked={releaseMode === 'immediate'}
                  onChange={() => setReleaseMode('immediate')}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium">Publish immediately</span>
                  <span className="text-xs text-muted-foreground">Make the episode available as soon as it is published.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${releaseMode === 'scheduled' ? 'border-primary bg-primary/5' : ''}`}>
                <input
                  type="radio"
                  name="episode-release"
                  value="scheduled"
                  checked={releaseMode === 'scheduled'}
                  onChange={() => setReleaseMode('scheduled')}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium">Schedule a premiere</span>
                  <span className="text-xs text-muted-foreground">Choose when subscribers can watch the episode.</span>
                </span>
              </label>
            </div>
            {releaseMode === 'scheduled' && (
              <label className="block max-w-sm space-y-1.5 text-sm font-medium">
                Premiere date and time
                <Input
                  type="datetime-local"
                  value={scheduledPremiere}
                  min={toLocalDateTimeInput(new Date(Date.now() + 60_000))}
                  onChange={(event) => setScheduledPremiere(event.target.value)}
                  required
                />
                <span className="block text-xs font-normal text-muted-foreground">
                  The episode stays private to you and your channel team until the premiere time.
                </span>
              </label>
            )}
          </section>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={saving || publishing || recordingVoiceover || buildingIntro} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save private draft
            </Button>
            <Button type="button" onClick={() => void startRecording()} disabled={saving || publishing || recordingVoiceover || buildingIntro || !script.trim()} className="gap-2 bg-red-700 text-white hover:bg-red-800">
              <Video className="h-4 w-4" />Open landscape teleprompter
            </Button>
            <Button
              type="button"
              onClick={() => void publishEpisode()}
              disabled={!draftId || !recordingPath || applicationStatus !== 'approved' || publishing || ['pending_review', 'published'].includes(drafts.find((draft) => draft.id === draftId)?.status || '')}
              className="gap-2"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {publishing ? 'Publishing…' : releaseMode === 'scheduled' ? 'Schedule premiere' : 'Publish episode'}
            </Button>
            {draftId && drafts.find((draft) => draft.id === draftId)?.status !== 'pending_review' && drafts.find((draft) => draft.id === draftId)?.status !== 'published' && (
            <Button type="button" variant="ghost" onClick={() => void deleteDraft()} disabled={recordingVoiceover || buildingIntro || saving || publishing} className="gap-2 text-destructive"><Trash2 className="h-4 w-4" />Delete draft</Button>
            )}
          </div>

          {recordingUrl && <video src={recordingUrl} controls playsInline className="w-full rounded-lg bg-black" />}
          {recordingPath && !recordingUrl && <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileVideo className="h-4 w-4" />A recording is saved in this draft.</p>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">Your saved drafts and submissions</h2>
            {drafts.length ? (
              <div className="space-y-2">
                {drafts.map((draft) => {
                  const episode = publishedEpisodes.find((item) => item.id === draft.episode_id);
                  const premiereTime = episode?.scheduled_time ? new Date(episode.scheduled_time) : null;
                  const statusLabel = premiereTime && premiereTime.getTime() > Date.now()
                    ? `Premiere ${premiereTime.toLocaleString()}`
                    : draft.status.replace('_', ' ');
                  return (
                    <button key={draft.id} type="button" onClick={() => void loadDraft(draft)} disabled={recordingVoiceover || buildingIntro || saving || publishing} className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${draft.id === draftId ? 'border-primary' : ''}`}>
                      <span className="block truncate text-sm font-medium">{draft.title}</span>
                      <span className="mt-1 block text-xs capitalize text-muted-foreground">{statusLabel}</span>
                      {draft.reviewer_notes && <span className="mt-1 block text-xs text-amber-700">{draft.reviewer_notes}</span>}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">Your saved recordings and scripts will appear here.</p>}
          </section>
          <section className="rounded-xl border bg-muted/20 p-4 text-sm">
            <h2 className="flex items-center gap-2 font-semibold"><Mic2 className="h-4 w-4" />TV format guide</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Record in landscape (16:9). Your episode stays private until you publish it, or until its scheduled premiere begins for subscribers.</p>
          </section>
          {recordingPath && <div className="flex items-center gap-2 text-xs text-emerald-700"><Play className="h-3.5 w-3.5" />Recording saved privately</div>}
        </aside>
      </div>

      <Dialog
        open={Boolean(bannerCropImage)}
        onOpenChange={(open) => {
          if (!open && !processingCover && savingArtwork !== 'banner_url') closeBannerCrop();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Position your cover image</DialogTitle>
            <DialogDescription>Drag the image to position it, then adjust the zoom to fit the wide cover area.</DialogDescription>
          </DialogHeader>
          {bannerCropImage && (
            <div className="space-y-4">
              <div className="relative h-56 w-full overflow-hidden rounded-lg bg-muted sm:h-72">
                <Cropper
                  image={bannerCropImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={PODCAST_COVER_ASPECT}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, area) => setCroppedAreaPixels(area)}
                  showGrid
                />
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Zoom: {Math.round(zoom * 100)}%
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-primary"
                  aria-label="Cover image zoom"
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeBannerCrop}
              disabled={processingCover || savingArtwork === 'banner_url'}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCoverCropSave()}
              disabled={!croppedAreaPixels || processingCover || savingArtwork !== null}
              className="gap-2"
            >
              {processingCover || savingArtwork === 'banner_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {processingCover || savingArtwork === 'banner_url' ? 'Saving cover…' : 'Save cover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(broadcastDefaultToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingBroadcastDefault) setBroadcastDefaultToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved {broadcastDefaultToDelete}?</DialogTitle>
            <DialogDescription>
              This removes the {broadcastDefaultToDelete} from your Podcast show defaults, so new episodes will no longer use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBroadcastDefaultToDelete(null)}
              disabled={Boolean(deletingBroadcastDefault)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => broadcastDefaultToDelete && void deleteBroadcastDefault(broadcastDefaultToDelete)}
              disabled={!broadcastDefaultToDelete || Boolean(deletingBroadcastDefault)}
              className="gap-2"
            >
              {deletingBroadcastDefault && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletingBroadcastDefault ? 'Deleting…' : 'Delete sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(episodeToReextract)}
        onOpenChange={(open) => {
          if (!open && !generatingPshortEpisodeId) setEpisodeToReextract(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-extract Podshorts?</DialogTitle>
            <DialogDescription>
              Replace the saved clips for “{episodeToReextract?.title}” with newly extracted clips and captions? Any already-published videos will remain available, but the new clips will need to be published separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEpisodeToReextract(null)}
              disabled={Boolean(generatingPshortEpisodeId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                if (!episodeToReextract) return;
                const episode = episodeToReextract;
                setEpisodeToReextract(null);
                void generatePshorts(episode, true);
              }}
              disabled={!episodeToReextract || Boolean(generatingPshortEpisodeId)}
            >
              {generatingPshortEpisodeId && <Loader2 className="h-4 w-4 animate-spin" />}
              Re-extract clips
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pshortToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingPshortId) setPshortToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this Podshort?</DialogTitle>
            <DialogDescription>
              {pshortToDelete?.publishedVideoId
                ? `Remove Podshort ${pshortToDelete.index + 1} from your saved clips? Its already-published Studio video will remain available.`
                : `Delete Podshort ${pshortToDelete ? pshortToDelete.index + 1 : ''} and its saved video file? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPshortToDelete(null)}
              disabled={Boolean(deletingPshortId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() => pshortToDelete && void deletePshort(pshortToDelete)}
              disabled={!pshortToDelete || Boolean(deletingPshortId)}
            >
              {deletingPshortId && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletingPshortId ? 'Deleting…' : 'Delete Podshort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      {embedded && show && (
        <section
          id="podcast-settings-panel"
          role="tabpanel"
          aria-labelledby="podcast-settings-tab"
          hidden={embeddedPodcastTab !== 'settings'}
          className="space-y-5 rounded-xl border p-4 sm:p-6"
        >
          <header>
            <h2 className="text-xl font-semibold">Podcast channel settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a Podcast identity independent from your TV show, and choose how people subscribe.
            </p>
          </header>
          <label className="block space-y-1.5 text-sm font-medium">
            Podcast channel name
            <Input
              value={podcastName}
              onChange={(event) => setPodcastName(event.target.value)}
              maxLength={120}
              placeholder="Give your podcast its own name"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              This name appears on the public Podcast channel, separate from the TV show title.
            </span>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Podcast description
            <textarea
              value={podcastDescription}
              onChange={(event) => setPodcastDescription(event.target.value)}
              maxLength={1200}
              rows={4}
              className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Tell listeners what your Podcast channel is about."
            />
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Subscription plan</legend>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="radio"
                name="podcast-subscription-mode"
                value="free"
                checked={subscriptionMode === 'free'}
                onChange={() => {
                  setSubscriptionMode('free');
                  setSubscriptionPrice(0);
                }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Free subscription</span>
                <span className="block text-xs text-muted-foreground">Listeners can subscribe without a wallet payment.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="radio"
                name="podcast-subscription-mode"
                value="paid"
                checked={subscriptionMode === 'paid'}
                onChange={() => {
                  setSubscriptionMode('paid');
                  if (subscriptionPrice <= 0) setSubscriptionPrice(1);
                }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Paid monthly subscription</span>
                <span className="block text-xs text-muted-foreground">Subscribers pay from their real wallet balance. NexSq retains a 10% platform fee and 90% goes to your wallet. Both accounts need verified, active wallets.</span>
              </span>
            </label>
          </fieldset>
          {subscriptionMode === 'paid' && (
            <label className="block max-w-xs space-y-1.5 text-sm font-medium">
              Monthly price (30 days, USD)
              <Input
                type="number"
                min="0.01"
                max="500"
                step="0.01"
                value={subscriptionPrice || ''}
                onChange={(event) => setSubscriptionPrice(Number(event.target.value))}
                required
              />
              <span className="block text-xs font-normal text-muted-foreground">
                Subscriptions last 30 days and are renewed manually; NexSq will not automatically charge a wallet. Your displayed price is the subscriber’s total; your payout is 90% after the platform fee.
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void savePodcastSettings()}
              disabled={
                savingPodcastSettings
                || podcastName.trim().length < 2
                || (subscriptionMode === 'paid' && (!Number.isFinite(subscriptionPrice) || subscriptionPrice < 0.01 || subscriptionPrice > 500))
              }
              className="gap-2"
            >
              {savingPodcastSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingPodcastSettings ? 'Saving settings…' : 'Save Podcast settings'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/podcast/${show.id}`)}>
              View public Podcast page
            </Button>
          </div>
        </section>
      )}
    </PageContainer>,
  );
}
