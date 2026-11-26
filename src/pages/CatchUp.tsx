import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import VODLibrary, { VODEpisode } from '@/components/VODLibrary';
import { LiveChat } from '@/components/LiveChat';
import { recordWatchHistory, WatchHistoryItem } from '@/lib/watchHistory';
import { getVodEpisodeArtwork } from '@/utils/vodEpisodeArtwork';
import { resolvePodcastEpisodeVideoUrl } from '@/utils/podcastRecordingStorage';

const CATCH_UP_RESUME_KEY = 'nexsq-catch-up-resume';

type CatchUpResumeState = {
  episode: VODEpisode;
  currentTime: number;
};

const isVODEpisode = (value: unknown): value is VODEpisode => {
  if (!value || typeof value !== 'object') return false;
  const episode = value as Record<string, unknown>;
  return (
    typeof episode.id === 'string' &&
    typeof episode.title === 'string' &&
    typeof episode.created_at === 'string' &&
    typeof episode.video_url === 'string'
  );
};

const readCatchUpResume = (): CatchUpResumeState | null => {
  try {
    const stored = sessionStorage.getItem(CATCH_UP_RESUME_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    const state = parsed as { episode?: unknown; currentTime?: unknown };
    if (
      !isVODEpisode(state.episode) ||
      typeof state.currentTime !== 'number' ||
      !Number.isFinite(state.currentTime) ||
      state.currentTime < 0
    ) {
      return null;
    }

    return { episode: state.episode, currentTime: state.currentTime };
  } catch (error) {
    console.warn('Could not restore Catch Up playback position:', error);
    return null;
  }
};

const saveCatchUpResume = (episode: VODEpisode, currentTime: number) => {
  if (!Number.isFinite(currentTime) || currentTime < 0) return;
  try {
    sessionStorage.setItem(
      CATCH_UP_RESUME_KEY,
      JSON.stringify({ episode, currentTime }),
    );
  } catch (error) {
    console.warn('Could not save Catch Up playback position:', error);
  }
};

const clearCatchUpResume = () => {
  try {
    sessionStorage.removeItem(CATCH_UP_RESUME_KEY);
  } catch (error) {
    console.warn('Could not clear Catch Up playback position:', error);
  }
};

const getYouTubeId = (url: string) =>
  url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];

const getVimeoId = (url: string) =>
  url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];

const CatchUpPlayer = ({
  episode,
  resumeAt,
  onEpisodePlay,
  onProgress,
  onEnded,
}: {
  episode: VODEpisode;
  resumeAt: number;
  onEpisodePlay: (episode: VODEpisode) => void;
  onProgress: (episode: VODEpisode, currentTime: number) => void;
  onEnded: () => void;
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState('');
  const lastSavedSecondRef = useRef(Math.floor(resumeAt));
  const videoReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setVideoUrl('');
    setVideoError('');

    if (!episode.video_url) return;

    resolvePodcastEpisodeVideoUrl(episode.video_url)
      .then((resolvedUrl) => {
        if (!cancelled) setVideoUrl(resolvedUrl);
      })
      .catch((error) => {
        console.error('Could not load Catch Up episode video:', error);
        if (!cancelled) {
          setVideoError(
            error instanceof Error ? error.message : 'Could not load this video.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [episode.id, episode.video_url]);

  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : undefined;
  const vimeoId = videoUrl ? getVimeoId(videoUrl) : undefined;
  const saveProgress = (currentTime: number, force = false) => {
    const currentSecond = Math.floor(currentTime);
    if (!force && (!videoReadyRef.current || currentSecond - lastSavedSecondRef.current < 5)) {
      return;
    }
    lastSavedSecondRef.current = currentSecond;
    onProgress(episode, currentTime);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {episode.video_url && !videoUrl && !videoError ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      ) : videoError ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-200">
          {videoError}
        </div>
      ) : videoUrl && youtubeId ? (
        <iframe
          key={episode.id}
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0${
            resumeAt > 0 ? `&start=${Math.floor(resumeAt)}` : ''
          }`}
          title={episode.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : videoUrl && vimeoId ? (
        <iframe
          key={episode.id}
          className="h-full w-full"
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1${
            resumeAt > 0 ? `#t=${Math.floor(resumeAt)}s` : ''
          }`}
          title={episode.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : videoUrl ? (
        <video
          key={episode.id}
          className="h-full w-full object-contain"
          src={videoUrl}
          poster={getVodEpisodeArtwork(episode) || undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (
              resumeAt > 0 &&
              Number.isFinite(video.duration) &&
              resumeAt < video.duration
            ) {
              video.currentTime = resumeAt;
            }
            videoReadyRef.current = true;
            saveProgress(video.currentTime, true);
          }}
          onPlay={(event) => {
            onEpisodePlay(episode);
            saveProgress(event.currentTarget.currentTime, true);
          }}
          onTimeUpdate={(event) => saveProgress(event.currentTarget.currentTime)}
          onSeeked={(event) => saveProgress(event.currentTarget.currentTime, true)}
          onPause={(event) => {
            const video = event.currentTarget;
            if (video.ended) onEnded();
            else saveProgress(video.currentTime, true);
          }}
          onEnded={onEnded}
          onError={() => setVideoError('This video could not be played.')}
        />
      ) : !episode.video_url ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
          <Tv className="h-10 w-10 text-muted-foreground/60" />
          <p>No video source is available for this episode.</p>
        </div>
      ) : (
        null
      )}
    </div>
  );
};

const CatchUp = () => {
  const [resumeState] = useState(readCatchUpResume);

  const recordEpisodePlayback = (episode: VODEpisode) => {
    if (!episode.video_url) return;

    const item: Omit<WatchHistoryItem, 'lastPlayedAt'> = {
      id: episode.id,
      show_id: episode.show_id,
      title: episode.title,
      description: episode.description,
      video_url: episode.video_url,
      thumbnail_url: getVodEpisodeArtwork(episode) || undefined,
      duration: episode.duration,
      category: episode.show_category || episode.category,
    };
    recordWatchHistory(item);
  };

  const saveEpisodeProgress = (episode: VODEpisode, currentTime: number) => {
    saveCatchUpResume(episode, currentTime);
  };

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="-mx-2 -my-4 min-h-screen bg-background px-4 py-6 text-foreground sm:-mx-4 sm:-my-6 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                aria-label="Back to feed"
                className="rounded-full border border-border bg-card p-2.5 text-foreground transition hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">
                  NexSq Video
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">Catch Up</h1>
              </div>
            </div>
          </header>

          <VODLibrary
            showAllPastShows
            initialEpisode={resumeState?.episode}
            onEpisodeSelect={(episode) => saveCatchUpResume(episode, 0)}
            onPlayerClose={clearCatchUpResume}
            renderPlayer={(episode) => (
              <CatchUpPlayer
                key={episode.id}
                episode={episode}
                resumeAt={
                  resumeState?.episode.id === episode.id
                    ? resumeState.currentTime
                    : 0
                }
                onEpisodePlay={recordEpisodePlayback}
                onProgress={saveEpisodeProgress}
                onEnded={clearCatchUpResume}
              />
            )}
            renderChatPanel={(episode) => (
              <LiveChat
                key={episode.show_id || episode.id}
                showId={episode.show_id}
                showTitle={episode.show_title || episode.title}
                showDescription={episode.description}
                compact
              />
            )}
          />
        </div>
      </div>
    </Layout>
  );
};

export default CatchUp;
