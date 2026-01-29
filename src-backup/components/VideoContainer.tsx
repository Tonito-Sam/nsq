import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, Clock, Eye, Volume2, VolumeX, Heart, MessageCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useShowContext } from '@/contexts/ShowContext';
import { useViewTracking } from '@/hooks/useViewTracking';
import { useLiveChatMessages } from '@/hooks/useLiveChatMessages';
import VODLibrary, { VODEpisode } from '@/components/VODLibrary';
import apiUrl from '@/lib/api';

interface StudioShow {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  scheduled_time?: string;
  end_time?: string;
  is_live: boolean;
  is_active: boolean;
  created_at: string;
}

interface VideoContainerProps {
  shows?: StudioShow[];
  selectedShowId?: string;
  onLike?: () => void;
  onCommentClick?: () => void;
  currentShowIndex?: number;
  onCurrentShowChange?: (index: number) => void;
}

interface MediaItem {
  id: string;
  type: 'show' | 'episode';
  title?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number;
  raw?: any;
}
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoContainer: React.FC<VideoContainerProps> = ({
  shows = [],
  selectedShowId,
  onLike = () => {},
  onCommentClick = () => {},
  currentShowIndex: externalCurrentShowIndex,
  onCurrentShowChange
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [ytReady, setYtReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  // Playback queue for current show: includes the show main media and its episodes
  const [episodesForCurrentShow, setEpisodesForCurrentShow] = useState<VODEpisode[]>([]);
  const [mediaQueue, setMediaQueue] = useState<MediaItem[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  // NEW STATES FOR MODAL PLAYER
  const [playingEpisode, setPlayingEpisode] = useState<VODEpisode | null>(null);
  const [modalPlayerPlaying, setModalPlayerPlaying] = useState(false);
  const [modalPlayerMuted, setModalPlayerMuted] = useState(true);
  const [modalPlayerProgress, setModalPlayerProgress] = useState(0);
  const [modalPlayerDuration, setModalPlayerDuration] = useState(0);
  const [modalAwaitingUserPlay, setModalAwaitingUserPlay] = useState(false);
  const [modalPlayerError, setModalPlayerError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const computeItemsPerView = () => {
    if (typeof window === 'undefined') return 2;
    const w = window.innerWidth;
    if (w < 360) return 1;
    if (w >= 360 && w < 768) return 2; // phones
    if (w >= 768 && w < 1024) return 3; // tablets
    return 4; // desktop-ish (fallback)
  };
  const [mobileItemsPerView, setMobileItemsPerView] = useState<number>(computeItemsPerView());
  
  // keep a ref for the latest time to avoid stale closures when seeking on remount
  const videoCurrentTimeRef = useRef<number>(0);
  const youtubeTimePollRef = useRef<number | null>(null);
  const nativeSeekRetryRefs = useRef<number[]>([]);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  // NEW REFS FOR MODAL PLAYER
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalYoutubePlayerRef = useRef<any>(null);
  const modalPlayerContainerRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);

  // Mobile VOD state
  const [vodEpisodes, setVodEpisodes] = useState<VODEpisode[]>([]);
  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
  const [isLoadingVOD, setIsLoadingVOD] = useState(false);

  // Mobile catch-up grid renderer and data loader
  const renderMobileCatchUpGrid = () => {
    if (!isMobile) return null;
    const itemsPerView = mobileItemsPerView; // responsive items per view
    const horizontalPadding = 48; // account for modal padding
    const cardWidth = Math.min((window.innerWidth - horizontalPadding) / itemsPerView, 420);

    // Group episodes by show id to avoid title mismatches. Initialize keys
    // from the parent `shows` prop so empty shows are included.
    const grouped: Record<string, VODEpisode[]> = {};
    if (Array.isArray(shows) && shows.length) {
      shows.forEach(s => { if (s && s.id) grouped[s.id] = []; });
    }

    vodEpisodes.forEach(ep => {
      const sid = (ep.show_id as any) || ep.show_title || 'other';
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push(ep);
    });

    const groups = Object.entries(grouped).sort((a, b) => {
      // Attempt to sort by show title if available via shows prop
      const aTitle = (Array.isArray(shows) && shows.find(s => s.id === a[0])?.title) || (a[1][0]?.show_title) || a[0];
      const bTitle = (Array.isArray(shows) && shows.find(s => s.id === b[0])?.title) || (b[1][0]?.show_title) || b[0];
      return String(aTitle).localeCompare(String(bTitle));
    });

    return (
      <div className="mb-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-white">Past Shows</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span>Swipe horizontally within each show</span>
            <ChevronRight size={16} />
          </div>
        </div>

        {isLoadingVOD ? (
          <div className="flex items-center justify-center w-full py-8">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : (
          groups.map(([showId, eps]) => {
            const displayName = (Array.isArray(shows) && shows.find(s => s.id === showId)?.title) || (eps[0]?.show_title) || (showId === 'other' ? 'Other' : String(showId));
            return (
              <div key={showId} className="">
                <div className="flex items-center justify-between mb-2 px-2">
                  <h4 className="text-lg font-semibold text-white">{displayName}</h4>
                  <span className="text-sm text-gray-400">{eps.length} episode{eps.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="flex overflow-x-auto pb-4 -mx-4 px-4 mobile-snap-scroll scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
                  {eps.map((episode) => (
                    <div
                      key={episode.id}
                      className="flex-shrink-0 mr-4 rounded-xl overflow-hidden bg-gray-800 border border-gray-700 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] mobile-snap-item"
                      style={{ width: cardWidth, scrollSnapAlign: 'start', maxWidth: 'calc(100vw - 3rem)' }}
                      onClick={() => playEpisode(episode)}
                    >
                      <div className="relative aspect-video">
                        <img src={episode.thumbnail_url || episode.show_thumbnail || '/placeholder.svg'} alt={episode.title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{episode.duration ? formatDuration(episode.duration) : 'N/A'}</div>
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-purple-600 text-white text-xs">{displayName}</Badge>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-sm font-semibold text-white mb-1 line-clamp-1">{episode.title}</h4>
                        {episode.description && <p className="text-xs text-gray-300 line-clamp-2 mb-2">{episode.description}</p>}
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{new Date(episode.created_at).toLocaleDateString()}</span>
                          <button className="flex items-center space-x-1 text-purple-400 hover:text-purple-300">
                            <Play size={12} />
                            <span>Play</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // Fetch mobile VOD episodes when modal opens or on mount
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setIsLoadingVOD(true);
        const url = apiUrl('/api/shows/past/all?page=1&limit=24');
        try { console.debug('Mobile VOD fetch url:', { url }); } catch {}
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.warn('Mobile VOD fetch failed', res.status, txt, 'url=', url);
          return;
        }

        let data: any = null;
        try {
          data = await res.json();
        } catch (err) {
          const txt = await res.text().catch(() => null);
          console.warn('Mobile VOD fetch returned non-JSON response', txt, 'url=', url);
          return;
        }

        if (!mounted) return;
        setVodEpisodes(data.episodes || []);
      } catch (err) {
        console.warn('Failed to load mobile VOD list', err);
      } finally {
        if (mounted) setIsLoadingVOD(false);
      }
    };

    if (isMobile && catchUpOpen) load();

    return () => { mounted = false; controller.abort(); };
  }, [isMobile, catchUpOpen]);

  // Track horizontal scroll index for indicators
  useEffect(() => {
    const el = mobileListRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollLeft = el.scrollLeft || 0;
      const gap = 16; // matches card margin-right used in render
      const childWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).getBoundingClientRect().width + gap : window.innerWidth / 2;
      const itemsPerView = mobileItemsPerView;
      const pageIndex = Math.round(scrollLeft / (childWidth * itemsPerView));
      const pages = Math.max(1, Math.ceil((vodEpisodes.length || 1) / itemsPerView));
      setCurrentScrollIndex(Math.min(Math.max(0, pageIndex), pages - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => el.removeEventListener('scroll', onScroll as any);
  }, [vodEpisodes.length, mobileItemsPerView]);

  // Manage body scroll and portal mount/animation for Catch Up modal
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setMobileItemsPerView(computeItemsPerView());
    };
    // keep `isMobile` and itemsPerView in sync when the viewport changes
    window.addEventListener('resize', handleResize);

    if (catchUpOpen) {
      setPortalMounted(true);
      // small delay to trigger CSS transition after mount
      setTimeout(() => setModalVisible(true), 20);
      document.body.style.overflow = 'hidden';
    } else {
      // start closing animation if open
      setModalVisible(false);
      setTimeout(() => setPortalMounted(false), 220);
      document.body.style.overflow = 'auto';
      // Reset modal player when closing
      setPlayingEpisode(null);
    }

    return () => {
      document.body.style.overflow = 'auto';
      setPortalMounted(false);
      setModalVisible(false);
      window.removeEventListener('resize', handleResize);
    };
  }, [catchUpOpen]);

  useEffect(() => {
    const handleOrientationChange = () => {
      const isMobile = window.innerWidth < 768;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      
      console.log('Orientation change:', { isMobile, isLandscape, isFullscreen });
      
      // Store current video time before orientation change
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setVideoCurrentTime(t);
        videoCurrentTimeRef.current = t;
        try {
          sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
        } catch (err) {
          /* ignore storage errors */
        }
      }
      // If a YouTube player exists, capture its current time as well
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = youtubePlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            setVideoCurrentTime(t);
            videoCurrentTimeRef.current = t;
            try {
              sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
            } catch (err) {
              /* ignore storage errors */
            }
          }
        } catch (err) {
          console.warn('Failed to read YouTube currentTime:', err);
        }
      }
      
      if (isMobile && isLandscape && !isFullscreen) {
        console.log('Entering fullscreen mode');
        setIsFullscreen(true);
        setShowOverlay(true);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Request fullscreen on the video container
        setTimeout(() => {
          const element = videoContainerRef.current;
          if (element) {
            if (element.requestFullscreen) {
              element.requestFullscreen().catch(console.error);
            } else if ((element as any).webkitRequestFullscreen) {
              (element as any).webkitRequestFullscreen();
            } else if ((element as any).mozRequestFullScreen) {
              (element as any).mozRequestFullScreen();
            } else if ((element as any).msRequestFullscreen) {
              (element as any).msRequestFullscreen();
            }
          }
        }, 100);
      } else if ((!isLandscape || !isMobile) && isFullscreen) {
        console.log('Exiting fullscreen mode');
        setIsFullscreen(false);
        setShowOverlay(true);
        
        // Restore body scroll
        document.body.style.overflow = 'auto';
        
        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        } else if ((document as any).webkitFullscreenElement) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
          (document as any).msExitFullscreen();
        }
      }
    };

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || 
                     (document as any).webkitFullscreenElement || 
                     (document as any).mozFullScreenElement || 
                     (document as any).msFullscreenElement);
      
      console.log('Fullscreen state changed:', isFs);
      
      if (!isFs && isFullscreen) {
        setIsFullscreen(false);
        document.body.style.overflow = 'auto';
      }
      
      setShowOverlay(true);
    };

    // Add delay to handle orientation change properly
    const handleOrientationWithDelay = () => {
      setTimeout(handleOrientationChange, 100);
    };

    // Event listeners
    window.addEventListener('orientationchange', handleOrientationWithDelay);
    window.addEventListener('resize', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial check
    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationWithDelay);
      window.removeEventListener('resize', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // Cleanup
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  // Show overlay on touch in fullscreen, hide after 3s
  useEffect(() => {
    // Auto-hide overlay after 10s of inactivity. Re-show on mousemove/touchstart.
    const HIDE_DELAY = 10000; // 10 seconds

    const showAndReset = () => {
      setShowOverlay(true);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), HIDE_DELAY);
    };

    const container = videoContainerRef.current || document.body;
    // start with overlay visible and schedule hide
    showAndReset();

    // show overlay on interactions
    container.addEventListener('mousemove', showAndReset as any);
    container.addEventListener('mousedown', showAndReset as any);
    container.addEventListener('touchstart', showAndReset as any);

    return () => {
      container.removeEventListener('mousemove', showAndReset as any);
      container.removeEventListener('mousedown', showAndReset as any);
      container.removeEventListener('touchstart', showAndReset as any);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const [shuffledShows, setShuffledShows] = useState<StudioShow[]>([]);
  useEffect(() => {
    if (!shows || shows.length === 0) {
      setShuffledShows([]);
      return;
    }
    const arr = [...shows];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledShows(arr);
    // initialize index and notify parent if present
    setCurrentShowIndex(0);
    if (typeof onCurrentShowChange === 'function') onCurrentShowChange(0);
  }, [shows]);

  // Accept external currentShowIndex if provided by parent (Feed)
  useEffect(() => {
    if (typeof externalCurrentShowIndex === 'number') {
      setCurrentShowIndex(externalCurrentShowIndex);
    }
  }, [externalCurrentShowIndex]);

  const { setCurrentShow, setViewerCount, setLikeCount, viewerCount, likeCount } = useShowContext();

  const isYouTubeUrl = (url: string) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
  const isVimeoUrl = (url: string) => /^(https?:\/\/)?(www\.)?vimeo\.com\//.test(url);
  const extractYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };
  const extractVimeoID = (url: string) => {
    const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Try common fallback fields for media URL if `video_url` is missing
  const resolveMediaUrl = (ep: VODEpisode) => {
    const candidates = [
      ep.video_url,
      // common alt fields
      (ep as any).source_url,
      (ep as any).source,
      (ep as any).file_url,
      (ep as any).media_url,
      (ep as any).url,
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === 'string' && c.trim().length > 0) {
        try { console.debug('resolveMediaUrl: found direct candidate', { episodeId: ep.id, candidate: c }); } catch {}
        return c.trim();
      }
    }

    // Fallback: accept multiple possible show id keys and also nested show object
    try {
      const possibleShowIdKeys = ['show_id', 'showId', 'studio_show_id', 'studioShowId', 'show'];
      let sid: any = null;
      for (const k of possibleShowIdKeys) {
        if ((ep as any)[k]) {
          sid = (ep as any)[k];
          break;
        }
      }

      // If `show` is an object, try its video_url directly
      if (sid && typeof sid === 'object' && sid.video_url) {
        try { console.debug('resolveMediaUrl: using nested show.video_url', { episodeId: ep.id, video_url: sid.video_url }); } catch {}
        return sid.video_url;
      }

      // Normalize id when `show` may be an object or id string
      const showIdVal = sid && typeof sid === 'string' ? sid : ((ep as any).show_id || (ep as any).showId || (ep as any).studio_show_id || (ep as any).studioShowId || null);
      if (showIdVal && Array.isArray(shows)) {
        const parent = (shows as StudioShow[]).find(s => s.id === showIdVal || String(s.id) === String(showIdVal));
        if (parent && parent.video_url && typeof parent.video_url === 'string' && parent.video_url.trim().length > 0) {
          try { console.debug('resolveMediaUrl: falling back to parent show.video_url', { episodeId: ep.id, parentId: parent.id, video_url: parent.video_url }); } catch {}
          return parent.video_url.trim();
        }
      }
    } catch (err) {
      try { console.warn('resolveMediaUrl: error during parent lookup', err); } catch {}
    }

    return null;
  };

  const getTimeStatus = (show: StudioShow) => {
    if (show.is_live) return { text: 'LIVE', className: 'bg-red-500 text-white' };
    
    if (show.scheduled_time) {
      try {
        const scheduledTime = new Date(show.scheduled_time);
        const now = new Date();
        
        if (scheduledTime > now) {
          return { 
            text: `Starts ${scheduledTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg'
            })}`, 
            className: 'bg-blue-500 text-white' 
          };
        }
      } catch (error) {
        console.error('Date parsing error:', error);
      }
    }
    
    return { text: formatDuration(show.duration), className: 'bg-black/70 text-white' };
  };

  const sortedShows = shuffledShows;
  const currentShow = selectedShowId 
    ? sortedShows.find(show => show.id === selectedShowId) || sortedShows[currentShowIndex]
    : sortedShows[currentShowIndex];

  const { viewCount } = useViewTracking({
    showId: currentShow?.id,
    isPlaying: isVideoPlaying,
    onViewCountUpdate: (count) => {
      console.log(`View count updated for ${currentShow?.title}: ${count}`);
      setViewerCount(count);
    }
  });

  const showId = currentShow?.id;
  const { messages } = useLiveChatMessages(showId);

  useEffect(() => {
    if (currentShow) {
      console.log('VideoContainer: Setting current show in context:', currentShow);
      setCurrentShow(currentShow);
      setViewerCount(viewCount);
      setLikeCount(Math.floor(viewCount * 0.1) + 5);
    }
  }, [currentShow, viewCount, setCurrentShow, setViewerCount, setLikeCount]);

  // When currentShow changes, fetch its episodes and build the playback queue
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadEpisodes = async () => {
      setEpisodesForCurrentShow([]);
      setMediaQueue([]);
      setQueueIndex(0);
      setCurrentMedia(null);

      if (!currentShow) return;

      try {
        // try preferred API route
        const url = apiUrl(`/api/shows/${currentShow.id}/episodes?limit=200`);
        const res = await fetch(url, { signal: controller.signal });
        let data: any = null;
        if (res.ok) {
          try { data = await res.json(); } catch (err) { data = null; }
        }

        // Expect backend to return { episodes: [...] }. As a safe fallback accept a raw array.
        if (!data) {
          const url2 = apiUrl(`/api/studio_episodes?show_id=${currentShow.id}&limit=200`);
          const res2 = await fetch(url2, { signal: controller.signal });
          if (res2.ok) {
            try { data = await res2.json(); } catch (err) { data = null; }
          }
        }

        const epsRaw = (data && Array.isArray(data.episodes)) ? data.episodes : (Array.isArray(data) ? data : []);
        const eps: VODEpisode[] = epsRaw.map((e: any) => ({ ...e } as VODEpisode));
        if (!mounted) return;
        setEpisodesForCurrentShow(eps);

        // build queue: include show main media first (if present), then episodes
        const queue: MediaItem[] = [];
        if (currentShow.video_url) {
          queue.push({ id: `show-${currentShow.id}`, type: 'show', title: currentShow.title, video_url: currentShow.video_url || null, thumbnail_url: currentShow.thumbnail_url || null, duration: currentShow.duration, raw: currentShow });
        }

        // sort episodes by episode_number if available
        const sortedEps = eps.slice().sort((a: any, b: any) => {
          const na = Number(a.episode_number ?? a.episodeNumber ?? 0) || 0;
          const nb = Number(b.episode_number ?? b.episodeNumber ?? 0) || 0;
          return na - nb;
        });

        for (const ep of sortedEps) {
          const resolved = resolveMediaUrl(ep) || (ep.video_url || null);
          queue.push({ id: `ep-${ep.id}`, type: 'episode', title: ep.title, video_url: resolved, thumbnail_url: ep.thumbnail_url || ep.show_thumbnail || null, duration: ep.duration, raw: ep });
        }

        setMediaQueue(queue);
        setQueueIndex(0);
        setCurrentMedia(queue[0] || null);
      } catch (err) {
        console.warn('Failed to load episodes for show', currentShow?.id, err);
      }
    };

    loadEpisodes();

    return () => { mounted = false; controller.abort(); };
  }, [currentShow]);

  // Keep currentMedia in sync with queueIndex/mediaQueue
  useEffect(() => {
    if (!mediaQueue || mediaQueue.length === 0) {
      setCurrentMedia(null);
      return;
    }
    const idx = Math.min(Math.max(0, queueIndex), mediaQueue.length - 1);
    setCurrentMedia(mediaQueue[idx] || null);
  }, [mediaQueue, queueIndex]);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  const moveToNextShow = () => {
    const nextIndex = (currentShowIndex + 1) % sortedShows.length;
    setCurrentShowIndex(nextIndex);
    if (typeof onCurrentShowChange === 'function') onCurrentShowChange(nextIndex);
  };

  const advanceQueueOrNextShow = () => {
    // If there is a queue for this show, advance within it.
    // If the show's scheduled `end_time` hasn't passed, loop within the queue.
    try {
      const now = Date.now();
      const endTime = currentShow && currentShow.end_time ? new Date(currentShow.end_time).getTime() : null;

      if (mediaQueue && mediaQueue.length > 0) {
        // If we're not at the last item, just advance
        if (queueIndex < mediaQueue.length - 1) {
          const next = queueIndex + 1;
          setQueueIndex(next);
          setCurrentMedia(mediaQueue[next] || null);
          return;
        }

        // At last item of this show's queue. If end_time is in the future, loop back to start.
        if (endTime && now <= endTime) {
          setQueueIndex(0);
          setCurrentMedia(mediaQueue[0] || null);
          return;
        }

        // If no end_time or it's passed, move to next show
        moveToNextShow();
        return;
      }

      // No media in queue -> advance to next show
      moveToNextShow();
    } catch (err) {
      console.warn('advanceQueueOrNextShow error', err);
      moveToNextShow();
    }
  };

  useEffect(() => {
    if (!currentMedia || !ytReady || !isYouTubeUrl(currentMedia.video_url || '')) return;

    const videoId = extractYouTubeID(currentMedia.video_url || '');
    if (!videoId) return;

    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.destroy();
      } catch (err) {
        console.warn('Error destroying previous YouTube player', err);
      }
      youtubePlayerRef.current = null;
    }

    const playerId = `youtube-player-${currentMedia.id}`;
    const playerElement = document.getElementById(playerId);
    
    if (playerElement) {
      youtubePlayerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: muted ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          widget_referrer: window.location.href,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            console.log('YouTube player state change:', event.data);
            const playing = event.data === 1;
            setIsVideoPlaying(playing);

            // manage polling of currentTime while playing to keep the ref fresh
            if (playing) {
              // start poll
              if (!youtubeTimePollRef.current) {
                youtubeTimePollRef.current = window.setInterval(() => {
                  try {
                    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
                      const t = youtubePlayerRef.current.getCurrentTime();
                      if (typeof t === 'number' && !isNaN(t)) {
                        videoCurrentTimeRef.current = t;
                        setVideoCurrentTime(t);
                        try {
                          sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
                        } catch (err) {
                          /* ignore */
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('YT poll error', err);
                  }
                }, 1000);
              }
            } else {
              // stopped/paused/ended -> clear poll
              if (youtubeTimePollRef.current) {
                clearInterval(youtubeTimePollRef.current);
                youtubeTimePollRef.current = null;
              }
            }

            if (event.data === 0) {
              console.log('YouTube media ended, advancing queue');
              advanceQueueOrNextShow();
            }
          },
          onReady: (event: any) => {
            console.log('YouTube player ready');
            if (muted) {
              event.target.mute();
            }

            // If we don't have a fresh time in the ref, try reading from sessionStorage
            try {
              if (!videoCurrentTimeRef.current) {
                const raw = sessionStorage.getItem('nsq_video_time');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && parsed.showId === currentShow?.id && typeof parsed.time === 'number') {
                    videoCurrentTimeRef.current = parsed.time;
                  }
                }
              }
            } catch (err) {
              /* ignore parse errors */
            }

            // Restore playback position if available
            try {
              const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
              if (typeof event.target.seekTo === 'function' && seekToTime > 0) {
                event.target.seekTo(seekToTime, true);
              }
            } catch (err) {
              console.warn('Failed to seek YouTube player:', err);
            }

            setIsVideoPlaying(true);
          },
        },
      });
    }

    return () => {
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (err) {
          console.warn('Error destroying YouTube player on cleanup', err);
        }
        youtubePlayerRef.current = null;
      }
      if (youtubeTimePollRef.current) {
        clearInterval(youtubeTimePollRef.current);
        youtubeTimePollRef.current = null;
      }
    };
  }, [currentMedia, ytReady, muted]);

  // When the currentShow changes, try to load any persisted time for native videos as well
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nsq_video_time');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.showId === currentShow?.id && typeof parsed.time === 'number') {
          videoCurrentTimeRef.current = parsed.time;
          setVideoCurrentTime(parsed.time);
        }
      }
    } catch (err) {
      // ignore
    }

    // cleanup any pending native seek retries when show changes
    nativeSeekRetryRefs.current.forEach(id => clearTimeout(id));
    nativeSeekRetryRefs.current = [];

    return () => {
      nativeSeekRetryRefs.current.forEach(id => clearTimeout(id));
      nativeSeekRetryRefs.current = [];
    };
  }, [currentShow]);

  const handleVideoEnded = () => {
    console.log('Regular video ended, advancing media queue or moving to next show');
    setIsVideoPlaying(false);
    advanceQueueOrNextShow();
  };

  const handleVideoPlay = () => {
    console.log('Video started playing');
    setIsVideoPlaying(true);
    setPaused(false);
  };

  const handleVideoPause = () => {
    console.log('Video paused');
    setIsVideoPlaying(false);
    setPaused(true);
  };

  const togglePlayPause = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      // If a YouTube player is present, use its API
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
        const state = youtubePlayerRef.current.getPlayerState ? youtubePlayerRef.current.getPlayerState() : null;
        // YT state 1 == playing
        if (state === 1) {
          youtubePlayerRef.current.pauseVideo();
          setIsVideoPlaying(false);
          setPaused(true);
        } else {
          youtubePlayerRef.current.playVideo();
          setIsVideoPlaying(true);
          setPaused(false);
        }
        return;
      }

      // Native video element
      if (videoRef.current) {
        if (videoRef.current.paused) {
          // attempt to play (may require user gesture in some browsers)
          await videoRef.current.play();
          setIsVideoPlaying(true);
          setPaused(false);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
          setPaused(true);
        }
      }
    } catch (err) {
      console.error('[VideoContainer] play/pause toggle error:', err);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setVideoCurrentTime(t);
      videoCurrentTimeRef.current = t;
      try {
        sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
      } catch (err) {
        /* ignore storage errors */
      }
    }
  };

  // Robustly restore native video position with retries and optional autoplay
  const restoreNativePosition = (seekToTime: number) => {
    if (!videoRef.current || !seekToTime || seekToTime <= 0) return;

    try {
      videoRef.current.currentTime = seekToTime;
    } catch (err) {
      console.warn('Initial native seek failed:', err);
    }

    let attempts = 0;
    const maxAttempts = 6;
    const trySeek = () => {
      if (!videoRef.current) return;
      attempts += 1;
      const current = videoRef.current.currentTime || 0;
      const diff = Math.abs(current - seekToTime);
      if (diff > 0.5 && attempts <= maxAttempts) {
        try {
          videoRef.current.currentTime = seekToTime;
        } catch (err) {
          // ignore
        }
        const id = window.setTimeout(trySeek, 250);
        nativeSeekRetryRefs.current.push(id);
      } else {
        // if video is paused try to play (muted autoplay more likely to succeed)
        try {
          if (videoRef.current.paused) {
            const p = videoRef.current.play();
            if (p && typeof p.then === 'function') {
              p.then(() => {
                // played
              }).catch(() => {
                // play rejected
              });
            }
          }
        } catch (err) {
          // ignore play errors
        }
      }
    };

    // start retry loop if needed
    trySeek();
  };

  const handleMuteToggle = () => {
    setMuted(!muted);
    if (youtubePlayerRef.current) {
      if (muted) {
        youtubePlayerRef.current.unMute();
      } else {
        youtubePlayerRef.current.mute();
      }
    }
    if (videoRef.current) {
      videoRef.current.muted = !muted;
    }
  };

  const handleLike = () => {
    setLikeCount(likeCount + 1);
    onLike();
  };

  const handleCommentClick = () => {
    console.log('VideoContainer: Comment button clicked');
    onCommentClick();
  };

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let lastTimestamp = 0;
    const speed = 0.06;
    let animationFrame: number;
    let lastCardIndex = 0;
    let autoPause = false;

    const getCardWidth = () => {
      const card = scroll.querySelector('.autofade-card');
      return card ? (card as HTMLElement).offsetWidth : 0;
    };

    const scrollStep = (timestamp: number) => {
      if (!scroll || paused) {
        animationFrame = requestAnimationFrame(scrollStep);
        return;
      }

      if (!lastTimestamp) lastTimestamp = timestamp;
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (!autoPause) {
        scroll.scrollLeft += speed * elapsed;
      }

      const cardWidth = getCardWidth();
      if (cardWidth > 0) {
        const cardIndex = Math.round(scroll.scrollLeft / cardWidth);
        if (cardIndex !== lastCardIndex && !autoPause) {
          autoPause = true;
          lastCardIndex = cardIndex;
          setTimeout(() => {
            autoPause = false;
          }, 1200);
        }
      }

      if (scroll.scrollLeft >= scroll.scrollWidth / 2) {
        scroll.scrollLeft = 0;
        lastCardIndex = 0;
      }

      animationFrame = requestAnimationFrame(scrollStep);
    };

    animationFrame = requestAnimationFrame(scrollStep);

    return () => cancelAnimationFrame(animationFrame);
  }, [shows, paused]);

  useEffect(() => {
    if (currentShowIndex >= sortedShows.length) {
      setCurrentShowIndex(0);
      if (typeof onCurrentShowChange === 'function') onCurrentShowChange(0);
    }
  }, [currentShowIndex, sortedShows.length]);

  // MODAL PLAYER FUNCTIONS
  const playEpisode = useCallback((episode: VODEpisode) => {
    console.log('playEpisode selected:', episode.id, episode.title, 'video_url=', episode.video_url);
    setModalPlayerError(null);
    // Resolve a usable media URL (fallbacks) and attach it to the episode we store
    const resolved = resolveMediaUrl(episode);
    try { console.debug('Resolved episode media URL:', { episodeId: episode.id, resolved }); } catch {}
    if (!resolved) {
      console.warn('No media URL available for episode', episode.id, episode);
      setPlayingEpisode({ ...episode, video_url: '' });
      setCatchUpOpen(true);
      setModalPlayerError('No media URL found for this episode.');
      return;
    }

    const epWithUrl = { ...episode, video_url: resolved } as VODEpisode;
    // Ensure modal is open so DOM nodes mount
    setCatchUpOpen(true);

    setPlayingEpisode(epWithUrl);
    setModalPlayerPlaying(false);
    setModalPlayerProgress(0);

    // Force-muted autoplay to comply with browser policies
    const shouldMute = true;
    setModalPlayerMuted(shouldMute);

    // Initialize YouTube player for modal with retries until DOM + YT API are ready
    const initModalYouTube = (videoId: string) => {
      let attempts = 0;
      const maxAttempts = 20;

      const tryCreate = () => {
        attempts += 1;
        const el = document.getElementById('modal-youtube-player');
        if (!el || !(window as any).YT || !(window as any).YT.Player) {
          if (attempts < maxAttempts) {
            setTimeout(tryCreate, 250);
          } else {
            console.warn('YT player element or API never became available for modal');
          }
          return;
        }

        if (modalYoutubePlayerRef.current) {
          try { modalYoutubePlayerRef.current.destroy(); } catch (err) { /* ignore */ }
          modalYoutubePlayerRef.current = null;
        }

        try {
          modalYoutubePlayerRef.current = new window.YT.Player('modal-youtube-player', {
            videoId,
            playerVars: {
              autoplay: 1,
              mute: shouldMute ? 1 : 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
            },
            events: {
              onStateChange: (event: any) => {
                setModalPlayerPlaying(event.data === 1);
                if (event.data === 0) setModalPlayerPlaying(false);
              },
              onReady: (event: any) => {
                try { event.target.mute(); } catch (err) { /* ignore */ }
                try { setModalPlayerDuration(event.target.getDuration()); } catch (err) { /* ignore */ }
                try { event.target.playVideo(); } catch (err) { /* ignore */ }
                setModalPlayerPlaying(true);

                const poll = () => {
                  if (modalYoutubePlayerRef.current) {
                    try {
                      const t = modalYoutubePlayerRef.current.getCurrentTime();
                      if (typeof t === 'number') setModalPlayerProgress(t);
                    } catch (err) { /* ignore */ }
                    setTimeout(poll, 500);
                  }
                };
                poll();
              }
            }
          });
        } catch (err) {
          console.warn('Failed to create modal YouTube player', err);
        }
      };

      tryCreate();
    };

    const isYouTube = epWithUrl.video_url && isYouTubeUrl(epWithUrl.video_url);
    const isVimeo = epWithUrl.video_url && isVimeoUrl(epWithUrl.video_url);

    // For mobile behave like desktop: attempt muted autoplay/init when possible.
    // If autoplay is blocked or the DOM node isn't yet mounted, fall back to
    // showing the user-play overlay (`modalAwaitingUserPlay`) so the user can
    // explicitly start playback.

    if (epWithUrl.video_url && isYouTubeUrl(epWithUrl.video_url)) {
      const videoId = extractYouTubeID(epWithUrl.video_url);
      if (videoId) initModalYouTube(videoId);
    } else if (epWithUrl.video_url && isVimeoUrl(epWithUrl.video_url)) {
      // vimeo iframe includes autoplay params in renderModalPlayer
    } else if (epWithUrl.video_url) {
      // Native video: try to set src and start playback (muted) immediately.
      // If the modal video element isn't mounted yet, retry until it becomes available
      // and then attempt playback. If play is blocked, show the user-play overlay.
      const trySetAndPlay = () => {
        try {
          if (!modalVideoRef.current) throw new Error('modal video element not mounted');

          modalVideoRef.current.pause();
          modalVideoRef.current.src = epWithUrl.video_url || '';
          modalVideoRef.current.load();
          console.log('Modal native video src set to', epWithUrl.video_url);
          modalVideoRef.current.muted = shouldMute;
          const p = modalVideoRef.current.play();
          if (p && typeof (p as any).then === 'function') {
            (p as any).then(() => {
              setModalPlayerPlaying(true);
              setModalAwaitingUserPlay(false);
            }).catch((err: any) => {
              console.warn('Modal native video play rejected:', err);
              setModalPlayerError('Playback was blocked by the browser or the media failed to start.');
              setModalPlayerPlaying(false);
              setModalAwaitingUserPlay(true);
            });
          } else {
            setModalPlayerPlaying(!modalVideoRef.current.paused);
            setModalAwaitingUserPlay(false);
          }
        } catch (err) {
          // Retry until element mounts, but don't loop forever
          console.warn('Mobile modal: retrying set/play, reason:', err);
          setTimeout(() => {
            // If still no element after a short while, show user-play overlay
            if (!modalVideoRef.current) {
              setModalAwaitingUserPlay(true);
            } else {
              trySetAndPlay();
            }
          }, 200);
        }
      };

      trySetAndPlay();
    }
  }, [modalPlayerMuted, modalPlayerPlaying]);

  // When a native modal video is selected, attempt to autoplay it once the DOM node is mounted
  useEffect(() => {
    if (!playingEpisode) return;

    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);
    const isVimeo = playingEpisode.video_url && isVimeoUrl(playingEpisode.video_url);

    if (!isYouTube && modalVideoRef.current) {
      try {
        modalVideoRef.current.muted = modalPlayerMuted;
        const p = modalVideoRef.current.play();
        if (p && typeof (p as any).then === 'function') {
          (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
        } else {
          setModalPlayerPlaying(!modalVideoRef.current.paused);
        }
      } catch (err) {
        console.warn('Failed to autoplay modal native video', err);
      }
    }
  }, [playingEpisode, modalPlayerMuted]);

  // Ensure native modal video `src` is set when modal mounts on mobile (deferred until DOM available)
  useEffect(() => {
    if (!playingEpisode) return;
    if (!isMobile) return;
    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);

    if (isYouTube) return; // YouTube handled separately

    let mounted = true;
    const trySet = () => {
      if (!mounted) return;
      if (modalVideoRef.current) {
        try {
          if (modalVideoRef.current.src !== (playingEpisode.video_url || '')) {
            modalVideoRef.current.src = playingEpisode.video_url || '';
            modalVideoRef.current.load();
            console.log('Mobile modal: set native video src to', playingEpisode.video_url);
          }
        } catch (err) {
          console.warn('Mobile modal: failed to set video src', err);
        }
      } else {
        // retry shortly until the element mounts (DOM may not be ready yet)
        setTimeout(trySet, 200);
      }
    };

    // Only set src if we're awaiting a user play (deferred flow)
    if (modalAwaitingUserPlay) trySet();

    return () => { mounted = false; };
  }, [playingEpisode, isMobile, modalAwaitingUserPlay]);

  const handleModalPlayerPlayPause = useCallback(() => {
    if (modalYoutubePlayerRef.current) {
      if (modalPlayerPlaying) {
        modalYoutubePlayerRef.current.pauseVideo();
      } else {
        modalYoutubePlayerRef.current.playVideo();
      }
    } else if (modalVideoRef.current) {
      if (modalVideoRef.current.paused) {
        modalVideoRef.current.play();
      } else {
        modalVideoRef.current.pause();
      }
    }
    setModalPlayerPlaying(!modalPlayerPlaying);
  }, [modalPlayerPlaying]);

  const handleModalPlayerMuteToggle = useCallback(() => {
    const newMuted = !modalPlayerMuted;
    setModalPlayerMuted(newMuted);
    
    if (modalYoutubePlayerRef.current) {
      if (newMuted) {
        modalYoutubePlayerRef.current.mute();
      } else {
        modalYoutubePlayerRef.current.unMute();
      }
    } else if (modalVideoRef.current) {
      modalVideoRef.current.muted = newMuted;
    }
  }, [modalPlayerMuted]);

  const handleModalPlayerProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setModalPlayerProgress(value);
    
    if (modalYoutubePlayerRef.current) {
      modalYoutubePlayerRef.current.seekTo(value, true);
    } else if (modalVideoRef.current) {
      modalVideoRef.current.currentTime = value;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVideoPlayer = (isFullscreenMode: boolean = false) => {
    if (!currentMedia || !currentMedia.video_url) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Play className="h-16 w-16 text-gray-400" />
        </div>
      );
    }

    if (isYouTubeUrl(currentMedia.video_url)) {
      return (
        <div
          id={`youtube-player-${currentMedia.id}`}
          className="w-full h-full"
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      );
    }

    if (isVimeoUrl(currentMedia.video_url)) {
      return (
        <iframe
          ref={vimeoRef}
          className="w-full h-full"
          src={`https://player.vimeo.com/video/${extractVimeoID(currentMedia.video_url)}?autoplay=1&muted=${muted ? 1 : 0}&controls=1&api=1&player_id=vimeoPlayer&playsinline=1`}
          title={currentMedia.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      );
    }

    return (
      <div className="relative w-full h-full">
        <video
          key={`${currentMedia.id}-${isFullscreenMode ? 'fullscreen' : 'normal'}`}
          ref={videoRef}
          className="w-full h-full object-cover"
          poster={currentMedia.thumbnail_url || '/placeholder.svg'}
          controls
          muted={muted}
          playsInline
          preload="metadata"
          onEnded={() => { setIsVideoPlaying(false); advanceQueueOrNextShow(); }}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onTimeUpdate={handleVideoTimeUpdate}
          autoPlay
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onLoadedMetadata={() => {
            // Restore video time if transitioning between modes (with retries)
            const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
            if (videoRef.current && seekToTime > 0) {
              restoreNativePosition(seekToTime);
            }
          }}
          {...(isIOS && {
            'webkit-playsinline': 'true',
            'x-webkit-airplay': 'allow',
          })}
        >
          <source src={currentMedia.video_url || ''} type="video/mp4" />
          <source src={currentMedia.video_url || ''} type="video/webm" />
          Your browser does not support the video tag.
        </video>
        {!isYouTubeUrl(currentMedia.video_url) && (
          <button
            onClick={handleMuteToggle}
            className={`absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors ${isFullscreenMode ? 'z-20' : 'z-10'}`}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  };

  const renderModalPlayer = () => {
    if (!playingEpisode) return null;

    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);
    const isVimeo = playingEpisode.video_url && isVimeoUrl(playingEpisode.video_url);

    return (
      <div className="mb-8 rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
        <div className="relative aspect-video" ref={modalPlayerContainerRef}>
          {isYouTube ? (
            // On mobile we wait for an explicit user tap before creating the YouTube iframe/player
            isMobile && modalAwaitingUserPlay ? (
              <div className="w-full h-full flex items-center justify-center bg-black/60">
                <button
                  onClick={() => {
                    setModalAwaitingUserPlay(false);
                    const videoId = extractYouTubeID(playingEpisode.video_url || '');
                    if (videoId) {
                      // create player now that user gesture occurred
                      try {
                        if (modalYoutubePlayerRef.current) {
                          try { modalYoutubePlayerRef.current.destroy(); } catch (e) {}
                          modalYoutubePlayerRef.current = null;
                        }
                        modalYoutubePlayerRef.current = new window.YT.Player('modal-youtube-player', {
                          videoId,
                          playerVars: { autoplay: 1, mute: modalPlayerMuted ? 1 : 0, playsinline: 1 },
                          events: {
                            onReady: (ev: any) => { try { ev.target.playVideo(); } catch (e){}; setModalPlayerPlaying(true); },
                            onStateChange: (ev: any) => setModalPlayerPlaying(ev.data === 1)
                          }
                        });
                      } catch (err) {
                        console.warn('YT init after user gesture failed', err);
                      }
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-6"
                >
                  <Play size={36} />
                </button>
              </div>
            ) : (
              <div id="modal-youtube-player" className="w-full h-full" />
            )
          ) : isVimeo ? (
            <iframe
              className="w-full h-full"
              src={`https://player.vimeo.com/video/${extractVimeoID(playingEpisode.video_url!)}?autoplay=1&muted=${modalPlayerMuted ? 1 : 0}&controls=0`}
              title={playingEpisode.title}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              ref={modalVideoRef}
              className="w-full h-full"
              src={playingEpisode.video_url}
              poster={playingEpisode.thumbnail_url}
              muted={modalPlayerMuted}
              playsInline
              onPlay={() => setModalPlayerPlaying(true)}
              onPause={() => setModalPlayerPlaying(false)}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                setModalPlayerProgress(video.currentTime);
                setModalPlayerDuration(video.duration);
              }}
              onLoadedMetadata={(e) => {
                setModalPlayerDuration(e.currentTarget.duration);
                setModalPlayerError(null);
              }}
              onError={async (e) => {
                console.warn('Modal video element error event', e);
                const url = playingEpisode.video_url || '';
                try {
                  const head = await fetch(url, { method: 'HEAD' });
                  if (!head.ok) {
                    const txt = await head.text().catch(() => null);
                    setModalPlayerError(`Media HEAD failed: ${head.status} ${head.statusText} - ${txt}`);
                    console.warn('Media HEAD response', head.status, head.statusText, txt);
                  } else {
                    setModalPlayerError('Media failed to load (unknown reason).');
                  }
                } catch (err) {
                  console.warn('Error while HEADing media URL', err);
                  setModalPlayerError(String(err));
                }
              }}
              autoPlay={!isMobile}
            />
          )}

          {/* Mobile: user-play overlay for native videos when awaiting gesture */}
          {modalAwaitingUserPlay && !isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => {
                  setModalAwaitingUserPlay(false);
                  try {
                    if (modalVideoRef.current) {
                      modalVideoRef.current.muted = modalPlayerMuted;
                      const p = modalVideoRef.current.play();
                      if (p && typeof (p as any).then === 'function') {
                        (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
                      }
                    }
                  } catch (err) {
                    console.warn('Mobile manual play failed', err);
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-6"
              >
                <Play size={36} />
              </button>
            </div>
          )}

          {/* Modal player controls */}
            {modalPlayerError && (
              <div className="absolute top-4 left-4 right-4 p-3 bg-red-900/80 text-red-100 rounded-md z-30">
                <strong className="font-semibold">Playback Error:</strong>
                <div className="text-sm mt-1">{modalPlayerError}</div>
              </div>
            )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Progress bar */}
              <input
                type="range"
                min="0"
                max={modalPlayerDuration || 100}
                value={modalPlayerProgress}
                onChange={handleModalPlayerProgress}
                className="w-full h-1.5 mb-4 rounded-lg appearance-none cursor-pointer bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleModalPlayerPlayPause}
                    className="text-white hover:text-purple-300 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    {modalPlayerPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={handleModalPlayerMuteToggle}
                    className="text-white hover:text-purple-300 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    {modalPlayerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <span className="text-sm text-gray-300 font-mono">
                    {formatTime(modalPlayerProgress)} / {formatTime(modalPlayerDuration)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-300">
                  {playingEpisode.title}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Episode info */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white mb-2">{playingEpisode.title}</h3>
          {playingEpisode.description && (
            <p className="text-sm text-gray-300 mb-3">{playingEpisode.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs text-gray-400">
                {playingEpisode.duration ? formatTime(playingEpisode.duration) : 'N/A'}
              </span>
            </div>
            <button
              onClick={() => setPlayingEpisode(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1 hover:bg-gray-800 rounded-lg"
            >
              Close Player
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (shows.length === 0 || !currentShow) {
    return (
      <div className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 mb-4">
        <div className="text-center text-white">
          <h3 className="text-lg font-semibold mb-2">No Studio Shows Available</h3>
          <p className="text-sm opacity-90">Check back later for live shows and videos!</p>
        </div>
      </div>
    );
  }

  // Always render the video player once, only change container style for fullscreen
  const videoWrapperClass = isFullscreen
    ? "fixed inset-0 bg-black z-[9999] flex items-center justify-center"
    : "w-full mb-6";
  const videoWrapperStyle = isFullscreen
    ? { width: '100vw', height: '100vh', backgroundColor: 'black' }
    : {};

  return (
    <div ref={videoContainerRef} className={videoWrapperClass} style={videoWrapperStyle}>
      <Card className={isFullscreen ? "w-full h-full m-0 p-0 bg-transparent border-none shadow-none" : "mb-4"}>
        <CardContent className={isFullscreen ? "p-0 w-full h-full" : "p-0"}>
          <div className={isFullscreen ? "relative w-full h-full" : "relative aspect-video rounded-lg overflow-hidden bg-black"}>
            {currentShow?.video_url ? (
              renderVideoPlayer(isFullscreen)
            ) : currentShow?.thumbnail_url ? (
              <div className="relative w-full h-full">
                <img
                  src={currentShow.thumbnail_url}
                  alt={currentShow.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder.svg';
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="bg-white/90 dark:bg-black/90 rounded-full p-4">
                    <Play className="h-8 w-8 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <Play className="h-16 w-16 text-gray-400" />
              </div>
            )}

            {/* Overlays and controls */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
              {/* Centered Play/Pause floating control */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlayPause(e); }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-30 pointer-events-auto"
                aria-label="Play/Pause"
              >
                {isVideoPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>

              {/* Exit fullscreen button (only in fullscreen) */}
              {isFullscreen && (
                <button
                  onClick={() => {
                    setIsFullscreen(false);
                    document.body.style.overflow = 'auto';
                    if (document.exitFullscreen) {
                      document.exitFullscreen();
                    } else if ((document as any).webkitExitFullscreen) {
                      (document as any).webkitExitFullscreen();
                    } else if ((document as any).mozCancelFullScreen) {
                      (document as any).mozCancelFullScreen();
                    } else if ((document as any).msExitFullscreen) {
                      (document as any).msExitFullscreen();
                    }
                  }}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-20 pointer-events-auto"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {/* Live indicator */}
              {currentShow?.is_live && (
                <div className={`absolute top-4 left-4 z-${isFullscreen ? '20' : '10'} pointer-events-auto`}> 
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <Badge className="bg-red-500 text-white text-sm font-medium">LIVE</Badge>
                  </div>
                </div>
              )}

              {currentShow && (
                <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-sm font-medium z-${isFullscreen ? '20' : '10'} ${getTimeStatus(currentShow).className} pointer-events-auto`}>
                  {currentShow.is_live && <Eye className="inline w-4 h-4 mr-1" />}
                  {!currentShow.is_live && currentShow.scheduled_time && <Clock className="inline w-4 h-4 mr-1" />}
                  {getTimeStatus(currentShow).text}
                </div>
              )}

              {/* Mobile Overlay Bar */}
              <div className={`sm:hidden absolute bottom-16 right-2 flex flex-col space-y-2 z-${isFullscreen ? '20' : '10'} pointer-events-auto`}>
                <div className="flex flex-row items-center bg-black/50 text-white px-3 py-1 rounded-full pointer-events-auto">
                  <Users className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-[10px] font-medium">{viewerCount.toLocaleString()}</span>
                </div>
                <div className="flex flex-row items-center bg-black/50 text-pink-500 px-3 py-1 rounded-full cursor-pointer hover:bg-black/70 pointer-events-auto" onClick={handleLike}>
                  <Heart className="w-4 h-4 fill-current mr-1" />
                  <span className="text-[10px] font-medium text-white">{likeCount}</span>
                </div>
                <div className="flex flex-row items-center bg-black/50 text-blue-500 px-3 py-1 rounded-full cursor-pointer hover:bg-black/70 pointer-events-auto" onClick={handleCommentClick}>
                  <MessageCircle className="w-4 h-4 mr-1" />
                  <span className="text-[10px] font-medium text-white">{messages.length}</span>
                </div>
              </div>

              {/* Mute toggle for YouTube in overlays */}
              {isYouTubeUrl(currentShow?.video_url || '') && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }}
                  className={`absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-${isFullscreen ? '20' : '10'} pointer-events-auto`}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
          {/* Description and Now Watching (portrait only) */}
          {!isFullscreen && currentShow && (
            <div className="p-4 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch w-full overflow-hidden min-h-[4.25rem]">
                <div
                  className="flex flex-col justify-between text-white px-4 py-2 rounded-lg shadow w-full sm:w-1/3 max-w-full"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #2d5676, #7812bb)',
                  }}
                >
                  <div className="flex items-center space-x-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-semibold uppercase bg-white/20 text-white px-2 py-1 rounded-full shadow">
                      Now Watching
                    </span>
                  </div>
                  <span className="text-sm font-bold line-clamp-1 mt-auto">
                    {currentShow.title}
                  </span>
                </div>
                {currentShow.description && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-gray-900 text-white px-6 py-2 rounded-lg font-medium text-sm shadow w-full h-full flex items-center min-h-[3.5rem]">
                    <div
                      className="marquee-text whitespace-nowrap animate-marquee"
                      style={{ animationDuration: '18s' }}
                    >
                      {currentShow.description}
                    </div>
                  </div>
                )}
                {/* IMPROVED CATCH UP BUTTON - matches description badge height */}
                <div className="flex items-center">
                  <button
                    onClick={() => setCatchUpOpen(true)}
                    className="inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow h-full min-h-[3.5rem] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundImage: 'linear-gradient(to right, #8B5CF6, #EC4899)',
                      height: '100%',
                      minHeight: '3.5rem'
                    }}
                    aria-label="Open Catch Up"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Catch Up</span>
                  </button>
                </div>
              </div>
              
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(100%); }
                  100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                  display: inline-block;
                  will-change: transform;
                  animation: marquee 18s linear infinite;
                }
              `}</style>
            </div>
          )}
          {/* Enhanced Modal */}
          {portalMounted && currentShow && createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto"> 
              {/* Backdrop */}
              <div 
                className={`absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={() => setCatchUpOpen(false)}
              />
              
              {/* Modal Content */}
              <div 
                className={`relative bg-gray-900 dark:bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden transform transition-all duration-300 ${modalVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">Catch Up</h2>
                      <p className="text-sm text-gray-400 mt-1">Watch all past shows you've missed</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      {/* Logo: white for dark mode, dark for light mode */}
                      <div className="w-36 h-10 flex items-center justify-end">
                        <img src="/uploads/one%20studio.png" alt="oneStudio" className="block dark:hidden h-8" />
                        <img src="/uploads/one%20studio-white.png" alt="oneStudio" className="hidden dark:block h-8" />
                      </div>
                      <button
                        onClick={() => setCatchUpOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                        aria-label="Close modal"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="p-6">
                    {/* Inline Player */}
                    {renderModalPlayer()}

                    {/* VOD Library - show all past shows across all series */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-white"></h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <span>Scroll for more</span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      
                      {isMobile ? (
                        renderMobileCatchUpGrid()
                      ) : (
                        <VODLibrary 
                          showId={""}
                          showAllPastShows={true}
                          defaultViewMode="by-category"
                          shows={shows}
                          onEpisodeSelect={playEpisode}
                          playingEpisodeId={playingEpisode?.id}
                        />
                      )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                      <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg hover:bg-gray-800">
                        <ChevronLeft size={20} />
                        <span>Previous</span>
                      </button>
                      <div className="flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${num === 1 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800">
                        <span>Next</span>
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>, 
            document.body
          )}
        </CardContent>
      </Card>
    </div>
  );
};