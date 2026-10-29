import { useCallback, useState } from 'react';
import { ArrowLeft, Clock3, Play, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import VODLibrary, { VODEpisode } from '@/components/VODLibrary';
import { LiveChat } from '@/components/LiveChat';
import { getWatchHistory, recordWatchHistory, WatchHistoryItem } from '@/lib/watchHistory';

type CatchUpMedia = {
  id: string;
  show_id?: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  category?: string;
};

const getYouTubeId = (url: string) =>
  url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1];

const getVimeoId = (url: string) =>
  url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];

const formatDuration = (duration?: number) => {
  if (!duration) return '';
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const CatchUp = () => {
  const [history, setHistory] = useState<WatchHistoryItem[]>(getWatchHistory);
  const [selectedMedia, setSelectedMedia] = useState<CatchUpMedia | null>(history[0] || null);

  const selectEpisode = (episode: VODEpisode) => {
    setSelectedMedia({
      id: episode.id,
      show_id: episode.show_id,
      title: episode.title,
      description: episode.description,
      video_url: episode.video_url,
      thumbnail_url: episode.thumbnail_url || episode.show_thumbnail,
      duration: episode.duration,
      category: episode.show_category || episode.category,
    });
  };

  const selectInitialEpisode = useCallback((episode: VODEpisode) => {
    setSelectedMedia((current) => current || {
      id: episode.id,
      show_id: episode.show_id,
      title: episode.title,
      description: episode.description,
      video_url: episode.video_url,
      thumbnail_url: episode.thumbnail_url || episode.show_thumbnail,
      duration: episode.duration,
      category: episode.show_category || episode.category,
    });
  }, []);

  const recordSelectedMedia = (media: CatchUpMedia) => {
    if (!media.video_url) return;
    const nextItem: WatchHistoryItem = {
      id: media.id,
      show_id: media.show_id,
      title: media.title,
      description: media.description,
      video_url: media.video_url,
      thumbnail_url: media.thumbnail_url,
      duration: media.duration,
      category: media.category,
      lastPlayedAt: new Date().toISOString(),
    };
    recordWatchHistory(nextItem);
    const nextHistory = [nextItem, ...history.filter((item) => item.id !== media.id)];
    setHistory(nextHistory);
  };

  const youtubeId = selectedMedia?.video_url ? getYouTubeId(selectedMedia.video_url) : undefined;
  const vimeoId = selectedMedia?.video_url ? getVimeoId(selectedMedia.video_url) : undefined;

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
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">NexSq Video</p>
                <h1 className="text-2xl font-bold sm:text-3xl">Catch Up</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              <span>{history.length} watched</span>
            </div>
          </header>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0">
              <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-border">
                {selectedMedia?.video_url ? (
                  youtubeId ? (
                    <iframe
                      key={selectedMedia.id}
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&rel=0`}
                      title={selectedMedia.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : vimeoId ? (
                    <iframe
                      key={selectedMedia.id}
                      className="h-full w-full"
                      src={`https://player.vimeo.com/video/${vimeoId}?autoplay=0`}
                      title={selectedMedia.title}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      key={selectedMedia.id}
                      className="h-full w-full"
                      src={selectedMedia.video_url}
                      poster={selectedMedia.thumbnail_url}
                      controls
                      playsInline
                      preload="metadata"
                      onPlay={() => recordSelectedMedia(selectedMedia)}
                    />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                    <Tv className="h-10 w-10 text-muted-foreground/60" />
                    <p>Select a show or episode to start watching</p>
                  </div>
                )}
              </div>
              {selectedMedia && (
                <div className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <div>
                    {selectedMedia.category && (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300">
                        {selectedMedia.category}
                      </p>
                    )}
                    <h2 className="text-xl font-semibold">{selectedMedia.title}</h2>
                    {selectedMedia.description && (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedMedia.description}</p>
                    )}
                  </div>
                  {selectedMedia.duration && (
                    <span className="rounded bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                      {formatDuration(selectedMedia.duration)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <aside className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Program chat</h2>
                <p className="mt-1 text-xs text-muted-foreground">Messages for the selected show</p>
              </div>
              <LiveChat
                key={selectedMedia?.show_id || 'general-chat'}
                showId={selectedMedia?.show_id}
                showTitle={selectedMedia?.title}
                showDescription={selectedMedia?.description}
              />
            </aside>
          </section>

          <section className="border-t border-border pt-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recently Watched</h2>
              <span className="text-xs text-muted-foreground">Feed history</span>
            </div>
            {history.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMedia(item)}
                    className={`group flex items-center gap-3 rounded-md p-2 text-left transition ${selectedMedia?.id === item.id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                  >
                    <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-muted">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center"><Tv className="h-5 w-5 text-muted-foreground/60" /></span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                        <Play className="h-5 w-5 fill-current" />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.category || 'Show'}{item.duration ? ` · ${formatDuration(item.duration)}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-6 text-sm leading-6 text-muted-foreground">Videos you play in the feed will appear here.</p>
            )}
          </section>

          {/* On-demand catalog */}
          <section className="border-t border-border pt-7">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">On demand</p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">Shows & Episodes</h2>
              </div>
            </div>
            <VODLibrary
              showAllPastShows
              onEpisodeSelect={selectEpisode}
              onInitialEpisode={selectInitialEpisode}
            />
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default CatchUp;