import { useCallback, useRef, useState } from 'react';
import { CalendarDays, Eye, Mic2, Play, Share2 } from 'lucide-react';
import { PodcastEpisodeEngagement } from '@/components/podcast/PodcastEpisodeEngagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PodcastEpisodeCardData = {
  id: string;
  title: string;
  topic: string | null;
  host_names: string | null;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  scheduled_time: string | null;
  views: number | null;
  shares: number | null;
  likes: number | null;
  is_active?: boolean;
};

export function PodcastEpisodeCard({
  episode,
  showId,
  podcastName,
  channelLogoUrl,
  trackViews = true,
}: {
  episode: PodcastEpisodeCardData;
  showId: string;
  podcastName: string;
  channelLogoUrl: string | null;
  trackViews?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [views, setViews] = useState(episode.views || 0);
  const [shares, setShares] = useState(episode.shares || 0);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [autoPlayDiscussionVideo, setAutoPlayDiscussionVideo] = useState(false);
  const { toast } = useToast();
  const viewCountedRef = useRef(false);
  const viewCountInFlightRef = useRef(false);
  const episodeTopic = episode.topic?.trim();
  const thumbnailHeading = episodeTopic || episode.title;
  const showEpisodeTitle = episodeTopic
    && episode.title.trim().toLowerCase() !== podcastName.trim().toLowerCase()
    && episodeTopic.toLowerCase() !== episode.title.trim().toLowerCase();

  const recordView = async () => {
    if (!trackViews || viewCountedRef.current || viewCountInFlightRef.current) return;
    viewCountInFlightRef.current = true;
    try {
      const { data, error } = await supabase.rpc(
        'increment_studio_episode_views',
        { p_episode_id: episode.id },
      );
      if (error) throw error;
      setViews(Number(data ?? views + 1));
      viewCountedRef.current = true;
    } catch (viewError) {
      console.error('Could not record podcast episode view:', viewError);
    } finally {
      viewCountInFlightRef.current = false;
    }
  };

  const playEpisode = () => {
    setPlaybackError('');
    const video = videoRef.current;
    if (!video) {
      setPlaybackError('The episode player is not ready yet. Please try again.');
      return;
    }
    video.muted = false;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = 0;
    void video.play().catch((playError: unknown) => {
      setPlaybackError(playError instanceof Error ? playError.message : 'Could not play this episode.');
    });
  };

  const handleDiscussionOpen = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handleDiscussionOpenChange = useCallback((open: boolean) => {
    setDiscussionOpen(open);
    if (!open) setAutoPlayDiscussionVideo(false);
  }, []);

  const openFullscreenPlayer = () => {
    setAutoPlayDiscussionVideo(true);
    setDiscussionOpen(true);
  };

  const shareEpisode = async () => {
    const url = new URL(`/podcast/${encodeURIComponent(showId)}`, window.location.origin);
    url.searchParams.set('episode', episode.id);
    const shareUrl = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: episode.title,
          text: `Listen to ${episode.title} on ${podcastName}`,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Episode link copied', description: 'Share it with anyone you want to invite.' });
      } else {
        throw new Error('Sharing is not supported in this browser.');
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      console.error('Could not share podcast episode:', shareError);
      toast({
        title: 'Could not share episode',
        description: shareError instanceof Error ? shareError.message : 'Please try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc(
        'increment_studio_episode_shares',
        { p_episode_id: episode.id },
      );
      if (error) throw error;
      setShares(Number(data ?? shares + 1));
    } catch (shareCountError) {
      console.error('Could not record podcast episode share:', shareCountError);
      toast({
        title: 'Link shared, but count could not be updated',
        description: shareCountError instanceof Error ? shareCountError.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <article id={`podcast-episode-${episode.id}`} className="scroll-mt-6 overflow-hidden rounded-xl border bg-card">
      <div className="group relative aspect-video overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-950 to-violet-950">
        <video
          ref={videoRef}
          src={episode.video_url}
          controls={isPlaying}
          playsInline
          muted={!isPlaying}
          preload="metadata"
          className={`absolute inset-0 h-full w-full bg-black object-cover transition-opacity ${previewReady ? 'opacity-100' : 'opacity-0'}`}
          aria-label={`Play ${episode.title}`}
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            const previewTime = Number.isFinite(duration)
              ? duration >= 75 ? 60 : duration >= 45 ? 30 : duration / 2
              : 60;
            previewTimeRef.current = previewTime;
            event.currentTarget.currentTime = previewTime;
          }}
          onSeeked={(event) => {
            if (!isPlaying) {
              event.currentTarget.pause();
              setPreviewReady(true);
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            setPreviewReady(true);
            setPlaybackError('');
            void recordView();
          }}
          onEnded={(event) => {
            event.currentTarget.pause();
            event.currentTarget.currentTime = previewTimeRef.current;
            setIsPlaying(false);
          }}
        />
        {!isPlaying && (
          <div className="absolute inset-0 overflow-hidden text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/25 to-black/80" />
            <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-emerald-200/20" />
            <div className="absolute -right-4 -top-10 h-36 w-36 rounded-full border border-emerald-200/15" />
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-300 via-emerald-500 to-amber-300" />
            <div className="absolute left-4 right-4 top-4 flex items-center gap-2 sm:left-5 sm:top-5">
              <span className="rounded-full border border-emerald-200/40 bg-emerald-400/15 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-100 sm:text-[9px]">
                NexSq original
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/85 sm:text-[11px]">
                {podcastName}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-16 sm:bottom-5 sm:left-5">
              <p className="mb-1 text-[8px] font-extrabold uppercase tracking-[0.28em] text-emerald-300 sm:text-[9px]">
                The conversation
              </p>
              <h3 className="line-clamp-2 max-w-[95%] text-xl font-black uppercase leading-[0.98] tracking-[-0.04em] drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)] sm:text-2xl">
                {thumbnailHeading}
              </h3>
              {showEpisodeTitle && (
                <p className="mt-1.5 line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-white/75 sm:text-[11px]">
                  {episode.title}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={episode.is_active === false ? playEpisode : openFullscreenPlayer}
              aria-label={`Play episode: ${episode.title}`}
              className="absolute bottom-4 right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.55)] transition hover:scale-105 hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-5 sm:right-5"
            >
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </button>
            {playbackError && (
              <p role="alert" className="absolute inset-x-3 bottom-16 z-10 rounded-md bg-black/75 px-2 py-1 text-xs text-white">
                {playbackError}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        {showEpisodeTitle && <h3 className="line-clamp-2 font-semibold">{episode.title}</h3>}
        {episode.description && <p className="line-clamp-3 text-sm text-muted-foreground">{episode.description}</p>}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {channelLogoUrl ? (
              <img src={channelLogoUrl} alt="" className="h-7 w-7 shrink-0 rounded-full border bg-background object-contain p-0.5" />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-muted text-foreground/70">
                <Mic2 className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="font-medium text-foreground">{podcastName}</span>
          </div>
          <p><span className="font-medium text-foreground/70">Topic:</span> {episode.topic?.trim() || 'Not specified'}</p>
          <p><span className="font-medium text-foreground/70">Host:</span> {episode.host_names?.trim() || 'Not listed'}</p>
        </div>
        <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {episode.scheduled_time && new Date(episode.scheduled_time).getTime() > Date.now()
                ? `Premieres ${new Date(episode.scheduled_time).toLocaleString()}`
                : new Date(episode.created_at).toLocaleDateString()}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {Number(views).toLocaleString()} views
          </span>
        </p>
        <div className="flex items-center justify-between gap-3">
          {episode.is_active !== false && (
            <PodcastEpisodeEngagement
              episodeId={episode.id}
              showId={showId}
              episodeTitle={episode.title}
              shareCount={Number(shares) || 0}
              onShareEpisode={() => { void shareEpisode(); }}
              podcastName={podcastName}
              topic={episode.topic?.trim() || 'Discussion topic'}
              hostNames={episode.host_names?.trim() || 'Your host'}
              channelLogoUrl={channelLogoUrl}
              videoUrl={episode.video_url}
              thumbnailUrl={episode.thumbnail_url}
              initialLikes={Number(episode.likes) || 0}
              open={discussionOpen}
              autoPlayVideo={autoPlayDiscussionVideo}
              onOpenChange={handleDiscussionOpenChange}
              onDiscussionOpen={handleDiscussionOpen}
              onEpisodePlay={() => void recordView()}
            />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void shareEpisode()}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Share ${episode.title}`}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <span className="text-xs text-muted-foreground" aria-label={`${shares} shares`}>
              {Number(shares).toLocaleString()} shares
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
