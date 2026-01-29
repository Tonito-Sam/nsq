import { useSearchParams, useLocation } from 'react-router-dom';
import MonetizationCard from '../components/studio/MonetizationCard';
import LeftTrending from '@/components/studio/LeftTrending';
import LeftTopCreators from '@/components/studio/LeftTopCreators';
import LeftMostViewed from '@/components/studio/LeftMostViewed';
import RightYourStudio from '@/components/studio/RightYourStudio';
import RightInviteFriends from '@/components/studio/RightInviteFriends';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MobileReelScroller } from '../components/studio/MobileReelScroller';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReelCard } from '../components/studio/ReelCard';
import StudioHeader from '../components/studio/StudioHeader'; // correct path to StudioHeader
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { UserCheck, Eye, Grid3x3, Cpu, Smile, GraduationCap, Lightbulb, Music, Gamepad2, Utensils, Dumbbell, Camera, Palette, Trophy, MessageCircle, Heart, Share2 } from 'lucide-react';
// Type-only import for ffmpeg
// @ts-ignore
import type { FFmpegModule } from '../types/ffmpeg';
import { useToast } from '@/hooks/use-toast';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';

// Categories with icons
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

import useMeta from '@/hooks/useMeta';
import StudioSkeleton from '@/components/ui/skeleton';

const Studio = () => {
  useMeta({
    title: 'Studio — Live & On-Demand Shows — NexSq',
    description: 'Join live studio shows, watch on-demand content, and interact with creators on NexSq Studio.',
    url: window.location.href,
  });
  
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number>(0);
  const [isLandscapeBlocked, setIsLandscapeBlocked] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'all' | 'trending'>('all'); // Add active tab state
  
  const { user } = useAuth();
  const [fullUser, setFullUser] = useState<any>(null);

  useEffect(() => {
    const fetchFullUser = async () => {
      if (user && user.id) {
        const { data } = await supabase
          .from('users')
          .select('id, username, avatar_url, email')
          .eq('id', user.id)
          .single();
        if (data) setFullUser(data);
        else setFullUser(null);
      } else {
        setFullUser(null);
      }
    };
    fetchFullUser();
  }, [user]);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const location = useLocation();
  const highlightedReelFromState: any = (location && (location as any).state && (location as any).state.highlightedReel) || null;
  
  const videoParam = searchParams.get('video') || highlightId;
  const autoplayRequested = (searchParams.get('autoplay') === 'true') || ((location as any)?.state?.autoplay === true) || false;
  const unmuteRequested = (searchParams.get('unmute') === 'true') || ((location as any)?.state?.unmute === true) || false;
  
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userViews, setUserViews] = useState<Set<string>>(new Set());
  const [trendingReels, setTrendingReels] = useState<any[]>([]);
  const [topCreators, setTopCreators] = useState<any[]>([]);
  const [mostViewed, setMostViewed] = useState<any[]>([]);

  // Subscription state
  const [userSubscriptions, setUserSubscriptions] = useState<Set<string>>(new Set());
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  // Video loading and playback state with aggressive prefetching
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [prefetchedPages, setPrefetchedPages] = useState<number[]>([]);
  const [prefetching, setPrefetching] = useState<boolean>(false);
  const [videoPreloaded, setVideoPreloaded] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloadQueueRef = useRef<string[]>([]);
  const isPreloadingRef = useRef<boolean>(false);

  // Infinite video loading with React Query (v4+ object syntax)
  const INITIAL_BATCH_SIZE = 15;
  const PREFETCH_BATCH_SIZE = 25;
  const PREFETCH_THRESHOLD = 5;
  const MAX_PREFETCH_PAGES = 3;

  const getPublicUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://pfemdshixllwqqajsxxp.supabase.co/storage/v1/object/public/studio-videos/${path}`;
  };

  // Preload video function with queue management
  const preloadVideo = useCallback((url: string) => {
    if (!url || videoPreloaded.has(url)) return;
    
    preloadQueueRef.current.push(url);
    
    if (!isPreloadingRef.current) {
      processPreloadQueue();
    }
  }, [videoPreloaded]);

  // Process preload queue
  const processPreloadQueue = useCallback(() => {
    if (isPreloadingRef.current || preloadQueueRef.current.length === 0) return;
    
    isPreloadingRef.current = true;
    const url = preloadQueueRef.current.shift();
    
    if (!url) {
      isPreloadingRef.current = false;
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.onloadedmetadata = () => {
      setVideoPreloaded(prev => new Set(prev).add(url));
      setTimeout(() => {
        isPreloadingRef.current = false;
        if (preloadQueueRef.current.length > 0) {
          processPreloadQueue();
        }
      }, 100);
    };
    video.onerror = () => {
      isPreloadingRef.current = false;
      if (preloadQueueRef.current.length > 0) {
        processPreloadQueue();
      }
    };
  }, []);

  // Optimized video fetching with background enrichment
  const fetchVideos = useCallback(async ({ pageParam = 0 }: { pageParam?: number }) => {
    console.log('[Studio] fetchVideos pageParam:', pageParam);
    let query = supabase
      .from('studio_videos')
      .select('*');
    
    // Add trending filter if activeTab is 'trending'
    if (activeTab === 'trending') {
      // Order by engagement metrics for trending
      query = query.order('views', { ascending: false })
                  .order('likes', { ascending: false })
                  .order('created_at', { ascending: false });
    } else {
      // Default ordering for 'all'
      query = query.order('created_at', { ascending: false });
    }
    
    // Add pagination
    query = query.range(pageParam * INITIAL_BATCH_SIZE, (pageParam + 1) * INITIAL_BATCH_SIZE - 1);
    
    // Add category filter
    if (selectedCategory && selectedCategory !== 'All') {
      query = query.contains('categories', [selectedCategory]);
    }

    const { data: allVideos } = await query;
    console.log('[Studio] fetched videos:', allVideos?.map(v => v.id));
    
    const videosArr = allVideos || [];
    const ownerIds = Array.from(new Set(videosArr.flatMap((v: any) => [v.user_id, (v as any).creator_id]).filter(Boolean)));
    const channelIds = Array.from(new Set(videosArr.map((v: any) => v.channel_id).filter(Boolean)));
    let usersById: Record<string, any> = {};
    let channelsById: Record<string, any> = {};
    
    try {
      const [usersResp, channelsResp] = await Promise.all([
        ownerIds.length ? supabase.from('users').select('id, username, avatar_url').in('id', ownerIds) : Promise.resolve({ data: [] }),
        channelIds.length ? supabase.from('studio_channels').select('id, name, user_id').in('id', channelIds) : Promise.resolve({ data: [] }),
      ] as any);
      
      (usersResp.data || []).forEach((u: any) => { usersById[u.id] = u; });
      (channelsResp.data || []).forEach((c: any) => { channelsById[c.id] = c; });
    } catch (e) {
      console.warn('[Studio] synchronous enrichment failed', e);
    }
    
    const basicVideos = videosArr.map((v: any) => {
      const owner = usersById[v.user_id] || usersById[(v as any).creator_id] || null;
      const channel_name = channelsById[v.channel_id] ? channelsById[v.channel_id].name : '';
      return {
        ...v,
        video_url: getPublicUrl(v.video_url || v.url || v.src || ''),
        channel_name,
        channel_id: v.channel_id,
        user_id: v.user_id,
        creator: owner ? { name: owner.username || owner.name || 'Unknown', avatar_url: owner.avatar_url || '' } : { name: '', avatar_url: '' },
        subscriber_count: 0,
        likes_count: v.likes || 0,
        comments_count: v.comments || 0,
        shares_count: v.shares || 0,
      };
    });

    // Start background enrichment
    enrichVideosInBackground(basicVideos, pageParam);

    // Preload first 3 videos immediately
    if (pageParam === 0) {
      basicVideos.slice(0, 3).forEach(video => {
        preloadVideo(video.video_url);
      });
    }

    // Apply reordering for highlight
    let processedVideos = [...basicVideos];
    
    if (highlightId && pageParam === 0) {
      const idx = processedVideos.findIndex(v => String(v.id) === String(highlightId));
      if (idx > -1) {
        const [highlighted] = processedVideos.splice(idx, 1);
        processedVideos.unshift(highlighted);
      }
    }

    if (highlightedReelFromState && pageParam === 0) {
      const exists = processedVideos.some(v => String(v.id) === String(highlightedReelFromState.id));
      if (!exists) {
        const hr = highlightedReelFromState;
        const processed = {
          ...hr,
          video_url: getPublicUrl(hr.video_url || hr.url || hr.src || ''),
          channel_name: '',
          creator: { name: '', avatar_url: '' },
          likes_count: hr.likes || 0,
          comments_count: hr.comments || 0,
          shares_count: hr.shares || 0,
        };
        processedVideos.unshift(processed);
      }
    }

    return { 
      videos: processedVideos, 
      nextPage: (allVideos && allVideos.length === INITIAL_BATCH_SIZE) ? pageParam + 1 : undefined,
      page: pageParam
    };
  }, [selectedCategory, activeTab, highlightId, highlightedReelFromState, getPublicUrl, preloadVideo]);

  // Background enrichment function
  const enrichVideosInBackground = useCallback(async (videos: any[], page: number) => {
    if (!videos.length) return;

    try {
      const userIds = Array.from(new Set(videos.flatMap(v => [v.user_id, (v as any).creator_id]).filter(Boolean)));
      const channelIds = Array.from(new Set(videos.map(v => v.channel_id).filter(Boolean)));

      const [usersResp, channelsResp] = await Promise.all([
        userIds.length ? supabase.from('users').select('id, username, avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
        channelIds.length ? supabase.from('studio_channels').select('id, name').in('id', channelIds) : Promise.resolve({ data: [] }),
      ] as any);

      const usersById: Record<string, any> = {};
      (usersResp.data || []).forEach((u: any) => { usersById[u.id] = u; });
      
      const missingIds = userIds.filter(id => id && !usersById[id]);
      if (missingIds.length > 0) {
        try {
          const { data: extra } = await supabase.from('users').select('id, username, avatar_url').in('id', missingIds as any);
          (extra || []).forEach((u: any) => { usersById[u.id] = u; });
        } catch (e) {
          console.warn('[Studio] failed to fetch extra users', e);
        }
      }

      const channelsById: Record<string, any> = {};
      (channelsResp.data || []).forEach((c: any) => { channelsById[c.id] = c; });

      const enrichedVideos = videos.map(v => {
        const creator = usersById[v.user_id] ? { name: usersById[v.user_id].username, avatar_url: usersById[v.user_id].avatar_url } : { name: '', avatar_url: '' };
        const channel_name = channelsById[v.channel_id] ? channelsById[v.channel_id].name : '';

        return {
          ...v,
          channel_name,
          creator,
        };
      });

      // Preload remaining videos in background
      enrichedVideos.slice(3).forEach(video => {
        preloadVideo(video.video_url);
      });

    } catch (error) {
      console.error('[Studio] Background enrichment error:', error);
    }
  }, [preloadVideo]);

  // Prefetch next pages aggressively
  const prefetchNextPage = useCallback(async (pageNumber: number) => {
    if (prefetchedPages.includes(pageNumber) || prefetching) return;
    
    setPrefetching(true);
    try {
      console.log(`[Studio] Prefetching page ${pageNumber}`);
      let query = supabase
        .from('studio_videos')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageNumber * PREFETCH_BATCH_SIZE, (pageNumber + 1) * PREFETCH_BATCH_SIZE - 1);
      
      if (selectedCategory && selectedCategory !== 'All') {
        query = query.contains('categories', [selectedCategory]);
      }

      const { data: prefetchVideos } = await query;
      
      if (prefetchVideos && prefetchVideos.length > 0) {
        const preloadPromises = prefetchVideos.slice(0, 5).map(video => 
          new Promise<void>(resolve => {
            const url = getPublicUrl(video.video_url || video.url || video.src || '');
            preloadVideo(url);
            resolve();
          })
        );
        
        await Promise.all(preloadPromises);
        
        setPrefetchedPages(prev => [...prev, pageNumber]);
        console.log(`[Studio] Page ${pageNumber} prefetched successfully`);
      }
    } catch (error) {
      console.error(`[Studio] Error prefetching page ${pageNumber}:`, error);
    } finally {
      setPrefetching(false);
    }
  }, [prefetchedPages, prefetching, selectedCategory, getPublicUrl, preloadVideo]);

  const {
    data: videoPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isLoading: videosLoading,
  } = useInfiniteQuery({
    queryKey: ['studio-videos', selectedCategory, highlightId, activeTab], // Added activeTab to query key
    queryFn: fetchVideos,
    initialPageParam: 0,
    getNextPageParam: (lastPage: { nextPage?: number }) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const videos: any[] = videoPages?.pages.flatMap((page: any) => page.videos) || [];

  // Monitor active index and trigger prefetching
  useEffect(() => {
    if (videos.length === 0 || !hasNextPage || isFetchingNextPage) return;

    const currentPage = Math.floor(activeIndex / INITIAL_BATCH_SIZE);
    const remainingInCurrentPage = (currentPage + 1) * INITIAL_BATCH_SIZE - (activeIndex + 1);
    
    if (remainingInCurrentPage <= PREFETCH_THRESHOLD) {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }

      prefetchTimeoutRef.current = setTimeout(() => {
        const nextPage = currentPage + 1;
        
        for (let i = 0; i < MAX_PREFETCH_PAGES; i++) {
          const pageToPrefetch = nextPage + i;
          if (!prefetchedPages.includes(pageToPrefetch)) {
            prefetchNextPage(pageToPrefetch);
            break;
          }
        }
      }, 200);
    }

    const totalRemaining = videos.length - (activeIndex + 1);
    if (totalRemaining <= 3) {
      fetchNextPage();
    }

    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, [activeIndex, videos.length, hasNextPage, isFetchingNextPage, fetchNextPage, prefetchNextPage, prefetchedPages]);

  // If navigation requested a specific video (query or state), jump to it
  useEffect(() => {
    if (!videoPages || videos.length === 0) return;

    const targetId = videoParam || (highlightedReelFromState && highlightedReelFromState.id);
    if (!targetId) return;

    const idx = videos.findIndex(v => String(v.id) === String(targetId));
    if (idx === -1) return;

    setActiveIndex(idx);

    if (autoplayRequested) {
      setTimeout(async () => {
        const vidEl = videoRefs.current.get(String(videos[idx].id));
        if (!vidEl) return;
        try {
          if (unmuteRequested) {
            vidEl.muted = false;
          }
          await vidEl.play();
        } catch (e) {
          try {
            vidEl.muted = true;
            await vidEl.play();
          } catch (e2) {
            console.warn('[Studio] autoplay failed for target video', e2);
          }
        }
      }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPages, videos.length, videoParam, highlightedReelFromState]);

  // IntersectionObserver: make a card active only when it's fully visible on desktop
  useEffect(() => {
    if (!isDesktop) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;
        const id = el.getAttribute('data-video-id');
        if (!id) return;
        const idx = videos.findIndex(v => String(v.id) === String(id));
        if (idx === -1) return;
        if (entry.intersectionRatio >= 0.999) {
          setActiveIndex(idx);
        }
      });
    }, { threshold: thresholds });

    cardElementsRef.current.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [isDesktop, videos]);

  // Handle video playback on desktop
  useEffect(() => {
    if (!isDesktop || videos.length === 0) return;

    const activeId = String(videos[activeIndex]?.id || '');

    Array.from(videoRefs.current.entries()).forEach(([id, vid]) => {
      if (!vid) return;
      if (String(id) !== activeId) {
        try {
          vid.pause();
        } catch (e) {
          console.warn('[Studio] failed to pause video', id, e);
        }
      }
    });

    const activeVideo = videoRefs.current.get(activeId);
    if (activeVideo) {
      const playVideo = async () => {
        try {
          await activeVideo.play();
        } catch (error) {
          console.log('Autoplay prevented, waiting for user interaction');
        }
      };

      const timeoutId = setTimeout(playVideo, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [activeIndex, videos, isDesktop]);

  // Preload adjacent videos
  useEffect(() => {
    if (videos.length === 0) return;

    const nextIndexes = [activeIndex + 1, activeIndex + 2, activeIndex + 3]
      .filter(idx => idx < videos.length && idx >= 0);
    
    nextIndexes.forEach(idx => {
      const video = videos[idx];
      if (video && !videoPreloaded.has(video.video_url)) {
        preloadVideo(video.video_url);
      }
    });
  }, [activeIndex, videos, videoPreloaded, preloadVideo]);

  // Prevent mobile pull-to-refresh
  useEffect(() => {
    if (isDesktop) return;
    const el = mobileScrollRef.current;
    if (!el) return;

    const onTouchStart = (ev: TouchEvent) => {
      touchStartYRef.current = ev.touches[0]?.clientY || 0;
    };

    const onTouchMove = (ev: TouchEvent) => {
      const currentY = ev.touches[0]?.clientY || 0;
      const delta = currentY - touchStartYRef.current;
      if (el.scrollTop <= 0 && delta > 0) {
        ev.preventDefault();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true } as any);
    el.addEventListener('touchmove', onTouchMove, { passive: false } as any);

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
    };
  }, [isDesktop]);

  // Try to lock orientation to portrait
  useEffect(() => {
    if (isDesktop) return;

    const tryLock = async () => {
      try {
        if ((screen as any)?.orientation?.lock) {
          await (screen as any).orientation.lock('portrait').catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    };
    tryLock();

    const updateLandscape = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscapeBlocked(isLandscape);
    };

    window.addEventListener('orientationchange', updateLandscape);
    window.addEventListener('resize', updateLandscape);
    updateLandscape();

    return () => {
      window.removeEventListener('orientationchange', updateLandscape);
      window.removeEventListener('resize', updateLandscape);
    };
  }, [isDesktop]);

  // Fetch channel with React Query
  const {
    data: channel,
    isLoading: channelLoading,
    refetch: refetchChannel
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

  // Calculate total views for the current channel from videos
  const totalChannelViews = videos
    .filter(v => v.channel_id === channel?.id)
    .reduce((sum, v) => sum + (v.views || 0), 0);

  // Only allow personalize if owner and total views >= 1000 and subscribers >= 200
  const canPersonalize = channel && user && channel.user_id === user.id && totalChannelViews >= 1000 && (subscriberCounts[channel.id] ?? 0) >= 200;

  // Fetch user's likes and views
  const fetchUserInteractions = async () => {
    if (!user) return;

    try {
      const { data: likesData } = await supabase
        .from('studio_video_likes')
        .select('video_id')
        .eq('user_id', user.id);

      if (likesData) {
        setUserLikes(new Set(likesData.map(like => like.video_id)));
      }

      const { data: viewsData } = await supabase
        .from('studio_video_views')
        .select('video_id')
        .eq('user_id', user.id);

      if (viewsData) {
        setUserViews(new Set(viewsData.map(view => view.video_id)));
      }
    } catch (error) {
      console.error('Error fetching user interactions:', error);
    }
  };

  useEffect(() => {
    fetchUserInteractions();
  }, [user]);

  // Fetch trending reels, top creators, most viewed
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        // Trending Reels
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabase
          .from('studio_videos')
          .select('*')
          .gt('created_at', since)
          .limit(50);

        const enriched = await Promise.all((recent || []).map(async (v: any) => {
          const likesCount = (await supabase.from('studio_video_likes').select('*', { count: 'exact', head: true }).eq('video_id', v.id)).count || 0;
          const commentsCount = (await supabase.from('studio_video_comments').select('*', { count: 'exact', head: true }).eq('video_id', v.id)).count || 0;
          const sharesCount = (await supabase.from('studio_video_shares').select('*', { count: 'exact', head: true }).eq('video_id', v.id)).count || 0;
          const viewsCount = v.views || 0;
          const engagementScore = (viewsCount) + (likesCount * 3) + (commentsCount * 6) + (sharesCount * 4);
          let creator_avatar = '';
          let creator_name = '';
          if (v.user_id) {
            const { data: userData } = await supabase.from('users').select('username, avatar_url').eq('id', v.user_id).maybeSingle();
            creator_avatar = userData?.avatar_url || '';
            creator_name = userData?.username || '';
          }
          return { ...v, likes_count: likesCount, comments_count: commentsCount, shares_count: sharesCount, engagementScore, creator_avatar, creator_name };
        }));

        enriched.sort((a, b) => b.engagementScore - a.engagementScore);
        setTrendingReels(enriched.slice(0, 5));

        // Most Viewed
        const { data: most } = await supabase
          .from('studio_videos')
          .select('*')
          .order('views', { ascending: false })
          .limit(12);
        
        const mostEnriched = await Promise.all((most || []).map(async (v: any) => {
          let creator_avatar = '';
          if (v.user_id) {
            const { data: userData } = await supabase.from('users').select('username, avatar_url').eq('id', v.user_id).maybeSingle();
            creator_avatar = userData?.avatar_url || '';
          }
          return { ...v, creator_avatar };
        }));
        setMostViewed(mostEnriched || []);

        // Top Creators
        const { data: creators } = await supabase
          .from('studio_channels')
          .select('*')
          .limit(50);
        const creatorsEnriched = await Promise.all((creators || []).map(async (c: any) => {
          const subs = (await supabase.from('studio_channel_subscribers').select('*', { count: 'exact', head: true }).eq('channel_id', c.id)).count || 0;
          const { data: vids } = await supabase.from('studio_videos').select('views, id').eq('channel_id', c.id);
          const totalViews = (vids || []).reduce((s: number, x: any) => s + (x.views || 0), 0);
          const videosCount = (vids || []).length;
          let owner_avatar = '';
          let owner_username = '';
          if (c.user_id) {
            const { data: u } = await supabase.from('users').select('username, avatar_url').eq('id', c.user_id).maybeSingle();
            owner_avatar = u?.avatar_url || '';
            owner_username = u?.username || '';
          }
          return { ...c, subscriber_count: subs, total_views: totalViews, videos_count: videosCount, owner_avatar, owner_username };
        }));
        
        const activeCreators = creatorsEnriched.filter((c: any) => (c.videos_count || 0) > 0 || (c.subscriber_count || 0) > 0 || (c.total_views || 0) > 0);
        activeCreators.sort((a: any, b: any) => (b.subscriber_count || 0) - (a.subscriber_count || 0));
        setTopCreators(activeCreators.slice(0, 5));
      } catch (err) {
        console.error('[Studio] fetchSidebarData error:', err);
      }
    };
    fetchSidebarData();
  }, []);

  // Fetch user's subscriptions and subscriber counts
  const fetchSubscriptionsAndCounts = async () => {
    if (!user) return;

    const { data: subsData } = await supabase
      .from('studio_channel_subscribers')
      .select('channel_id')
      .eq('user_id', user.id);
    setUserSubscriptions(new Set((subsData || []).map(s => s.channel_id)));

    const channelIds = Array.from(new Set(videos.map(v => v.channel_id)));
    const counts: Record<string, number> = {};
    for (const channelId of channelIds) {
      const { count: subCount } = await supabase
        .from('studio_channel_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);
      counts[channelId] = subCount || 0;
    }
    setSubscriberCounts(counts);
  };

  useEffect(() => {
    fetchSubscriptionsAndCounts();
  }, [user, videos]);

  // Create channel
  const handleCreateChannel = async () => {
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
      name = prompt('Enter your 1Studio channel name:')?.trim() || '';
      if (!name) {
        toast({ description: 'Channel name is required.' });
        return;
      }
      const { data: nameExists } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('name', name)
        .single();
      if (nameExists) {
        toast({ description: 'Channel name is already taken. Please choose another.' });
      } else {
        nameAvailable = true;
      }
    }
    const description = prompt('Enter a description for your channel:') || '';
    const { error } = await supabase.from('studio_channels').insert({
      user_id: user.id,
      name,
      description,
    });
    if (!error) window.location.reload();
  };

  // Handle like functionality
  const handleLike = async (videoId: string) => {
    if (!user) return;

    const isCurrentlyLiked = userLikes.has(videoId);
    const newUserLikes = new Set(userLikes);
    if (isCurrentlyLiked) {
      newUserLikes.delete(videoId);
    } else {
      newUserLikes.add(videoId);
    }
    setUserLikes(newUserLikes);

    try {
      if (isCurrentlyLiked) {
        const { error: deleteError } = await supabase
          .from('studio_video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);

        if (deleteError) throw deleteError;

        const { error: updateError } = await supabase.rpc('decrement_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('studio_video_likes')
          .insert({
            user_id: user.id,
            video_id: videoId
          });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase.rpc('increment_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
        
        (async () => {
          try {
            const { data: videoRow } = await supabase.from('studio_videos').select('id, user_id, channel_id').eq('id', videoId).single();
            const recipientId = videoRow?.user_id || videoRow?.channel_id || null;
            if (recipientId && String(recipientId) !== String(user.id)) {
              fetch('/api/notifications/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: recipientId,
                  actor_id: user.id,
                  type: 'like',
                  title: 'New like',
                  message: 'Someone liked your video',
                  target_table: 'studio_video_likes',
                  data: { video_id: videoId }
                })
              }).catch(e => console.warn('like notification failed', e));
            }
          } catch (nErr) {
            console.warn('failed to create like notification', nErr);
          }
        })();
      }

      refetch();
    } catch (error) {
      console.error('Error handling like:', error);
      setUserLikes(userLikes);
      toast({ description: 'Failed to update like', variant: 'destructive' });
    }
  };

  // Handle view functionality
  const handleView = async (videoId: string) => {
    if (!user || userViews.has(videoId)) return;

    try {
      const { data: existingView, error: viewError } = await supabase
        .from('studio_video_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();
      if (viewError) throw viewError;
      if (existingView) {
        setUserViews(prev => new Set(prev).add(videoId));
        return;
      }
      const { error: insertError } = await supabase
        .from('studio_video_views')
        .insert({
          user_id: user.id,
          video_id: videoId
        });
      if (insertError) throw insertError;
      const { error: updateError } = await supabase.rpc('increment_video_views', {
        video_id: videoId
      });
      if (updateError) throw updateError;
      setUserViews(prev => new Set(prev).add(videoId));
    } catch (error) {
      console.error('Error handling view:', error);
    }
  };

  // Handle share
  const handleShare = (videoId: string) => {
    try {
      const url = `${window.location.origin}/studio/video/${videoId}`;
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: 'Copied!', description: 'Video URL copied to clipboard.' });
      });
    } catch (e) {
      console.error('Error copying share URL:', e);
      toast({ description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  // Handle monetization toggle
  const handleToggleMonetization = async (type: 'donation' | 'subscription', enabled: boolean) => {
    if (!channel) return;

    try {
      const { error } = await supabase
        .from('studio_channels')
        .update({
          [`${type}_enabled`]: enabled
        })
        .eq('id', channel.id);

      if (error) throw error;

      await refetchChannel();

      toast({ description: `Monetization ${enabled ? 'enabled' : 'disabled'} for ${type}.` });
    } catch (error) {
      console.error('Error updating monetization:', error);
      toast({ description: 'Failed to update monetization', variant: 'destructive' });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Render skeleton loader while loading
  if (videosLoading && videos.length === 0) {
    return <StudioSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden custom-scrollbar pb-28 md:pb-0">
      {/* Use the new StudioHeader component */}
      <StudioHeader
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        navigate={navigate}
      />

      <div className="flex w-full max-w-7xl mx-auto items-stretch min-h-screen pt-16 sm:pt-16 relative" style={{ paddingTop: '56px' }}>
        {/* Left Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && (
          <div className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-56px)] w-[26rem] md:w-[28rem] lg:w-[30rem] p-2 md:p-4 overflow-y-auto space-y-4" style={{ zIndex: 10 }}>
            <LeftTrending trendingReels={trendingReels} getPublicUrl={getPublicUrl} />
            <LeftTopCreators topCreators={topCreators} />
            <LeftMostViewed mostViewed={mostViewed} getPublicUrl={getPublicUrl} />
          </div>
        )}
        
        {/* Main Content - Responsive max width and padding, fit for small screens */}
        <div
          ref={isDesktop ? undefined : mobileScrollRef}
          className={
            isDesktop
                ? 'flex-1 mx-auto px-1 md:px-2 py-2 md:py-4 h-full flex flex-col justify-center items-center'
              : 'fixed inset-0 w-full h-full overflow-y-auto snap-y snap-mandatory bg-black'
          }
              style={isDesktop ? { paddingLeft: '30rem', paddingRight: '20rem' } : { paddingTop: 0, background: '#000', zIndex: 0, overscrollBehavior: 'none' as any }}
        >
          {/* If device rotated to landscape on mobile, show blocking overlay asking to rotate back */}
          {(!isDesktop && isLandscapeBlocked) && (
            <div className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-6">
              <div className="text-center text-white max-w-sm">
                <h2 className="text-xl font-semibold mb-2">Please rotate your device</h2>
                <p className="text-sm opacity-80 mb-4">This page supports portrait mode only. Please rotate your phone back to portrait to continue.</p>
                <div className="mx-auto w-24 h-24 rounded-lg bg-white/5 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 2v20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 2v20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          )}
          {channelLoading ? (
            <div className="flex items-center justify-center py-8">
              <div>Loading...</div>
            </div>
          ) : !channel ? (
            <div className="text-center py-8">
              <p className="mb-4">Create your 1Studio channel to get started</p>
              <Button onClick={handleCreateChannel}>Create Channel</Button>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <div>No reels yet. Upload your first video!</div>
            </div>
          ) : (
            isDesktop ? (
              <div className="flex flex-col items-center w-full gap-4 md:gap-6">
                {videos.map((video, idx) => (
                  <div
                    key={video.id}
                    data-video-id={video.id}
                    ref={(el) => {
                      if (el) {
                        cardElementsRef.current.set(String(video.id), el);
                        if (observerRef.current && isDesktop) observerRef.current.observe(el);
                      } else {
                        const prev = cardElementsRef.current.get(String(video.id));
                        if (prev && observerRef.current) observerRef.current.unobserve(prev);
                        cardElementsRef.current.delete(String(video.id));
                      }
                    }}
                    className="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900/70 via-gray-800/60 to-purple-900/60 backdrop-blur-xl border border-gray-800"
                  >
                    <ReelCard
                      video={video}
                      onLike={handleLike}
                      onView={handleView}
                      onShare={() => handleShare(video.id)}
                      onFollow={() => {}}
                      isLiked={userLikes.has(video.id)}
                      isFollowing={userSubscriptions.has(video.channel_id)}
                      isActive={idx === activeIndex}
                      userData={fullUser}
                      hideLive={true}
                      videoRef={(el: HTMLVideoElement | null) => {
                        if (el) {
                          videoRefs.current.set(String(video.id), el);
                        } else {
                          videoRefs.current.delete(String(video.id));
                        }
                      }}
                    />
                  </div>
                ))}
                {/* Loading indicator for desktop infinite scroll */}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                )}
                {/* Load More button for desktop fallback */}
                {hasNextPage && !isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <Button onClick={() => fetchNextPage()} variant="outline" size="sm">
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <MobileReelScroller
                videos={videos}
                userLikes={userLikes}
                userSubscriptions={userSubscriptions}
                handleLike={handleLike}
                handleView={handleView}
                handleShare={handleShare}
                handleFollow={() => {}}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                hideLive={true}
                userData={fullUser}
              />
            )
          )}
        </div>
        {/* Right Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && user && channel && (
          <div className="hidden lg:flex flex-col fixed right-0 top-16 h-[calc(100vh-56px)] w-48 md:w-64 lg:w-80 p-2 md:p-6 space-y-4 md:space-y-6" style={{ zIndex: 10 }}>
            <RightYourStudio channel={channel} totalChannelViews={totalChannelViews} subscriberCounts={subscriberCounts} canPersonalize={canPersonalize} navigate={navigate} handleCreateChannel={handleCreateChannel} />
            <RightInviteFriends channel={channel} />
            <MonetizationCard channel={channel} totalChannelViews={totalChannelViews} subscriberCounts={subscriberCounts} handleToggleMonetization={handleToggleMonetization} />
          </div>
        )}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default Studio;