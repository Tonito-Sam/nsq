import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Clock,
  Loader2,
  Calendar,
  Eye,
  CalendarDays,
  Filter,
  Tv,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Grid3X3,
  Rows3,
  FolderOpen,
  X,
  MessageCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import apiUrl from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { SHOW_CATEGORIES } from '@/config/showCategories';
import { resolvePodcastEpisodeVideoUrl } from '@/utils/podcastRecordingStorage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getVodEpisodeArtwork } from '@/utils/vodEpisodeArtwork';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VODEpisode {
  id: string;
  show_id?: string;
  show_title?: string;
  show_thumbnail?: string;
  show_category?: string;
  is_podcast?: boolean;
  podcast_cover_url?: string;
  podcast_logo_url?: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail_url?: string;
  video_url?: string;
  views?: number;
  scheduled_time?: string;
  air_time?: string;
  published_at?: string;
  created_at: string;
  is_live?: boolean;
  is_active?: boolean;
  tags?: string[];
  category?: string;
  last_viewed_at?: string;
  unique_views?: number;
}

type SortOption =
  | 'newest'
  | 'oldest'
  | 'most-viewed'
  | 'least-viewed'
  | 'longest'
  | 'shortest';
type FilterOption = 'all' | 'recent' | 'popular' | 'featured' | 'trending';
type ViewMode = 'grid' | 'by-show' | 'by-category';

interface VODLibraryProps {
  showId?: string;
  onEpisodeSelect?: (episode: VODEpisode) => void;
  onShowSelect?: (showId: string) => void;
  onInitialEpisode?: (episode: VODEpisode) => void;
  initialEpisode?: VODEpisode;
  onPlayerClose?: () => void;
  playingEpisodeId?: string;
  showAllPastShows?: boolean;
  defaultViewMode?: ViewMode;
  shows?: Array<{
    id: string;
    title: string;
    thumbnail_url?: string;
    category?: string;
    views?: number;
  }>;
  renderChatPanel?: (episode: VODEpisode) => React.ReactNode;
  renderPlayer?: (episode: VODEpisode) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getEpisodeDate = (ep: VODEpisode): Date | null => {
  const dateStr =
    ep.scheduled_time || ep.air_time || ep.published_at || ep.created_at;
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const hasEpisodeAired = (ep: VODEpisode): boolean => {
  const d = getEpisodeDate(ep);
  if (!d) return true;
  return d <= new Date();
};

const formatViewCount = (views?: number) => {
  if (!views || views === 0) return '0';
  if (views < 1000) return views.toString();
  if (views < 1000000) return (views / 1000).toFixed(1) + 'K';
  return (views / 1000000).toFixed(1) + 'M';
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return 'N/A';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

const formatDisplayDate = (ep: VODEpisode): string => {
  const date = getEpisodeDate(ep);
  if (!date) return 'Date unavailable';
  const now = new Date();
  const diffDays = Math.floor(
    Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ---------------------------------------------------------------------------
// Default inline player
// ---------------------------------------------------------------------------
const DefaultPlayer: React.FC<{ episode: VODEpisode }> = ({ episode }) => {
  const art = getVodEpisodeArtwork(episode);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setVideoUrl('');
    setError('');

    if (!episode.video_url) return;
    resolvePodcastEpisodeVideoUrl(episode.video_url)
      .then((url) => {
        if (!cancelled) setVideoUrl(url);
      })
      .catch((loadError) => {
        console.error('Could not load VOD episode video:', loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this video.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [episode.id, episode.video_url]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      {episode.video_url && !videoUrl && !error ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-200">
          {error}
        </div>
      ) : videoUrl ? (
        <video
          key={episode.id}
          src={videoUrl}
          poster={art || undefined}
          controls
          autoPlay
          playsInline
          className="h-full w-full object-contain"
          onError={() => setError('This video could not be played.')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm text-white/60">No video source available</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rail (horizontal carousel)
// ---------------------------------------------------------------------------
const Rail: React.FC<{
  title?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, icon, subtitle, children }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      {title && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Poster Card
// ---------------------------------------------------------------------------
const PosterCard: React.FC<{
  episode: VODEpisode;
  playingEpisodeId?: string;
  onEpisodeSelect?: (ep: VODEpisode) => void;
  showAllPastShows?: boolean;
  userHasViewed?: boolean;
  width?: string;
}> = ({
  episode,
  playingEpisodeId,
  onEpisodeSelect,
  showAllPastShows,
  userHasViewed,
  width = 'w-[180px] sm:w-[200px]',
}) => {
  const artwork = getVodEpisodeArtwork(episode);
  const isPlaying = playingEpisodeId === episode.id;

  return (
    <div
      onClick={() => onEpisodeSelect?.(episode)}
      className={`group relative ${width} shrink-0 snap-start cursor-pointer`}
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-black ring-1 transition-all duration-300 ${
          isPlaying
            ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/30'
            : 'ring-white/10 hover:ring-white/40'
        }`}
      >
        {artwork ? (
          <img
            src={artwork}
            alt={episode.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/40 to-pink-900/40">
            <Play className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" fill="white" />
          </div>
        </div>
        <div className="absolute left-2 right-2 top-2 flex items-start justify-between">
          <Badge className="bg-black/70 text-[10px] text-white backdrop-blur">
            {formatDisplayDate(episode)}
          </Badge>
          {userHasViewed && (
            <Badge className="bg-green-600 text-[10px] text-white">Viewed</Badge>
          )}
        </div>
        {episode.duration ? (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(episode.duration)}
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {isPlaying && (
            <Badge className="mb-1.5 animate-pulse bg-purple-600 text-[10px] text-white">
              Now Playing
            </Badge>
          )}
          <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow">
            {episode.title}
          </h3>
          {showAllPastShows && episode.show_title && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-white/60">
              {episode.show_title}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
            <Eye className="h-3 w-3" />
            <span>{formatViewCount(episode.views)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Wide Card
// ---------------------------------------------------------------------------
const WideCard: React.FC<{
  episode: VODEpisode;
  playingEpisodeId?: string;
  onEpisodeSelect?: (ep: VODEpisode) => void;
  userHasViewed?: boolean;
}> = ({ episode, playingEpisodeId, onEpisodeSelect, userHasViewed }) => {
  const artwork = getVodEpisodeArtwork(episode);
  const isPlaying = playingEpisodeId === episode.id;

  return (
    <div
      onClick={() => onEpisodeSelect?.(episode)}
      className={`group relative w-[280px] sm:w-[340px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl bg-card ring-1 transition-all duration-300 ${
        isPlaying
          ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/30'
          : 'ring-white/10 hover:ring-white/40 hover:shadow-xl'
      }`}
    >
      <div className="relative aspect-video overflow-hidden">
        {artwork ? (
          <img
            src={artwork}
            alt={episode.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/40 to-pink-900/40">
            <Play className="h-10 w-10 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" fill="white" />
          </div>
        </div>
        {episode.duration ? (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(episode.duration)}
          </div>
        ) : null}
        {userHasViewed && (
          <Badge className="absolute left-2 top-2 bg-green-600 text-[10px] text-white">
            Viewed
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {episode.title}
        </h3>
        {episode.show_title && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {episode.show_title}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatViewCount(episode.views)}
          </span>
          <span>•</span>
          <span>{formatDisplayDate(episode)}</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const VODLibrary: React.FC<VODLibraryProps> = ({
  showId,
  onEpisodeSelect,
  onShowSelect,
  onInitialEpisode,
  initialEpisode,
  onPlayerClose,
  playingEpisodeId,
  showAllPastShows = false,
  defaultViewMode,
  shows,
  renderChatPanel,
  renderPlayer,
}) => {
  const [episodes, setEpisodes] = useState<VODEpisode[]>([]);
  const [showsList, setShowsList] = useState<
    Array<{
      id: string;
      title: string;
      thumbnail_url?: string;
      category?: string;
      views?: number;
    }>
  >(shows || []);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(
    defaultViewMode || 'grid'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userViews, setUserViews] = useState<Record<string, boolean>>({});

  // Hero / Carousel state
  const [heroSlides, setHeroSlides] = useState<VODEpisode[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState<VODEpisode | null>(
    initialEpisode || null,
  );
  const [heroPlaying, setHeroPlaying] = useState(Boolean(initialEpisode));
  const [playerColumnHeight, setPlayerColumnHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const playerColumnRef = useRef<HTMLDivElement | null>(null);
  const initialEpisodeNotifiedRef = useRef(false);
  const consecutiveErrorRef = useRef<number>(0);
  const trackingViewsRef = useRef(new Set<string>());
  const heroTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------
  // Persisted views
  // ---------------------------------------------------------------------
  useEffect(() => {
    try {
      const viewed = localStorage.getItem('viewed_episodes');
      if (viewed) setUserViews(JSON.parse(viewed));
    } catch (e) {
      console.error('Error loading user views:', e);
    }
  }, []);

  // ---------------------------------------------------------------------
  // Track view (unchanged logic)
  // ---------------------------------------------------------------------
  const trackEpisodeView = useCallback(
    async (episodeId: string, episodeTitle: string, showIdArg?: string) => {
      if (userViews[episodeId] || trackingViewsRef.current.has(episodeId))
        return;
      trackingViewsRef.current.add(episodeId);

      try {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const { data: updatedViews, error: updateError } = await supabase.rpc(
          'increment_studio_episode_views',
          { p_episode_id: episodeId }
        );
        if (updateError) throw updateError;

        setUserViews((prev) => ({ ...prev, [episodeId]: true }));
        try {
          const viewed = JSON.parse(
            localStorage.getItem('viewed_episodes') || '{}'
          );
          viewed[episodeId] = true;
          localStorage.setItem('viewed_episodes', JSON.stringify(viewed));
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }

        setEpisodes((prev) =>
          prev.map((ep) =>
            ep.id === episodeId
              ? {
                  ...ep,
                  views: Number(updatedViews ?? (ep.views || 0) + 1),
                  last_viewed_at: new Date().toISOString(),
                }
              : ep
          )
        );

        if (userId) {
          try {
            const { data: existingView, error: viewError } = await supabase
              .from('episode_views')
              .select('id')
              .eq('episode_id', episodeId)
              .eq('user_id', userId)
              .single();

            if (viewError?.code === 'PGRST116') {
              await supabase.from('episode_views').insert({
                episode_id: episodeId,
                user_id: userId,
                episode_title: episodeTitle,
                show_id: showIdArg,
                viewed_at: new Date().toISOString(),
              });
            } else if (existingView) {
              await supabase
                .from('episode_views')
                .update({ viewed_at: new Date().toISOString() })
                .eq('id', existingView.id);
            }
          } catch (err) {
            console.error('Error tracking unique view:', err);
          }
        }

        if (showIdArg) {
          try {
            const { data: show, error: showError } = await supabase
              .from('studio_shows')
              .select('total_views')
              .eq('id', showIdArg)
              .single();

            if (!showError && show) {
              await supabase
                .from('studio_shows')
                .update({
                  total_views: (show.total_views || 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', showIdArg);
            }
          } catch (err) {
            console.error('Error updating show views:', err);
          }
        }
      } catch (error) {
        console.error('Error tracking episode view:', error);
      } finally {
        trackingViewsRef.current.delete(episodeId);
      }
    },
    [userViews]
  );

  const handleEpisodeSelect = useCallback(
    (episode: VODEpisode) => {
      trackEpisodeView(episode.id, episode.title, episode.show_id);
      setSelectedEpisode(episode);
      setHeroPlaying(true);
      onEpisodeSelect?.(episode);
    },
    [onEpisodeSelect, trackEpisodeView]
  );

  // ---------------------------------------------------------------------
  // Fetch episodes
  // ---------------------------------------------------------------------
  const fetchEpisodes = useCallback(
    async (pageNum: number) => {
      try {
        setLoading(pageNum === 1);
        setLoadingMore(pageNum > 1);

        let endpointPath = '';
        if (showAllPastShows || !showId) {
          endpointPath = `/api/shows/past/all?page=${pageNum}&limit=20&sort=${encodeURIComponent(
            sortBy
          )}&filter=${encodeURIComponent(filterBy)}`;
        } else {
          endpointPath = `/api/shows/${encodeURIComponent(
            showId
          )}/episodes?page=${pageNum}&limit=20&sort=${encodeURIComponent(
            sortBy
          )}&filter=${encodeURIComponent(filterBy)}`;
        }
        if (searchQuery) {
          endpointPath += `&search=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(apiUrl(endpointPath));
        const data = response.ok
          ? await response.json()
          : { episodes: [], hasMore: false };
        if (!response.ok) {
          console.error('Episodes fetch non-ok', response.status);
        }

        let incoming: VODEpisode[] = data.episodes || [];
        incoming = incoming.filter(
          (e) => typeof e.video_url === 'string' && e.video_url.trim().length
        );

        if (showAllPastShows && incoming.length === 0) {
          const { data: playableShows, error: showsError } = await supabase
            .from('studio_shows')
            .select('*')
            .eq('is_active', true)
            .not('video_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(50);
          if (showsError) throw showsError;

          const search = searchQuery.trim().toLowerCase();
          incoming = (playableShows || [])
            .filter(
              (s) =>
                !search ||
                `${s.title || ''} ${s.description || ''}`
                  .toLowerCase()
                  .includes(search)
            )
            .map((s) => ({
              id: s.id,
              show_id: s.id,
              show_title: s.title,
              title: s.title || 'Untitled show',
              description: s.description || undefined,
              video_url: s.video_url || undefined,
              thumbnail_url: s.thumbnail_url || undefined,
              show_thumbnail: s.thumbnail_url || undefined,
              category: s.category || undefined,
              show_category: s.category || undefined,
              duration: s.duration || undefined,
              views: s.total_views || 0,
              created_at: s.created_at || new Date().toISOString(),
              is_live: false,
              is_active: true,
            }));
        }

        const pastEpisodes = incoming.filter(
          (ep) => ep.is_live !== true && hasEpisodeAired(ep)
        );

        if (showAllPastShows) {
          const showIds = [
            ...new Set(pastEpisodes.map((ep) => ep.show_id).filter(Boolean)),
          ];
          if (showIds.length > 0) {
            const { data: showsData, error } = await supabase
              .from('studio_shows')
              .select('id, title, category, thumbnail_url, total_views')
              .in('id', showIds);
            if (!error && showsData) {
              const map = showsData.reduce((acc, s) => {
                acc[s.id] = s;
                return acc;
              }, {} as Record<string, any>);
              incoming = pastEpisodes.map((ep) => ({
                ...ep,
                show_category: map[ep.show_id!]?.category || 'Other',
                show_title: map[ep.show_id!]?.title || ep.show_title,
                show_thumbnail:
                  map[ep.show_id!]?.thumbnail_url || ep.show_thumbnail,
                views: ep.views || 0,
              }));
            }
          }
        }

        let sorted = [...incoming];
        switch (sortBy) {
          case 'newest':
            sorted.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            break;
          case 'oldest':
            sorted.sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
            break;
          case 'most-viewed':
            sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
          case 'least-viewed':
            sorted.sort((a, b) => (a.views || 0) - (b.views || 0));
            break;
          case 'longest':
            sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
            break;
          case 'shortest':
            sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
            break;
        }

        if (filterBy === 'popular') {
          sorted = sorted.filter((ep) => (ep.views || 0) > 100);
        } else if (filterBy === 'trending') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          sorted = sorted.filter((ep) => {
            const d = getEpisodeDate(ep);
            return d && d > oneWeekAgo && (ep.views || 0) > 50;
          });
        }

        if (pageNum === 1) {
          setEpisodes(sorted);

          // Populate hero slides (Top 5 trending)
          if (sorted.length > 0) {
            const topTrending = [...sorted]
              .sort((a, b) => (b.views || 0) - (a.views || 0))
              .slice(0, 5);
            setHeroSlides(topTrending);
          }

          if (!initialEpisodeNotifiedRef.current && sorted[0]) {
            initialEpisodeNotifiedRef.current = true;
            onInitialEpisode?.(sorted[0]);
          }
        } else {
          setEpisodes((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            return [...prev, ...sorted.filter((ep) => !ids.has(ep.id))];
          });
        }

        setHasMore(Boolean(data.hasMore) && pastEpisodes.length > 0);
        consecutiveErrorRef.current = 0;
      } catch (error) {
        console.error('Error fetching episodes:', error);
        consecutiveErrorRef.current += 1;
        if (consecutiveErrorRef.current > 3) setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      showId,
      showAllPastShows,
      sortBy,
      filterBy,
      searchQuery,
      onInitialEpisode,
    ]
  );

  useEffect(() => {
    setPage(1);
    setEpisodes([]);
    fetchEpisodes(1);
  }, [showId, sortBy, filterBy, searchQuery, showAllPastShows]);

  // Load shows list
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (shows && shows.length) return;
      try {
        const { data, error } = await supabase
          .from('studio_shows')
          .select('id, title, thumbnail_url, category, video_url, total_views')
          .eq('is_active', true)
          .order('title', { ascending: true });
        if (error) throw error;
        if (mounted) setShowsList(data || []);
      } catch (err) {
        console.warn('Error fetching shows list', err);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [shows]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = containerRef.current;
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((p) => {
            const next = p + 1;
            fetchEpisodes(next);
            return next;
          });
        }
      },
      { root: node, rootMargin: '200px' }
    );
    observerRef.current.observe(node);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, fetchEpisodes]);

  // ---------------------------------------------------------------------
  // Hero Carousel Logic
  // ---------------------------------------------------------------------

  // Auto-advance carousel when NOT playing
  useEffect(() => {
    if (heroPlaying || heroSlides.length <= 1) {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      return;
    }

    heroTimerRef.current = setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % heroSlides.length);
    }, 8000);

    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroPlaying, heroSlides.length]);

  // Sync hero with external playingEpisodeId prop
  useEffect(() => {
    if (!playingEpisodeId) return;
    const foundIdx = heroSlides.findIndex((e) => e.id === playingEpisodeId);
    if (foundIdx !== -1) {
      setActiveSlideIdx(foundIdx);
    }
    const foundEpisode = episodes.find((episode) => episode.id === playingEpisodeId);
    if (foundEpisode) setSelectedEpisode(foundEpisode);
    setHeroPlaying(true);
  }, [playingEpisodeId, heroSlides, episodes]);

  useEffect(() => {
    if (!heroPlaying) {
      setPlayerColumnHeight(0);
      return;
    }

    const playerColumn = playerColumnRef.current;
    if (!playerColumn) return;

    const updateHeight = () => {
      const height = Math.floor(playerColumn.getBoundingClientRect().height);
      setPlayerColumnHeight((currentHeight) =>
        currentHeight === height ? currentHeight : height,
      );
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(playerColumn);
    return () => resizeObserver.disconnect();
  }, [heroPlaying, selectedEpisode?.id, activeSlideIdx, heroSlides.length, episodes.length]);

  // Reset active slide if slides change
  useEffect(() => {
    setActiveSlideIdx(0);
  }, [heroSlides]);

  // ---------------------------------------------------------------------
  // Derived groupings
  // ---------------------------------------------------------------------
  const getGroupedByCategory = () => {
    const cats: Record<string, VODEpisode[]> = {};
    SHOW_CATEGORIES.forEach((c) => (cats[c] = []));
    cats['Other'] = [];
    episodes.forEach((ep) => {
      const c = ep.show_category || ep.category || 'Other';
      if (!cats[c]) cats[c] = [];
      cats[c].push(ep);
    });
    return Object.entries(cats)
      .filter(([, eps]) => eps.length > 0)
      .sort(([, a], [, b]) => b.length - a.length);
  };

  const getGroupedByShow = () => {
    const map: Record<
      string,
      {
        show: {
          id: string;
          title: string;
          thumbnail_url?: string;
          category?: string;
          total_views?: number;
        };
        episodes: VODEpisode[];
      }
    > = {};
    showsList.forEach((s) => {
      map[s.id] = {
        show: { ...s, total_views: s.views },
        episodes: [],
      };
    });
    map['other'] = { show: { id: 'other', title: 'Other Shows' }, episodes: [] };
    episodes.forEach((ep) => {
      const sid = ep.show_id || 'other';
      if (map[sid]) map[sid].episodes.push(ep);
      else map['other'].episodes.push(ep);
    });
    return Object.entries(map)
      .filter(([, d]) => d.episodes.length > 0)
      .sort(
        ([, a], [, b]) =>
          (b.show.total_views || 0) - (a.show.total_views || 0)
      );
  };

  const getFilteredEpisodes = () => {
    if (selectedCategory === 'all') return episodes;
    return episodes.filter(
      (ep) =>
        ep.show_category === selectedCategory || ep.category === selectedCategory
    );
  };

  const getAvailableCategories = () => {
    const s = new Set<string>();
    episodes.forEach((ep) => {
      const c = ep.show_category || ep.category;
      if (c) s.add(c);
    });
    return ['all', ...Array.from(s)].sort();
  };

  const totalViews = episodes.reduce((t, ep) => t + (ep.views || 0), 0);

  // Rails
  const trendingRail = [...episodes]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 12);
  const latestRail = [...episodes]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 12);

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------
  if (loading && episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <p className="text-muted-foreground">
          {showAllPastShows ? 'Loading all past shows...' : 'Loading episodes...'}
        </p>
      </div>
    );
  }

  const currentHero =
    (heroPlaying && selectedEpisode) ||
    heroSlides[activeSlideIdx] ||
    episodes[0] ||
    null;

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* ================================================================
          HERO CAROUSEL — switches to split view (player | chat) when playing
      ================================================================ */}
      {showAllPastShows && currentHero && (
        <div className="relative -mx-2 overflow-hidden rounded-2xl bg-black shadow-2xl">
          {heroPlaying ? (
            /* ---------- SPLIT VIEW: player left, chat right ---------- */
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
              {/* Player column */}
              <div ref={playerColumnRef} className="relative flex flex-col">
                <div className="relative">
                  {renderPlayer ? (
                    renderPlayer(currentHero)
                  ) : (
                    <DefaultPlayer episode={currentHero} />
                  )}
                </div>

                {/* Episode meta bar under the player */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-zinc-950 px-4 py-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white">Now Playing</Badge>
                      {currentHero.show_title && (
                        <Badge className="bg-white/10 text-white backdrop-blur">
                          {currentHero.show_title}
                        </Badge>
                      )}
                    </div>
                    <h1 className="line-clamp-1 text-base md:text-xl font-bold text-white">
                      {currentHero.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/70">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {formatViewCount(currentHero.views)}
                    </span>
                    {currentHero.duration ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(currentHero.duration)}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDisplayDate(currentHero)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat column */}
              <div
                className="relative flex min-h-0 flex-col overflow-hidden border-t border-white/10 bg-background lg:border-l lg:border-t-0"
                style={{ height: `${playerColumnHeight}px` }}
              >
                <button
                  onClick={() => {
                    setHeroPlaying(false);
                    setSelectedEpisode(null);
                    onPlayerClose?.();
                  }}
                  className="absolute right-2 top-2 z-20 rounded-full bg-background/80 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  aria-label="Close player"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {renderChatPanel ? (
                    renderChatPanel(currentHero)
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                      <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Your live chat component should render here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ---------- IDLE HERO: Carousel ---------- */
            <div className="relative aspect-[16/7] md:aspect-[21/8] w-full overflow-hidden">
              {heroSlides.map((slide, idx) => {
                const isActive = idx === activeSlideIdx;
                const art = getVodEpisodeArtwork(slide);
                return (
                  <div
                    key={slide.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    {art ? (
                      <img
                        src={art}
                        alt={slide.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-purple-900 via-zinc-900 to-pink-900" />
                    )}
                  </div>
                );
              })}

              {/* Gradients Overlays */}
              <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/95 via-black/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

              {/* Content Box */}
              <div className="absolute inset-0 z-30 flex max-w-2xl flex-col justify-end p-5 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white">
                    <Sparkles className="mr-1 h-3 w-3" /> Featured
                  </Badge>
                  {currentHero.show_title && (
                    <Badge className="bg-white/10 text-white backdrop-blur">
                      {currentHero.show_title}
                    </Badge>
                  )}
                </div>
                <h1 className="line-clamp-2 text-2xl font-extrabold text-white drop-shadow-lg md:text-4xl">
                  {currentHero.title}
                </h1>
                {currentHero.description && (
                  <p className="mt-2 line-clamp-2 max-w-xl text-sm text-white/80">
                    {currentHero.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {formatViewCount(currentHero.views)} views
                  </span>
                  {currentHero.duration ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(currentHero.duration)}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDisplayDate(currentHero)}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <Button
                    onClick={() => handleEpisodeSelect(currentHero)}
                    className="gap-2 bg-white font-semibold text-black hover:bg-white/90"
                  >
                    <Play className="h-4 w-4" fill="black" />
                    Play Now
                  </Button>
                  {currentHero.show_id && onShowSelect && (
                    <Button
                      variant="outline"
                      onClick={() => onShowSelect(currentHero.show_id!)}
                      className="gap-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20"
                    >
                      <Tv className="h-4 w-4" />
                      View Show
                    </Button>
                  )}
                </div>
              </div>

              {/* Carousel Dots */}
              {heroSlides.length > 1 && (
                <div className="absolute bottom-5 right-10 z-30 flex items-center gap-2">
                  {heroSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIdx(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        activeSlideIdx === idx
                          ? 'w-8 bg-purple-500'
                          : 'w-2 bg-white/30 hover:bg-white/50'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TOOLBAR
      ================================================================ */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {showAllPastShows ? 'Catch Up' : 'Past Episodes'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {episodes.length} {showAllPastShows ? 'show' : 'episode'}
            {episodes.length !== 1 ? 's' : ''} • {formatViewCount(totalViews)}{' '}
            total views
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={showAllPastShows ? 'Search all shows...' : 'Search episodes...'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:w-56"
            />
          </div>

          <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
            <SelectTrigger className="w-[150px] border-input bg-background text-foreground">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover text-popover-foreground">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="most-viewed">Most Viewed</SelectItem>
              <SelectItem value="least-viewed">Least Viewed</SelectItem>
              <SelectItem value="longest">Longest</SelectItem>
              <SelectItem value="shortest">Shortest</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterBy}
            onValueChange={(v: FilterOption) => setFilterBy(v)}
          >
            <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover text-popover-foreground">
              <SelectItem value="all">All Episodes</SelectItem>
              <SelectItem value="recent">Last 7 Days</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="trending">Trending Now</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
            </SelectContent>
          </Select>

          {showAllPastShows && (
            <div className="flex rounded-lg border border-border bg-muted p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode('by-show')}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'by-show'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Rows3 className="h-3.5 w-3.5" /> Shows
              </button>
              <button
                onClick={() => setViewMode('by-category')}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'by-category'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Categories
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          CONTENT
      ================================================================ */}
      <div
        ref={containerRef}
        className="space-y-8"
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {showAllPastShows ? (
          viewMode === 'grid' ? (
            <>
              {getAvailableCategories().length > 2 && (
                <div className="flex flex-wrap gap-2">
                  {getAvailableCategories().map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        selectedCategory === cat
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
              )}

              {trendingRail.length > 0 && (
                <Rail
                  title="Trending Now"
                  icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
                  subtitle="Most watched catch-up episodes"
                >
                  {trendingRail.map((ep) => (
                    <WideCard
                      key={`trend-${ep.id}`}
                      episode={ep}
                      playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                      onEpisodeSelect={handleEpisodeSelect}
                      userHasViewed={userViews[ep.id]}
                    />
                  ))}
                </Rail>
              )}

              {latestRail.length > 0 && (
                <Rail
                  title="Newest Additions"
                  icon={<Sparkles className="h-5 w-5 text-pink-500" />}
                  subtitle="Fresh from the archive"
                >
                  {latestRail.map((ep) => (
                    <PosterCard
                      key={`new-${ep.id}`}
                      episode={ep}
                      playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                      onEpisodeSelect={handleEpisodeSelect}
                      showAllPastShows
                      userHasViewed={userViews[ep.id]}
                    />
                  ))}
                </Rail>
              )}

              <div>
                <h2 className="mb-3 flex items-center gap-2 text-lg md:text-xl font-bold tracking-tight text-foreground">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  {selectedCategory === 'all' ? 'All Episodes' : selectedCategory}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                  {getFilteredEpisodes().map((ep) => (
                    <PosterCard
                      key={ep.id}
                      episode={ep}
                      playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                      onEpisodeSelect={handleEpisodeSelect}
                      showAllPastShows
                      userHasViewed={userViews[ep.id]}
                      width="w-full"
                    />
                  ))}
                </div>
              </div>
            </>
          ) : viewMode === 'by-show' ? (
            <div className="space-y-8">
              {getGroupedByShow().map(([sid, { show, episodes: showEps }]) => {
                const showViews = showEps.reduce(
                  (t, ep) => t + (ep.views || 0),
                  0
                );
                return (
                  <div key={sid} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {show.thumbnail_url ? (
                          <img
                            src={show.thumbnail_url}
                            alt={show.title}
                            className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900 to-pink-900">
                            <Tv className="h-6 w-6 text-white/70" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-base font-semibold text-foreground md:text-lg">
                            {show.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {showEps.length} episode
                            {showEps.length !== 1 ? 's' : ''} •{' '}
                            {formatViewCount(showViews)} views
                            {show.category && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                                {show.category}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {onShowSelect && sid !== 'other' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onShowSelect(sid)}
                        >
                          Play all
                        </Button>
                      )}
                    </div>
                    <Rail>
                      {showEps.map((ep) => (
                        <PosterCard
                          key={ep.id}
                          episode={ep}
                          playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                          onEpisodeSelect={handleEpisodeSelect}
                          showAllPastShows
                          userHasViewed={userViews[ep.id]}
                        />
                      ))}
                    </Rail>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-8">
              {getGroupedByCategory().map(([cat, catEps]) => {
                const catViews = catEps.reduce(
                  (t, ep) => t + (ep.views || 0),
                  0
                );
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-900 to-pink-900">
                        <Tv className="h-5 w-5 text-white/70" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground md:text-lg">
                          {cat}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {catEps.length} episode
                          {catEps.length !== 1 ? 's' : ''} •{' '}
                          {formatViewCount(catViews)} views
                        </p>
                      </div>
                    </div>
                    <Rail>
                      {catEps.map((ep) => (
                        <PosterCard
                          key={ep.id}
                          episode={ep}
                          playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                          onEpisodeSelect={handleEpisodeSelect}
                          showAllPastShows
                          userHasViewed={userViews[ep.id]}
                        />
                      ))}
                    </Rail>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {episodes.map((ep) => (
              <PosterCard
                key={ep.id}
                episode={ep}
                playingEpisodeId={heroPlaying ? currentHero?.id : undefined}
                onEpisodeSelect={handleEpisodeSelect}
                userHasViewed={userViews[ep.id]}
                width="w-full"
              />
            ))}
          </div>
        )}

        <div className="h-1" />

        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">
                Loading more episodes...
              </p>
            </div>
          </div>
        )}

        {!hasMore && episodes.length > 0 && (
          <div className="border-t border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">
              You've reached the end of available{' '}
              {showAllPastShows ? 'shows' : 'episodes'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Check back later for new content
            </p>
          </div>
        )}

        {episodes.length === 0 && !loading && (
          <div className="space-y-4 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                No Past Shows Found
              </h3>
              <p className="mx-auto max-w-md text-muted-foreground">
                {searchQuery
                  ? `No shows match "${searchQuery}". Try different search terms.`
                  : 'No past shows available at the moment. Check back later!'}
              </p>
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VODLibrary;