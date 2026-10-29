import { useSearchParams, useLocation } from 'react-router-dom';
import MonetizationCard from '../components/studio/MonetizationCard';
import LeftTrending from '@/components/studio/LeftTrending';
import LeftTopCreators from '@/components/studio/LeftTopCreators';
import RightYourStudio from '@/components/studio/RightYourStudio';
import RightInviteFriends from '@/components/studio/RightInviteFriends';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { MobileReelScroller } from '../components/studio/MobileReelScroller';
import StudioHeader from '../components/studio/StudioHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Grid3x3, Cpu, Smile, GraduationCap,
  Lightbulb, Music, Gamepad2, Utensils, Dumbbell,
  Camera, Palette, Trophy, ChevronUp, ChevronDown,
  Maximize2, Minimize2, Play, Pause, Volume2, VolumeX,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import useMeta from '@/hooks/useMeta';
import StudioSkeleton from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const categories = [
  { name: 'All', icon: Grid3x3 },
  { name: 'Tech', icon: Cpu },
  { name: 'Comedy', icon: Smile },
  { name: 'Sports', icon: Trophy },
  { name: 'Education', icon: GraduationCap },
  { name: 'Inspiration', icon: Lightbulb },
  { name: 'Music', icon: Music },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'Food', icon: Utensils },
  { name: 'Fitness', icon: Dumbbell },
  { name: 'Lifestyle', icon: Camera },
  { name: 'Art', icon: Palette },
];

const shuffleWithSeed = <T,>(items: T[], seed: number): T[] => {
  const shuffled = [...items];
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const Studio = () => {
  useMeta({
    title: 'Studio — Live & On-Demand Shows — NexSq',
    description: 'Join live studio shows, watch on-demand content, and interact with creators on NexSq Studio.',
    url: window.location.href,
  });

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWideDesktop = useMediaQuery('(min-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const isSmallMobile = useMediaQuery('(max-width: 480px)');

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'all' | 'trending'>('all');
  const [randomMixSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const randomPageOffsetsRef = useRef<number[]>([]);

  const { user } = useAuth();
  const [fullUser, setFullUser] = useState<any>(null);
  const [showChannelPrompt, setShowChannelPrompt] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const location = useLocation();
  const highlightedReelFromState: any = (location?.state as any)?.highlightedReel || null;

  const videoParam = searchParams.get('video') || highlightId;
  const autoplayRequested =
    searchParams.get('autoplay') === 'true' ||
    (location?.state as any)?.autoplay === true ||
    false;
  const unmuteRequested =
    searchParams.get('unmute') === 'true' ||
    (location?.state as any)?.unmute === true ||
    false;

  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userViews, setUserViews] = useState<Set<string>>(new Set());
  const [trendingReels, setTrendingReels] = useState<any[]>([]);
  const [topCreators, setTopCreators] = useState<any[]>([]);
  const [mostViewed, setMostViewed] = useState<any[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<Set<string>>(new Set());
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [studioSearch, setStudioSearch] = useState({
    query: '',
    type: 'all' as 'all' | 'creators' | 'channels' | 'videos',
  });

  // Video playback state
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false); // Default unmuted for autoplay
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState<boolean>(true);

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const reelStripRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const controlsTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const swipeDirectionRef = useRef<'up' | 'down' | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const lastTapRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);
  const didInitialAutoplayRef = useRef<boolean>(false);

  // Wheel-scroll debouncing for desktop reel navigation
  const wheelAccumRef = useRef<number>(0);
  const wheelLockRef = useRef<boolean>(false);
  const wheelUnlockTimerRef = useRef<number | null>(null);

  // User-gesture tracker for autoplay permission
  const userHasInteractedRef = useRef<boolean>(false);

  // Mark user interaction for autoplay policy
  useEffect(() => {
    const markInteracted = () => {
      userHasInteractedRef.current = true;
      setHasUserInteracted(true);
    };
    window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
    window.addEventListener('keydown', markInteracted, { once: true, passive: true });
    window.addEventListener('touchstart', markInteracted, { once: true, passive: true });
    window.addEventListener('wheel', markInteracted, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', markInteracted);
      window.removeEventListener('keydown', markInteracted);
      window.removeEventListener('touchstart', markInteracted);
      window.removeEventListener('wheel', markInteracted);
    };
  }, []);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current !== null) {
      window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const hideControlsDelayed = useCallback(() => {
    if (isDesktop) return;
    clearControlsTimeout();
    controlsTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [clearControlsTimeout, isDesktop]);

  const handleUserInteraction = useCallback(() => {
    setControlsVisible(true);
    if (!isMobile) return;
    hideControlsDelayed();
  }, [hideControlsDelayed, isMobile]);

  // Progress ticker
  useEffect(() => {
    const currentVideo = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
    if (!currentVideo) {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = window.setInterval(() => {
      if (currentVideo.duration) {
        setProgress((currentVideo.currentTime / currentVideo.duration) * 100);
      }
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [currentVideoId, isAutoPlayEnabled]);

  /**
   * Central playback routine.
   *
   * Strategy:
   *  1. Pause every other video.
   *  2. If autoplay is ON and the user has already interacted → play UNMUTED.
   *  3. Otherwise (first mount, no user interaction yet) → try UNMUTED, and
   *     if the browser blocks it, fall back to MUTED autoplay once.
   *  4. Keep the state (`isMuted`) in sync with whatever actually worked.
   */
  const handleVideoPlayback = useCallback(
    (videoId: string | null, opts?: { forceUnmuted?: boolean }) => {
      // Pause everything else
      videoRefs.current.forEach((video, id) => {
        if (id === videoId) return;
        if (!video.paused) video.pause();
        video.muted = true;
      });

      if (!videoId) {
        setIsPlaying(false);
        setIsBuffering(false);
        setCurrentVideoId(null);
        setProgress(0);
        return;
      }

      const video = videoRefs.current.get(videoId);
      if (!video) return;

      setCurrentVideoId(videoId);
      setPlaybackError(false);
      setIsBuffering(true);

      // Decide initial muted state.
      // - If caller forces unmuted (URL request, or user toggle) → unmuted.
      // - If user has interacted with the page already → unmuted.
      // - Otherwise → start unmuted but be ready to fall back to muted.
      const wantUnmuted = opts?.forceUnmuted !== false; // default to unmuted
      const willStartUnmuted = wantUnmuted && userHasInteractedRef.current;

      // Always attempt unmuted first if the user has interacted
      if (willStartUnmuted) {
        video.muted = false;
        video.volume = volume;
        setIsMuted(false);
      } else {
        // First mount / no interaction: try unmuted, but browsers may block.
        // Start muted to guarantee playback, then unmute opportunistically.
        video.muted = true;
        video.volume = 0;
        setIsMuted(true);
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsBuffering(false);

            // Only unmute after a real user gesture; page focus is not activation.
            if (!willStartUnmuted && wantUnmuted) {
              if (userHasInteractedRef.current) {
                video.muted = false;
                video.volume = volume;
                setIsMuted(false);
              }
            }
          })
          .catch((error) => {
            console.log('Playback prevented:', error);
            setIsPlaying(false);
            setIsBuffering(false);
            if (error?.name !== 'AbortError') {
              // Final fallback: muted playback so the reel still moves.
              try {
                video.muted = true;
                video.volume = 0;
                setIsMuted(true);
                video.play().catch(() => setPlaybackError(true));
              } catch {
                setPlaybackError(true);
              }
            }
          });
      }
    },
    [volume]
  );

  const togglePlay = useCallback(() => {
    const video = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
    if (!video) return;

    if (video.paused) {
      setPlaybackError(false);
      setIsBuffering(true);
      // Explicit user action → play unmuted.
      video.muted = false;
      video.volume = volume;
      setIsMuted(false);
      video.play().catch((error) => {
        setIsPlaying(false);
        setIsBuffering(false);
        if (error?.name !== 'AbortError') setPlaybackError(true);
      });
    } else {
      video.pause();
    }
  }, [currentVideoId, volume]);

  const toggleMute = useCallback(() => {
    const video = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
    setIsMuted(!isMuted);
    if (video) {
      video.muted = !isMuted;
      video.volume = !isMuted ? 0 : volume;
    }
  }, [currentVideoId, isMuted, volume]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      const video = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
      if (video) {
        video.volume = newVolume;
        if (newVolume === 0) {
          setIsMuted(true);
          video.muted = true;
        } else {
          setIsMuted(false);
          video.muted = false;
        }
      }
    },
    [currentVideoId]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
      if (!video || !video.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const newTime = x * video.duration;
      video.currentTime = newTime;
      setProgress((newTime / video.duration) * 100);
    },
    [currentVideoId]
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const INITIAL_BATCH_SIZE = isSmallMobile ? 8 : isMobile ? 10 : 15;

  const getPublicUrl = useCallback((path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://pfemdshixllwqqajsxxp.supabase.co/storage/v1/object/public/studio-videos/${path}`;
  }, []);

  const fetchVideos = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }) => {
      let query = supabase.from('studio_videos').select('*');
      const useRandomMix = activeTab === 'all' && !highlightId && !highlightedReelFromState;

      if (activeTab === 'trending') {
        query = query
          .order('views', { ascending: false })
          .order('likes', { ascending: false })
          .order('created_at', { ascending: false });
        query = query.range(
          pageParam * INITIAL_BATCH_SIZE,
          (pageParam + 1) * INITIAL_BATCH_SIZE - 1
        );
      } else if (useRandomMix) {
        let countQuery = supabase
          .from('studio_videos')
          .select('id', { count: 'exact', head: true });

        if (selectedCategory && selectedCategory !== 'All') {
          countQuery = countQuery.contains('categories', [selectedCategory]);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        const totalCount = count || 0;
        const remainingCount = Math.max(0, totalCount - 5);
        const pageOffsets = Array.from(
          { length: Math.ceil(remainingCount / INITIAL_BATCH_SIZE) },
          (_, index) => 5 + index * INITIAL_BATCH_SIZE
        );
        const categorySeed = selectedCategory
          .split('')
          .reduce((sum, character) => sum + character.charCodeAt(0), 0);
        randomPageOffsetsRef.current = shuffleWithSeed(
          pageOffsets,
          randomMixSeed + categorySeed
        );

        query = query.order('created_at', { ascending: false });
        if (pageParam === 0) {
          query = query.range(0, Math.max(0, Math.min(4, totalCount - 1)));
        } else {
          const offset = randomPageOffsetsRef.current[pageParam - 1];
          if (offset === undefined) {
            return { videos: [], nextPage: undefined, page: pageParam };
          }
          query = query.range(
            offset,
            Math.min(offset + INITIAL_BATCH_SIZE - 1, totalCount - 1)
          );
        }
      } else {
        query = query
          .order('created_at', { ascending: false })
          .range(pageParam * INITIAL_BATCH_SIZE, (pageParam + 1) * INITIAL_BATCH_SIZE - 1);
      }

      if (selectedCategory && selectedCategory !== 'All') {
        query = query.contains('categories', [selectedCategory]);
      }

      const { data: allVideos, error } = await query;
      if (error) throw error;
      const videosArr = allVideos || [];

      const ownerIds = Array.from(
        new Set(videosArr.flatMap((v: any) => [v.user_id, v.creator_id]).filter(Boolean))
      );
      const channelIds = Array.from(
        new Set(videosArr.map((v: any) => v.channel_id).filter(Boolean))
      );

      const usersById: Record<string, any> = {};
      const channelsById: Record<string, any> = {};

      try {
        const [usersResp, channelsResp] = await Promise.all([
          ownerIds.length
            ? supabase.from('users').select('id, username, avatar_url').in('id', ownerIds)
            : Promise.resolve({ data: [] }),
          channelIds.length
            ? supabase
                .from('studio_channels')
                .select('id, name, user_id, avatar_url')
                .in('id', channelIds)
            : Promise.resolve({ data: [] }),
        ]);
        (usersResp.data || []).forEach((u: any) => (usersById[u.id] = u));
        (channelsResp.data || []).forEach((c: any) => (channelsById[c.id] = c));
      } catch (e) {
        console.warn('[Studio] Enrichment failed:', e);
      }

      const processedVideos = videosArr.map((v: any) => {
        const owner = usersById[v.user_id] || usersById[v.creator_id] || null;
        return {
          ...v,
          video_url: getPublicUrl(v.video_url || v.url || v.src || ''),
          channel_name: channelsById[v.channel_id]?.name || '',
          channel_id: v.channel_id,
          user_id: v.user_id,
          creator: owner
            ? {
                name: owner.username || owner.name || 'Unknown',
                    avatar_url: channelsById[v.channel_id]?.avatar_url || owner.avatar_url || '',
              }
            : { name: '', avatar_url: '' },
          likes_count: v.likes || 0,
          comments_count: v.comments || 0,
          shares_count: v.shares || 0,
        };
      });

      const finalVideos =
        useRandomMix && pageParam > 0
          ? shuffleWithSeed(processedVideos, randomMixSeed + pageParam)
          : [...processedVideos];

      if (highlightId && pageParam === 0) {
        const idx = finalVideos.findIndex((v) => String(v.id) === String(highlightId));
        if (idx > -1) {
          const [highlighted] = finalVideos.splice(idx, 1);
          finalVideos.unshift(highlighted);
        }
      }

      if (highlightedReelFromState && pageParam === 0) {
        const exists = finalVideos.some(
          (v) => String(v.id) === String(highlightedReelFromState.id)
        );
        if (!exists) {
          finalVideos.unshift({
            ...highlightedReelFromState,
            video_url: getPublicUrl(
              highlightedReelFromState.video_url ||
                highlightedReelFromState.url ||
                highlightedReelFromState.src ||
                ''
            ),
            creator: { name: '', avatar_url: '' },
          });
        }
      }

      return {
        videos: finalVideos,
        nextPage: useRandomMix
          ? pageParam < randomPageOffsetsRef.current.length
            ? pageParam + 1
            : undefined
          : allVideos && allVideos.length === INITIAL_BATCH_SIZE
            ? pageParam + 1
            : undefined,
        page: pageParam,
      };
    },
    [
      selectedCategory,
      activeTab,
      highlightId,
      highlightedReelFromState,
      getPublicUrl,
      INITIAL_BATCH_SIZE,
      randomMixSeed,
    ]
  );

  const {
    data: videoPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isLoading: videosLoading,
    isError: videosFailed,
    error: videosError,
  } = useInfiniteQuery({
    queryKey: ['studio-videos', selectedCategory, highlightId, activeTab, randomMixSeed],
    queryFn: fetchVideos,
    initialPageParam: 0,
    getNextPageParam: (lastPage: { nextPage?: number }) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const videos: any[] = useMemo(
    () => videoPages?.pages.flatMap((page: any) => page.videos) || [],
    [videoPages]
  );

  const searchedVideos = useMemo(() => {
    const query = studioSearch.query.toLocaleLowerCase();
    if (!query) return videos;
    return videos.filter((video) => {
      const creator = video.creator?.name?.toLocaleLowerCase() || '';
      const channel = video.channel_name?.toLocaleLowerCase() || '';
      const title = video.title?.toLocaleLowerCase() || '';
      const description = video.description?.toLocaleLowerCase() || '';
      if (studioSearch.type === 'creators') return creator.includes(query);
      if (studioSearch.type === 'channels') return channel.includes(query);
      if (studioSearch.type === 'videos')
        return title.includes(query) || description.includes(query);
      return `${creator} ${channel} ${title} ${description}`.includes(query);
    });
  }, [videos, studioSearch]);

  const {
    data: channel,
    isLoading: channelLoading,
    refetch: refetchChannel,
  } = useQuery({
    queryKey: ['studio-channel', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: channelData } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return channelData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const visibleVideos = searchedVideos;

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || visibleVideos.length === 0) return;
    if (activeIndex >= visibleVideos.length - 2) {
      void fetchNextPage();
    }
  }, [activeIndex, fetchNextPage, hasNextPage, isFetchingNextPage, visibleVideos.length]);

  const handleStudioSearch = useCallback(
    (query: string, type: 'all' | 'creators' | 'channels' | 'videos') => {
      setStudioSearch({ query, type });
      setActiveIndex(0);
    },
    []
  );

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(newIndex, visibleVideos.length - 1));
      if (clampedIndex === activeIndex) return;
      setActiveIndex(clampedIndex);
      setProgress(0);
    },
    [activeIndex, visibleVideos]
  );

  const goToNextVideo = useCallback(() => {
    if (activeIndex < visibleVideos.length - 1) handleIndexChange(activeIndex + 1);
  }, [activeIndex, visibleVideos.length, handleIndexChange]);

  const goToPreviousVideo = useCallback(() => {
    if (activeIndex > 0) handleIndexChange(activeIndex - 1);
  }, [activeIndex, handleIndexChange]);

  // Scroll the reel strip so the active slide is visible
  useEffect(() => {
    if (!isDesktop) return;
    const strip = reelStripRef.current;
    if (!strip) return;
    const slide = slideRefs.current.get(activeIndex);
    if (!slide) return;
    const target = slide.offsetTop;
    strip.scrollTo({ top: target, behavior: 'smooth' });
  }, [activeIndex, isDesktop]);

  // Desktop wheel navigation
  useEffect(() => {
    if (!isDesktop) return;
    const strip = reelStripRef.current;
    if (!strip) return;

    const THRESHOLD = 40;
    const LOCK_MS = 450;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();

      // First wheel = user interaction → unlocks unmuted autoplay
      if (!userHasInteractedRef.current) {
        userHasInteractedRef.current = true;
      }

      if (wheelLockRef.current) return;

      wheelAccumRef.current += e.deltaY;

      if (Math.abs(wheelAccumRef.current) >= THRESHOLD) {
        const direction = wheelAccumRef.current > 0 ? 'down' : 'up';
        wheelAccumRef.current = 0;
        wheelLockRef.current = true;

        if (direction === 'down') goToNextVideo();
        else goToPreviousVideo();

        if (wheelUnlockTimerRef.current) window.clearTimeout(wheelUnlockTimerRef.current);
        wheelUnlockTimerRef.current = window.setTimeout(() => {
          wheelLockRef.current = false;
          wheelUnlockTimerRef.current = null;
        }, LOCK_MS);
      }
    };

    strip.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      strip.removeEventListener('wheel', handleWheel);
      if (wheelUnlockTimerRef.current) {
        window.clearTimeout(wheelUnlockTimerRef.current);
        wheelUnlockTimerRef.current = null;
      }
    };
  }, [isDesktop, goToNextVideo, goToPreviousVideo]);

  // Desktop touch swipe
  useEffect(() => {
    if (!isDesktop) return;
    const strip = reelStripRef.current;
    if (!strip) return;

    let startY = 0;
    let startTime = 0;
    let isDown = false;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
      isDown = true;
      userHasInteractedRef.current = true;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!isDown) return;
      isDown = false;
      const deltaY = e.changedTouches[0].clientY - startY;
      const deltaTime = Date.now() - startTime;
      const fast = Math.abs(deltaY) > 40 && deltaTime < 400;
      const slow = Math.abs(deltaY) > 90 && deltaTime < 700;
      if (fast || slow) {
        if (deltaY < 0) goToNextVideo();
        else goToPreviousVideo();
      }
    };
    strip.addEventListener('touchstart', onTouchStart, { passive: true });
    strip.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      strip.removeEventListener('touchstart', onTouchStart);
      strip.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDesktop, goToNextVideo, goToPreviousVideo]);

  // Keyboard navigation
  useEffect(() => {
    if (!isDesktop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      userHasInteractedRef.current = true;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextVideo();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousVideo();
      } else if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, goToNextVideo, goToPreviousVideo, togglePlay, toggleFullscreen, toggleMute]);

  // Auto-play next when current ends
  useEffect(() => {
    const currentVideo = currentVideoId ? videoRefs.current.get(currentVideoId) : null;
    if (!currentVideo) return;
    const handleEnded = () => {
      if (isAutoPlayEnabled) goToNextVideo();
    };
    currentVideo.addEventListener('ended', handleEnded);
    return () => currentVideo.removeEventListener('ended', handleEnded);
  }, [currentVideoId, goToNextVideo, isAutoPlayEnabled]);

  /**
   * Playback for active index.
   *
   * When the user scrolls to a new video (or index changes for any reason):
   *  - If autoplay is ON: play the new active video immediately, unmuted.
   *  - If autoplay is OFF: don't autoplay, but still pause the old one.
   */
  useEffect(() => {
    if (visibleVideos.length === 0) return;
    const videoId = String(visibleVideos[activeIndex]?.id);
    if (!videoId) return;

    if (videoId !== currentVideoId) {
      const raf = requestAnimationFrame(() => {
        if (isAutoPlayEnabled) {
          // Autoplay ON → play unmuted (browsers allow once user has interacted;
          // handleVideoPlayback internally falls back to muted if blocked).
          handleVideoPlayback(videoId, { forceUnmuted: true });
        } else {
          // Autoplay OFF → load the video but do not auto-play it.
          const video = videoRefs.current.get(videoId);
          if (video) {
            video.pause();
            setCurrentVideoId(videoId);
            setIsPlaying(false);
            setProgress(0);
          }
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeIndex, visibleVideos, currentVideoId, handleVideoPlayback, isAutoPlayEnabled]);

  // Toggle autoplay: when turned ON, immediately play the active video
  useEffect(() => {
    if (!isAutoPlayEnabled) return;
    if (!currentVideoId) return;
    const video = videoRefs.current.get(currentVideoId);
    if (!video) return;
    if (video.paused) {
      handleVideoPlayback(currentVideoId, { forceUnmuted: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlayEnabled]);

  // URL-driven video navigation
  useEffect(() => {
    if (!videoPages || visibleVideos.length === 0) return;
    const targetId = videoParam || highlightedReelFromState?.id;
    if (!targetId) return;
    const idx = visibleVideos.findIndex((v) => String(v.id) === String(targetId));
    if (idx === -1) return;
    setActiveIndex(idx);
  }, [videoPages, visibleVideos, videoParam, highlightedReelFromState]);

  // URL-driven autoplay / unmute (one-shot)
  useEffect(() => {
    if (!autoplayRequested && !unmuteRequested) return;
    if (!currentVideoId) return;
    if (didInitialAutoplayRef.current) return;

    const video = videoRefs.current.get(currentVideoId);
    if (!video) return;
    didInitialAutoplayRef.current = true;

    // A navigated URL is a user gesture → treat page as interacted
    userHasInteractedRef.current = true;

    if (unmuteRequested || autoplayRequested) {
      video.muted = false;
      video.volume = volume;
      setIsMuted(false);
    }
    video.play().catch(() => {});
  }, [currentVideoId, autoplayRequested, unmuteRequested, volume]);

  // User
  useEffect(() => {
    const fetchFullUser = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('users')
          .select('id, username, avatar_url, email')
          .eq('id', user.id)
          .single();
        setFullUser(data || null);
      } else {
        setFullUser(null);
      }
    };
    fetchFullUser();
  }, [user]);

  const fetchUserInteractions = async () => {
    if (!user) return;
    try {
      const [likesData, viewsData] = await Promise.all([
        supabase.from('studio_video_likes').select('video_id').eq('user_id', user.id),
        supabase.from('studio_video_views').select('video_id').eq('user_id', user.id),
      ]);
      if (likesData.data) setUserLikes(new Set(likesData.data.map((l) => l.video_id)));
      if (viewsData.data) setUserViews(new Set(viewsData.data.map((v) => v.video_id)));
    } catch (error) {
      console.error('Error fetching interactions:', error);
    }
  };

  useEffect(() => {
    fetchUserInteractions();
  }, [user]);

  // Sidebar data
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from('studio_videos')
          .select('*')
          .gt('created_at', since)
          .limit(50);

        const enriched = await Promise.all(
          (recent || []).map(async (v: any) => {
            const [likesCount, commentsCount, sharesCount] = await Promise.all([
              supabase.from('studio_video_likes').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
              supabase.from('studio_video_comments').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
              supabase.from('studio_video_shares').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
            ]);
            const viewsCount = v.views || 0;
            const likesCountValue = likesCount.count || 0;
            const commentsCountValue = commentsCount.count || 0;
            const sharesCountValue = sharesCount.count || 0;
            const ageHours = v.created_at
              ? Math.max(1, (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60))
              : 24;
            const recencyBoost = Math.max(0, 72 - ageHours) * 18;
            const trendScore =
              viewsCount * 1.2 +
              likesCountValue * 6 +
              commentsCountValue * 15 +
              sharesCountValue * 22 +
              recencyBoost;

            let creator_avatar = '';
            let creator_name = '';
            if (v.user_id) {
              const { data: userData } = await supabase
                .from('users')
                .select('username, avatar_url')
                .eq('id', v.user_id)
                .maybeSingle();
              creator_avatar = userData?.avatar_url || '';
              creator_name = userData?.username || '';
            }
            return {
              ...v,
              likes_count: likesCountValue,
              comments_count: commentsCountValue,
              shares_count: sharesCountValue,
              engagementScore: trendScore,
              creator_avatar,
              creator_name,
            };
          })
        );

        enriched.sort((a, b) => b.engagementScore - a.engagementScore);
        setTrendingReels(enriched.slice(0, 5));

        const { data: most } = await supabase
          .from('studio_videos')
          .select('*')
          .order('views', { ascending: false })
          .limit(12);

        const mostEnriched = await Promise.all(
          (most || []).map(async (v: any) => {
            let creator_avatar = '';
            if (v.user_id) {
              const { data: userData } = await supabase
                .from('users')
                .select('username, avatar_url')
                .eq('id', v.user_id)
                .maybeSingle();
              creator_avatar = userData?.avatar_url || '';
            }
            return { ...v, creator_avatar };
          })
        );
        setMostViewed(mostEnriched || []);

        const { data: creators } = await supabase.from('studio_channels').select('*').limit(50);
        const creatorsEnriched = await Promise.all(
          (creators || []).map(async (c: any) => {
            const [subs, vids] = await Promise.all([
              supabase.from('studio_channel_subscribers').select('*', { count: 'exact', head: true }).eq('channel_id', c.id),
              supabase.from('studio_videos').select('views, id').eq('channel_id', c.id),
            ]);
            const totalViews = (vids.data || []).reduce((s: number, x: any) => s + (x.views || 0), 0);
            const videosCount = (vids.data || []).length;
            let owner_avatar = '';
            let owner_username = '';
            if (c.user_id) {
              const { data: u } = await supabase
                .from('users')
                .select('username, avatar_url')
                .eq('id', c.user_id)
                .maybeSingle();
              owner_avatar = u?.avatar_url || '';
              owner_username = u?.username || '';
            }
            return {
              ...c,
              subscriber_count: subs.count || 0,
              total_views: totalViews,
              videos_count: videosCount,
              owner_avatar,
              owner_username,
            };
          })
        );
        const activeCreators = creatorsEnriched.filter(
          (c: any) =>
            (c.videos_count || 0) > 0 ||
            (c.subscriber_count || 0) > 0 ||
            (c.total_views || 0) > 0
        );
        activeCreators.sort(
          (a: any, b: any) => (b.subscriber_count || 0) - (a.subscriber_count || 0)
        );
        setTopCreators(activeCreators.slice(0, 5));
      } catch (err) {
        console.error('[Studio] Sidebar data error:', err);
      }
    };
    if (isWideDesktop) fetchSidebarData();
  }, [isWideDesktop]);

  // Subscriptions
  useEffect(() => {
    const fetchSubscriptionsAndCounts = async () => {
      if (!user) return;
      const [subsData, ...counts] = await Promise.all([
        supabase.from('studio_channel_subscribers').select('channel_id').eq('user_id', user.id),
        ...videos.map((v) =>
          supabase
            .from('studio_channel_subscribers')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', v.channel_id)
        ),
      ]);
      setUserSubscriptions(new Set((subsData.data || []).map((s) => s.channel_id)));
      const newCounts: Record<string, number> = {};
      videos.forEach((v, index) => {
        newCounts[v.channel_id] = counts[index]?.count || 0;
      });
      setSubscriberCounts(newCounts);
    };
    if (user && videos.length > 0) fetchSubscriptionsAndCounts();
  }, [user, videos]);

  const totalChannelViews = useMemo(() => {
    return videos
      .filter((v) => v.channel_id === channel?.id)
      .reduce((sum, v) => sum + (v.views || 0), 0);
  }, [videos, channel]);

  const canPersonalize = useMemo(() => {
    return (
      channel &&
      user &&
      channel.user_id === user.id &&
      totalChannelViews >= 1000 &&
      (subscriberCounts[channel.id] ?? 0) >= 200
    );
  }, [channel, user, totalChannelViews, subscriberCounts]);

  const handleLike = useCallback(
    async (videoId: string) => {
      if (!user) return;
      const isCurrentlyLiked = userLikes.has(videoId);
      const newUserLikes = new Set(userLikes);
      isCurrentlyLiked ? newUserLikes.delete(videoId) : newUserLikes.add(videoId);
      setUserLikes(newUserLikes);
      try {
        if (isCurrentlyLiked) {
          await supabase.from('studio_video_likes').delete().eq('user_id', user.id).eq('video_id', videoId);
          await supabase.rpc('decrement_video_likes', { video_id: videoId });
        } else {
          await supabase.from('studio_video_likes').insert({ user_id: user.id, video_id: videoId });
          await supabase.rpc('increment_video_likes', { video_id: videoId });
        }
        refetch();
      } catch (error) {
        console.error('Error handling like:', error);
        setUserLikes(userLikes);
        toast({ description: 'Failed to update like', variant: 'destructive' });
      }
    },
    [user, userLikes, refetch, toast]
  );

  const handleFollow = useCallback(
    async (channelId: string) => {
      if (!user || !channelId) {
        toast({ description: 'Sign in to subscribe to a channel.' });
        throw new Error('A signed-in user and channel are required.');
      }
      const wasFollowing = userSubscriptions.has(channelId);
      const nextSubscriptions = new Set(userSubscriptions);
      if (wasFollowing) nextSubscriptions.delete(channelId);
      else nextSubscriptions.add(channelId);
      setUserSubscriptions(nextSubscriptions);
      try {
        const result = wasFollowing
          ? await supabase.from('studio_channel_subscribers').delete().eq('channel_id', channelId).eq('user_id', user.id)
          : await supabase.from('studio_channel_subscribers').insert({ channel_id: channelId, user_id: user.id });
        if (result.error) throw result.error;
        toast({ description: wasFollowing ? 'Unsubscribed from channel.' : 'Subscribed to channel.' });
      } catch (error) {
        setUserSubscriptions(userSubscriptions);
        toast({ description: 'Could not update your subscription. Please try again.', variant: 'destructive' });
        throw error;
      }
    },
    [user, userSubscriptions, toast]
  );

  const handleTrendingReelClick = useCallback(
    (reel: any) => {
      if (!reel) return;
      const exactIndex = visibleVideos.findIndex((video) => String(video.id) === String(reel.id));
      if (exactIndex >= 0) {
        setActiveIndex(exactIndex);
        return;
      }
      const channelIndex = visibleVideos.findIndex((video) => String(video.channel_id) === String(reel.channel_id));
      if (channelIndex >= 0) {
        setActiveIndex(channelIndex);
      }
    },
    [visibleVideos]
  );

  const handleCreatorCardClick = useCallback(
    (creator: any) => {
      if (!creator?.id) return;
      const channelIndex = visibleVideos.findIndex((video) => String(video.channel_id) === String(creator.id));
      if (channelIndex >= 0) {
        setActiveIndex(channelIndex);
        return;
      }
      toast({ description: 'That channel is not in the current Studio feed.' });
    },
    [toast, visibleVideos]
  );

  const handleView = useCallback(
    async (videoId: string) => {
      if (!user || userViews.has(videoId)) return;
      try {
        const { data: existingView } = await supabase
          .from('studio_video_views')
          .select('id')
          .eq('user_id', user.id)
          .eq('video_id', videoId)
          .maybeSingle();
        if (existingView) {
          setUserViews((prev) => new Set(prev).add(videoId));
          return;
        }
        await supabase.from('studio_video_views').insert({ user_id: user.id, video_id: videoId });
        await supabase.rpc('increment_video_views', { video_id: videoId });
        setUserViews((prev) => new Set(prev).add(videoId));
      } catch (error) {
        console.error('Error handling view:', error);
      }
    },
    [user, userViews]
  );

  const handleShare = useCallback(
    (videoId: string) => {
      try {
        const url = `${window.location.origin}/studio/video/${videoId}`;
        navigator.clipboard.writeText(url).then(() => {
          toast({ title: 'Copied!', description: 'Video URL copied to clipboard.' });
        });
      } catch (e) {
        console.error('Error copying share URL:', e);
        toast({ description: 'Failed to copy link', variant: 'destructive' });
      }
    },
    [toast]
  );

  const handleToggleMonetization = useCallback(
    async (type: 'donation' | 'subscription', enabled: boolean) => {
      if (!channel) return;
      try {
        await supabase
          .from('studio_channels')
          .update({ [`${type}_enabled`]: enabled })
          .eq('id', channel.id);
        await refetchChannel();
        toast({ description: `Monetization ${enabled ? 'enabled' : 'disabled'} for ${type}.` });
      } catch (error) {
        console.error('Error updating monetization:', error);
        toast({ description: 'Failed to update monetization', variant: 'destructive' });
      }
    },
    [channel, refetchChannel, toast]
  );

  const handleCreateChannel = useCallback(async () => {
    if (!user) return;
    const { data: existingChannel } = await supabase
      .from('studio_channels')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (existingChannel) {
      toast({ description: 'You can only have one channel per account.' });
      return;
    }
    let name = '';
    let nameAvailable = false;
    while (!nameAvailable) {
      name = prompt('Enter your channel name:')?.trim() || '';
      if (!name) {
        toast({ description: 'Channel name is required.' });
        return;
      }
      const { data: nameExists } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('name', name)
        .single();
      if (nameExists) toast({ description: 'Channel name is already taken. Please choose another.' });
      else nameAvailable = true;
    }
    const description = prompt('Enter a description for your channel:') || '';
    const { error } = await supabase.from('studio_channels').insert({
      user_id: user.id,
      name,
      description,
    });
    if (!error) window.location.reload();
    else toast({ description: 'Failed to create channel', variant: 'destructive' });
  }, [user, toast]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      videoRefs.current.forEach((video) => {
        video.pause();
        video.src = '';
        video.load();
      });
      videoRefs.current.clear();
    };
  }, []);

  if (videosLoading && videos.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <StudioSkeleton />
      </div>
    );
  }

  // -------- Desktop Reel Slide --------
  const renderDesktopReelSlide = (video: any, index: number) => {
    const isActive = index === activeIndex;
    const videoLabel = video.title || video.caption || video.description;

    return (
      <div
        key={video.id}
        ref={(el) => {
          if (el) slideRefs.current.set(index, el);
          else slideRefs.current.delete(index);
        }}
        className="flex w-full shrink-0 items-center justify-center"
        style={{ height: '100%', scrollSnapAlign: 'start' }}
        data-index={index}
      >
        <div
          className="relative aspect-[9/16] max-h-full max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          style={{ height: 'min(72dvh, 720px)', maxHeight: 'calc(100dvh - 168px)' }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className="relative w-full h-full">
            {isActive ? (
              <video
                key={video.id}
                ref={(el) => {
                  if (el) {
                    videoRefs.current.set(String(video.id), el);
                    el.preload = 'auto';
                  } else {
                    videoRefs.current.delete(String(video.id));
                  }
                }}
                src={video.video_url}
                poster={video.thumbnail_url || video.poster_url || undefined}
                className="w-full h-full object-contain"
                playsInline
                loop={false}
                // NOTE: no `muted` prop — imperative control only
                onPlay={() => {
                  setPlaybackError(false);
                  setCurrentVideoId(String(video.id));
                }}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onPause={() => {
                  setIsBuffering(false);
                  setIsPlaying(false);
                }}
                onError={() => {
                  setIsBuffering(false);
                  setPlaybackError(true);
                  setIsPlaying(false);
                  if (isAutoPlayEnabled && index < visibleVideos.length - 1) {
                    goToNextVideo();
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-black">
                {video.thumbnail_url || video.poster_url ? (
                  <img
                    src={video.thumbnail_url || video.poster_url}
                    alt=""
                    className="w-full h-full object-contain opacity-60"
                    draggable={false}
                  />
                ) : null}
              </div>
            )}

            {isActive && isBuffering && !playbackError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20" aria-label="Loading video">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            )}

            {isActive && playbackError && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
                <p className="text-sm">Playback did not start. Check the video source or try again.</p>
                <button
                  type="button"
                  className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
                  onClick={() => {
                    const player = videoRefs.current.get(String(video.id));
                    if (!player) return;
                    setPlaybackError(false);
                    setIsBuffering(true);
                    player.load();
                    player.play().catch(() => {
                      setIsBuffering(false);
                      setPlaybackError(true);
                    });
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {isActive && isDesktop && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousVideo}
                  aria-label="Previous video"
                  className={cn(
                    'absolute left-4 top-1/2 -translate-y-1/2 z-20',
                    'w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm',
                    'flex items-center justify-center text-white',
                    'opacity-0 transition-all duration-300',
                    'hover:bg-black/70 hover:scale-110',
                    isHovering && 'opacity-100'
                  )}
                >
                  <ChevronUp className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={goToNextVideo}
                  aria-label="Next video"
                  className={cn(
                    'absolute right-4 top-1/2 -translate-y-1/2 z-20',
                    'w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm',
                    'flex items-center justify-center text-white',
                    'opacity-0 transition-all duration-300',
                    'hover:bg-black/70 hover:scale-110',
                    isHovering && 'opacity-100'
                  )}
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none">
              <div className="flex items-end justify-between gap-4 text-white">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold">
                      {video.creator?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{video.creator?.name || 'Unknown'}</div>
                      {video.channel_name && (
                        <div className="truncate text-sm text-gray-300">{video.channel_name}</div>
                      )}
                    </div>
                  </div>
                  {videoLabel && (
                    <div className="mt-2 line-clamp-2 max-w-[32ch] text-sm font-medium text-white">
                      {videoLabel}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-sm text-gray-300">{video.views || 0} views</span>
              </div>
            </div>

            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-2" onClick={handleProgressClick}>
                <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer group">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-100 group-hover:h-1.5"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {isActive && (
              <div
                className={cn(
                  'absolute inset-0 z-20 flex items-center justify-center',
                  'transition-opacity duration-300',
                  isHovering ? 'opacity-100' : 'opacity-0',
                  'bg-black/20 pointer-events-none'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center hover:bg-white/20 transition-all duration-300 hover:scale-110 pointer-events-auto"
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white ml-1" />
                  )}
                </button>
              </div>
            )}

            {isActive && (
              <div
                className={cn(
                  'absolute bottom-16 left-0 right-0 z-20 px-6',
                  'transition-opacity duration-300',
                  isHovering ? 'opacity-100' : 'opacity-0'
                )}
              >
                <div className="flex items-center gap-4 bg-black/50 backdrop-blur-lg rounded-full px-4 py-2 w-full">
                  <button onClick={togglePlay} className="text-white hover:text-purple-400 transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={toggleMute} className="text-white hover:text-purple-400 transition-colors">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <button onClick={toggleFullscreen} className="text-white hover:text-purple-400 transition-colors">
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] min-h-0 overflow-hidden bg-gray-50 text-gray-900 dark:bg-gradient-to-b dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 dark:text-white">
      <div className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-xl dark:border-white/5 dark:bg-black/80">
        <StudioHeader
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navigate={navigate}
          onSearch={handleStudioSearch}
          showCreateChannel={!channel && !channelLoading}
          onCreateChannel={() => setShowChannelPrompt(true)}
        />
      </div>

      <div
        className={cn(
          'flex w-full mx-auto items-stretch',
          isDesktop ? 'max-w-[1600px] h-full min-h-0' : 'h-screen',
          'relative min-h-0'
        )}
        style={{ paddingTop: isDesktop ? '72px' : '88px', paddingBottom: isMobile ? '64px' : '0' }}
      >
        {isWideDesktop && (
          <div
            className="hidden lg:flex flex-col fixed left-0 top-[72px] h-[calc(100vh-72px)] w-[300px] p-3 overflow-y-auto space-y-3 bg-transparent border-r border-gray-200 dark:border-white/5 custom-scrollbar"
            style={{ zIndex: 10 }}
          >
            <LeftTrending
              trendingReels={trendingReels}
              getPublicUrl={getPublicUrl}
              onReelClick={handleTrendingReelClick}
            />
            <LeftTopCreators
              topCreators={topCreators}
              currentUserId={user?.id}
              followingChannelIds={userSubscriptions}
              onCreatorClick={handleCreatorCardClick}
              onFollowClick={handleFollow}
            />
          </div>
        )}

        <div
          ref={containerRef}
          onTouchStart={handleUserInteraction}
          onClick={handleUserInteraction}
          className={cn(
            'flex-1 mx-auto h-full',
            isDesktop ? 'flex min-h-0 flex-col justify-center items-center px-4 py-2' : 'w-full h-full bg-gray-50 dark:bg-black'
          )}
          style={
            isWideDesktop
              ? { paddingLeft: '340px', paddingRight: '340px', maxWidth: '100%' }
              : { overflow: 'hidden', position: 'relative' }
          }
        >
            {videosFailed ? (
            <div className="mx-auto max-w-md px-6 py-12 text-center text-gray-900 dark:text-white" role="alert">
              <p className="mb-4">Studio videos could not be loaded.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-700"
              >
                Retry
              </button>
              {videosError instanceof Error && (
                <p className="mt-3 text-xs text-gray-600 dark:text-white/60">{videosError.message}</p>
              )}
            </div>
          ) : visibleVideos.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="text-gray-700 dark:text-gray-300">
                {studioSearch.query
                  ? 'No reels match your search.'
                  : 'No Studio videos are available yet. Check back soon.'}
              </div>
            </div>
          ) : isDesktop ? (
            <div className="flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center mx-auto overflow-hidden">
              <div
                ref={reelStripRef}
                className="relative w-full h-full overflow-y-scroll no-scrollbar"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  overscrollBehavior: 'contain',
                }}
              >
                {visibleVideos.map((video, index) => renderDesktopReelSlide(video, index))}

                {hasNextPage && (
                  <div
                    className="flex w-full items-center justify-center py-6"
                    style={{ height: '100%', scrollSnapAlign: 'start' }}
                  >
                    <Button
                      onClick={() => fetchNextPage()}
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30"
                    >
                      {isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full relative bg-black">
              <MobileReelScroller
                videos={visibleVideos}
                userLikes={userLikes}
                userSubscriptions={userSubscriptions}
                handleLike={handleLike}
                handleView={handleView}
                handleShare={handleShare}
                handleFollow={handleFollow}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                hideLive={true}
                userData={fullUser}
                hasUserInteracted={hasUserInteracted}
                activeIndex={activeIndex}
                setActiveIndex={handleIndexChange}
                onUserInteraction={handleUserInteraction}
              />
            </div>
          )}
        </div>

        {isWideDesktop && user && channel && (
          <div
            className="hidden lg:flex flex-col fixed right-0 top-[72px] h-[calc(100vh-72px)] w-[320px] p-4 overflow-y-auto space-y-4 border-l border-gray-200 bg-white/70 backdrop-blur-sm dark:border-white/5 dark:bg-black/30 custom-scrollbar"
            style={{ zIndex: 10 }}
          >
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              <RightYourStudio
                channel={channel}
                totalChannelViews={totalChannelViews}
                subscriberCounts={subscriberCounts}
                canPersonalize={canPersonalize}
                navigate={navigate}
                handleCreateChannel={handleCreateChannel}
              />
              <RightInviteFriends channel={channel} />
              <MonetizationCard
                channel={channel}
                totalChannelViews={totalChannelViews}
                subscriberCounts={subscriberCounts}
                handleToggleMonetization={handleToggleMonetization}
              />
            </div>
          </div>
        )}
      </div>

      {isMobile && controlsVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <MobileBottomNav transparent forceVisible className="shadow-none border-transparent" />
        </div>
      )}
      {isMobile && !controlsVisible && (
        <button
          type="button"
          onClick={handleUserInteraction}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900/10 px-4 py-2 text-sm text-gray-800 backdrop-blur-sm shadow-lg ring-1 ring-gray-300/70 hover:bg-gray-900/20 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/20"
        >
          Show controls
        </button>
      )}
      <Dialog open={showChannelPrompt} onOpenChange={setShowChannelPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create your Studio channel</DialogTitle>
            <DialogDescription>
              Set up a channel to publish videos and build your audience. You can keep watching Studio either way.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChannelPrompt(false)}>Not now</Button>
            <Button
              className="bg-purple-700 text-white hover:bg-purple-800"
              onClick={() => {
                setShowChannelPrompt(false);
                if (user) void handleCreateChannel();
                else navigate('/auth');
              }}
            >
              {user ? 'Create my channel' : 'Sign in to create a channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Studio;