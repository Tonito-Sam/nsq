import { useSearchParams } from 'react-router-dom';
import MonetizationCard from '../components/studio/MonetizationCard';
// Animated comment display logic should be placed inside the ReelCard component only ONCE.
// Remove all duplicate declarations from the top-level scope.
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MobileReelScroller } from '../components/studio/MobileReelScroller';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReelCard } from '../components/studio/ReelCard';
// Custom outro animation styles for TikTok/Instagram style
const outroStyles = `
@keyframes scale-in {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-scale-in {
  animation: scale-in 0.5s cubic-bezier(0.4,0,0.2,1);
}
@keyframes pulse-slow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(75, 45, 128, 0.3); }
  50% { box-shadow: 0 0 12px 4px rgba(124,58,237,0.18); }
}
.animate-pulse-slow {
  animation: pulse-slow 2s infinite;
}
@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-marquee {
  display: inline-block;
  min-width: 100%;
  position: relative;
  white-space: nowrap;
  animation: marquee 8s linear infinite;
}
.nsq-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.nsq-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.nsq-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 9999px; }
.nsq-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.04); border-radius: 9999px; }
.nsq-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); }
.nsq-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.04) transparent; }
`;
if (typeof document !== 'undefined' && !document.getElementById('outro-styles')) {
  const style = document.createElement('style');
  style.id = 'outro-styles';
  style.innerHTML = outroStyles;
  document.head.appendChild(style);
}
// --- Monetized Series Feature ---
// Implements wallet-based purchase of series using Supabase RPC (transfer_series_payment)
// and records purchases in series_purchases table. See onBuySeries handler for details.
// --------------------------------

// (duplicate import removed)
// import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
// Removed duplicate import of useEffect and useState
import { supabase } from '@/integrations/supabase/client';
import { UserCheck, Eye, Grid3x3, Cpu, Smile, GraduationCap, Lightbulb, Music, Gamepad2, Utensils, Dumbbell, Camera, Palette, Trophy, MessageCircle, Heart, Share2 } from 'lucide-react';
// Type-only import for ffmpeg
// @ts-ignore
import type { FFmpegModule } from '../types/ffmpeg';
import { useToast } from '@/hooks/use-toast';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
// import { useTheme } from 'next-themes';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { Badge } from '@/components/ui/badge';

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
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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
  // const { theme, setTheme } = useTheme(); // Remove unused theme
  const navigate = useNavigate();
  // Channel is now fetched with React Query
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  // Remove loading state, use React Query's status
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userViews, setUserViews] = useState<Set<string>>(new Set());
  // const isDesktop = useMediaQuery('(min-width: 1024px'); // Removed duplicate declaration in Studio
  const [trendingReels, setTrendingReels] = useState<any[]>([]);
  // const [videoCreators, setVideoCreators] = useState<Record<string, any>>({});
  const [topCreators, setTopCreators] = useState<any[]>([]);
  const [mostViewed, setMostViewed] = useState<any[]>([]);

  // Subscription state
  const [userSubscriptions, setUserSubscriptions] = useState<Set<string>>(new Set());
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  // Infinite video loading with React Query (v4+ object syntax)
  // Increase initial batch to improve perceived load and reduce frequent pagination.
  const BATCH_SIZE = 40;
  const getPublicUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://pfemdshixllwqqajsxxp.supabase.co/storage/v1/object/public/studio-videos/${path}`;
  };

  const fetchVideos = async ({ pageParam = 0 }: { pageParam?: number }) => {
    console.log('[Studio] fetchVideos pageParam:', pageParam);
    let query = supabase
      .from('studio_videos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pageParam * BATCH_SIZE, (pageParam + 1) * BATCH_SIZE - 1);
    if (selectedCategory && selectedCategory !== 'All') {
      query = query.contains('categories', [selectedCategory]);
    }
    const { data: allVideos } = await query;
    console.log('[Studio] fetched videos:', allVideos?.map(v => v.id));
    // Optimize: batch-fetch creators and channels, then fetch counts in parallel per video
    const videosArr = allVideos || [];
    const userIds = Array.from(new Set(videosArr.map((v: any) => v.user_id).filter(Boolean)));
    const channelIds = Array.from(new Set(videosArr.map((v: any) => v.channel_id).filter(Boolean)));

    const [usersResp, channelsResp] = await Promise.all([
      userIds.length ? supabase.from('users').select('id, username, avatar_url').in('id', userIds) : Promise.resolve({ data: [] }),
      channelIds.length ? supabase.from('studio_channels').select('id, name').in('id', channelIds) : Promise.resolve({ data: [] }),
    ] as any);

    const usersById: Record<string, any> = {};
    (usersResp.data || []).forEach((u: any) => { usersById[u.id] = u; });
    const channelsById: Record<string, any> = {};
    (channelsResp.data || []).forEach((c: any) => { channelsById[c.id] = c; });

    // For counts (likes/comments/shares/subscribers) we parallelize per-video to avoid long sequential waits.
    const videosWithChannelName = await Promise.all(videosArr.map(async (v: any) => {
      const creator = usersById[v.user_id] ? { name: usersById[v.user_id].username, avatar_url: usersById[v.user_id].avatar_url } : { name: '', avatar_url: '' };
      const channel_name = channelsById[v.channel_id] ? channelsById[v.channel_id].name : '';

      // Fire count queries in parallel for this video
      const [likesRes, commentsRes, sharesRes, subsRes] = await Promise.all([
        supabase.from('studio_video_likes').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
        supabase.from('studio_video_comments').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
        supabase.from('studio_video_shares').select('*', { count: 'exact', head: true }).eq('video_id', v.id),
        v.channel_id ? supabase.from('studio_channel_subscribers').select('*', { count: 'exact', head: true }).eq('channel_id', v.channel_id) : Promise.resolve({ count: 0 }),
      ] as any);

      const likes_count = likesRes?.count || 0;
      const comments_count = commentsRes?.count || 0;
      const shares_count = sharesRes?.count || 0;
      const subscriber_count = subsRes?.count || 0;

      return {
        ...v,
        video_url: getPublicUrl(v.video_url || v.url || v.src || ''),
        channel_name,
        channel_id: v.channel_id,
        user_id: v.user_id,
        creator,
        subscriber_count,
        likes_count,
        comments_count,
        shares_count,
      };
    }));
    // Shuffle videos array for random order
    for (let i = videosWithChannelName.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videosWithChannelName[i], videosWithChannelName[j]] = [videosWithChannelName[j], videosWithChannelName[i]];
    }
    // If highlightId is present, move that video to the top
    if (highlightId && pageParam === 0) {
      const idx = videosWithChannelName.findIndex(v => String(v.id) === String(highlightId));
      if (idx > -1) {
        const [highlighted] = videosWithChannelName.splice(idx, 1);
        videosWithChannelName.unshift(highlighted);
      }
    }
    return { videos: videosWithChannelName, nextPage: (allVideos && allVideos.length === BATCH_SIZE) ? pageParam + 1 : undefined };
  };

  const {
    data: videoPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['studio-videos', selectedCategory, highlightId],
    queryFn: fetchVideos,
    initialPageParam: 0,
    getNextPageParam: (lastPage: { nextPage?: number }) => lastPage.nextPage,
    staleTime: 30 * 1000, // 30 seconds - data stays fresh for 30s
    gcTime: 5 * 60 * 1000, // 5 minutes - cache persists for 5min
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnReconnect: true, // Refetch when reconnecting
  });

  const videos: any[] = videoPages?.pages.flatMap((page: any) => page.videos) || [];

  // Active card index for desktop autoplay. Start at 0 so first video autoplays.
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // IntersectionObserver: make a card active only when it's fully visible on desktop
  useEffect(() => {
    if (!isDesktop) return;

    // Disconnect previous observer if any
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
        // If element is fully visible, set it active
        if (entry.intersectionRatio >= 0.999) {
          setActiveIndex(idx);
        }
      });
    }, { threshold: thresholds });

    // Observe current elements
    cardElementsRef.current.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [isDesktop, videos]);

  // Prefetch next page when user is close to the end (reduce perceived load time)
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const remaining = videos.length - (activeIndex + 1);
    // If we are within 8 items of the end, fetch the next page (earlier prefetch)
    if (remaining <= 8) {
      fetchNextPage().catch(err => console.error('[Studio] prefetch next page error:', err));
    }
  }, [videos.length, activeIndex, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Prevent mobile pull-to-refresh by blocking overscroll at the top of the scroll container
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
      // If at top of scroll and pulling down, prevent default to stop pull-to-refresh
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

  // Try to lock orientation to portrait on supported browsers and show overlay if landscape
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
    // initialize
    updateLandscape();

    return () => {
      window.removeEventListener('orientationchange', updateLandscape);
      window.removeEventListener('resize', updateLandscape);
    };
  }, [isDesktop]);


  // Fetch channel with React Query (move above all uses)
  const {
    data: channel,
    isLoading: channelLoading,
  // isError: channelError, (removed unused variable)
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
      // Fetch user's likes
      const { data: likesData } = await supabase
        .from('studio_video_likes')
        .select('video_id')
        .eq('user_id', user.id);

      if (likesData) {
        setUserLikes(new Set(likesData.map(like => like.video_id)));
      }

      // Fetch user's views
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


  // Fetch user interactions when user changes
  useEffect(() => {
    fetchUserInteractions();
  }, [user]);

  // Infinite scroll for all devices (desktop and mobile) with React Query
  useEffect(() => {
    if (!videos.length || !hasNextPage || isFetchingNextPage) return;
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 300)) {
        fetchNextPage();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [videos, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Fetch trending reels, top creators, most viewed (modernized: compute engagement score)
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        // Trending Reels: compute engagement score across recent videos (last 7 days)
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
          // engagement score: weighted sum (tunable)
          const engagementScore = (viewsCount) + (likesCount * 3) + (commentsCount * 6) + (sharesCount * 4);
          // fetch creator user for avatar and username
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

        // Most Viewed (all time) - top 6 for compact grid
        const { data: most } = await supabase
          .from('studio_videos')
          .select('*')
          .order('views', { ascending: false })
          .limit(12);
        // enrich most viewed with creator avatar
        const mostEnriched = await Promise.all((most || []).map(async (v: any) => {
          let creator_avatar = '';
          if (v.user_id) {
            const { data: userData } = await supabase.from('users').select('username, avatar_url').eq('id', v.user_id).maybeSingle();
            creator_avatar = userData?.avatar_url || '';
          }
          return { ...v, creator_avatar };
        }));
        setMostViewed(mostEnriched || []);

        // Top Creators: compute subscriber counts for channels and show top 5 (only active creators)
        const { data: creators } = await supabase
          .from('studio_channels')
          .select('*')
          .limit(50);
        const creatorsEnriched = await Promise.all((creators || []).map(async (c: any) => {
          const subs = (await supabase.from('studio_channel_subscribers').select('*', { count: 'exact', head: true }).eq('channel_id', c.id)).count || 0;
          // aggregate engagement for that channel (sum of views on videos) and count videos
          const { data: vids } = await supabase.from('studio_videos').select('views, id').eq('channel_id', c.id);
          const totalViews = (vids || []).reduce((s: number, x: any) => s + (x.views || 0), 0);
          const videosCount = (vids || []).length;
          // fetch owner user avatar
          let owner_avatar = '';
          let owner_username = '';
          if (c.user_id) {
            const { data: u } = await supabase.from('users').select('username, avatar_url').eq('id', c.user_id).maybeSingle();
            owner_avatar = u?.avatar_url || '';
            owner_username = u?.username || '';
          }
          return { ...c, subscriber_count: subs, total_views: totalViews, videos_count: videosCount, owner_avatar, owner_username };
        }));
        // Filter out creators with no videos, no subscribers and no views (inactive)
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

    // User's subscriptions
    const { data: subsData } = await supabase
      .from('studio_channel_subscribers')
      .select('channel_id')
      .eq('user_id', user.id);
    setUserSubscriptions(new Set((subsData || []).map(s => s.channel_id)));

    // Subscriber counts for all channels in current videos
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
    // Check if user already has a channel
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
      // Check for name availability
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

  // Handle like functionality with optimistic updates and background refetch
  const handleLike = async (videoId: string) => {
    if (!user) return;

    const isCurrentlyLiked = userLikes.has(videoId);
    // Optimistic update
    const newUserLikes = new Set(userLikes);
    if (isCurrentlyLiked) {
      newUserLikes.delete(videoId);
    } else {
      newUserLikes.add(videoId);
    }
    setUserLikes(newUserLikes);

    try {
      if (isCurrentlyLiked) {
        // Remove like
        const { error: deleteError } = await supabase
          .from('studio_video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);

        if (deleteError) throw deleteError;

        // Decrement likes count
        const { error: updateError } = await supabase.rpc('decrement_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
      } else {
        // Add like
        const { error: insertError } = await supabase
          .from('studio_video_likes')
          .insert({
            user_id: user.id,
            video_id: videoId
          });

        if (insertError) throw insertError;

        // Increment likes count
        const { error: updateError } = await supabase.rpc('increment_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
        // Fire-and-forget notification for like
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

      // Trigger background refetch to update like counts
      refetch();
    } catch (error) {
      console.error('Error handling like:', error);
      setUserLikes(userLikes); // revert
      toast({ description: 'Failed to update like', variant: 'destructive' });
    }
  };

  // Handle view functionality (fix duplicate key error)
  const handleView = async (videoId: string) => {
    if (!user || userViews.has(videoId)) return;

    // Check if view already exists before inserting
    try {
      const { data: existingView, error: viewError } = await supabase
        .from('studio_video_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();
      if (viewError) throw viewError;
      if (existingView) {
        // Already viewed, just update state
        setUserViews(prev => new Set(prev).add(videoId));
        return;
      }
      // Insert new view
      const { error: insertError } = await supabase
        .from('studio_video_views')
        .insert({
          user_id: user.id,
          video_id: videoId
        });
      if (insertError) throw insertError;
      // Increment views count
      const { error: updateError } = await supabase.rpc('increment_video_views', {
        video_id: videoId
      });
      if (updateError) throw updateError;
      setUserViews(prev => new Set(prev).add(videoId));
    } catch (error) {
      console.error('Error handling view:', error);
    }
  };

  // Handle share: copy a permalink to the clipboard and notify the user
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

  // Handle subscribe functionality
  // const handleSubscribe = async (channelId: string, isSubscribed: boolean) => {
  //   if (!user) return;
  //   if (isSubscribed) {
  //     await supabase
  //       .from('studio_channel_subscribers')
  //       .delete()
  //       .eq('user_id', user.id)
  //       .eq('channel_id', channelId);
  //   } else {
  //     await supabase
  //       .from('studio_channel_subscribers')
  //       .insert({ user_id: user.id, channel_id: channelId });
  //   }
  //   fetchSubscriptionsAndCounts();
  // };

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

      // Refetch channel from React Query cache
      await refetchChannel();

      toast({ description: `Monetization ${enabled ? 'enabled' : 'disabled'} for ${type}.` });
    } catch (error) {
      console.error('Error updating monetization:', error);
      toast({ description: 'Failed to update monetization', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Studio Header */}
      <header
        className="fixed top-0 left-0 right-0 z-40 px-2 py-2 sm:px-4 sm:py-3 pointer-events-auto"
        style={{ background: 'none', border: 'none', boxShadow: 'none' }}
      >
        <div className="flex items-center max-w-7xl mx-auto px-0 sm:px-0">
          {/* Favicon as Home button */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            style={{ minWidth: 40 }}
            aria-label="Home"
          >
            <img src="/favicon.ico" alt="Home" className="h-8 w-8 rounded-lg shadow-sm" />
          </button>

          {/* Categories - Centered on desktop, scrollable on mobile, with right arrow on mobile */}
          <div className="relative flex-1 flex justify-center items-center">
            <div
              id="category-scroll-container"
              className="flex items-center gap-3 sm:gap-3 overflow-x-auto px-0 sm:px-0 no-scrollbar py-1 ml-4 sm:ml-8"
              style={{
                WebkitOverflowScrolling: 'touch',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overscrollBehaviorX: 'contain',
                scrollSnapType: 'x mandatory',
                maxWidth: '100vw',
              }}
            >
              {categories.map((category) => {
                const IconComponent = category.icon;
                const isActive = selectedCategory === category.name;
                return (
                  <button
                    key={category.name}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors whitespace-nowrap min-w-[40px] sm:min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-400 ${isActive ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/70 dark:bg-[#232946]/70 text-black dark:text-white hover:bg-purple-100 dark:hover:bg-[#312e81]'}`}
                    style={{ minWidth: 40, border: 'none', scrollSnapAlign: 'start' }}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <IconComponent className="h-5 w-5 sm:h-4 sm:w-4" />
                    <span className="text-[9px] font-medium mt-0.5 hidden sm:inline">{category.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Right arrow for horizontal scroll, only visible on mobile */}
            <button
              type="button"
              className="ml-2 bg-white/80 dark:bg-[#232946]/80 rounded-full p-1 shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 hover:bg-purple-100 dark:hover:bg-[#312e81] transition sm:hidden"
              style={{ width: 24, height: 24 }}
              aria-label="Scroll right"
              onClick={() => {
                const container = document.getElementById('category-scroll-container');
                if (container) {
                  container.scrollBy({ left: 80, behavior: 'smooth' });
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 5L12 10L7 15" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex w-full max-w-7xl mx-auto items-stretch min-h-screen pt-16 sm:pt-16 relative" style={{ paddingTop: '56px' }}>
        {/* Left Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && (
          <div className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-56px)] w-56 md:w-64 lg:w-72 p-2 md:p-4 overflow-y-auto space-y-4" style={{ zIndex: 10 }}>
            {/* Trending Reels */}
            <div className="mb-8 bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Trending</h3>
              {trendingReels.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No trending reels yet.</div>
              ) : (
                <div className="space-y-3">
                  {trendingReels.map((reel, index) => (
                    <div key={reel.id} className="flex items-center gap-3 text-black dark:text-white">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                        {/* show creator avatar */}
                        <img src={reel.creator_avatar || getPublicUrl(reel.video_url || reel.url || '')} alt={reel.creator_name || reel.caption || 'avatar'} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold truncate">{reel.caption || 'Untitled'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</div>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1"><Eye className="w-4 h-4 text-purple-500" /> <span>{reel.views || 0}</span></div>
                          <div className="flex items-center gap-1"><MessageCircle className="w-4 h-4 text-sky-400" /> <span>{(reel.comments_count ?? reel.comments) || 0}</span></div>
                          <div className="flex items-center gap-1"><Heart className="w-4 h-4 text-pink-500" /> <span>{(reel.likes_count ?? reel.likes) || 0}</span></div>
                          <div className="flex items-center gap-1"><Share2 className="w-4 h-4 text-green-400" /> <span>{(reel.shares_count ?? reel.shares) || 0}</span></div>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Score: <span className="font-semibold text-purple-600">{Math.round(reel.engagementScore || 0)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Creators */}
            <div className="mb-8 bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Top Creators</h3>
              {topCreators.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No creators yet.</div>
              ) : (
                <div className="space-y-3">
                  {topCreators.map((creator, index) => (
                    <div key={creator.id} className="flex items-center gap-3 text-black dark:text-white">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                        <img src={creator.owner_avatar || creator.avatar_url || '/favicon.ico'} alt={creator.owner_username || creator.name || 'avatar'} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold truncate">{creator.name || creator.username || 'Creator'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-3">
                          <div className="flex items-center gap-1"><UserCheck className="w-4 h-4 text-purple-500" /> <span>{creator.subscriber_count ?? 0}</span></div>
                          <div className="flex items-center gap-1"><Eye className="w-4 h-4 text-gray-500" /> <span>{creator.total_views ?? 0}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Viewed */}
            <div className="bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Most Viewed</h3>
              {mostViewed.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No videos yet.</div>
              ) : (
                <div className="max-h-44 overflow-y-auto pr-1 nsq-scrollbar">
                  <div className="grid grid-cols-2 gap-2">
                    {mostViewed.map((reel) => (
                      <div key={reel.id} className="relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center h-20">
                        {/* show creator avatar prominently */}
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <img src={reel.creator_avatar || getPublicUrl(reel.video_url || reel.url || '')} alt={reel.caption || 'avatar'} className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute left-2 bottom-2 bg-black/60 text-white text-xs rounded-md px-2 py-0.5 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{reel.views || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          style={isDesktop ? { paddingLeft: '18rem', paddingRight: '20rem' } : { paddingTop: 0, background: '#000', zIndex: 0, overscrollBehavior: 'none' as any }}
        >
          {/* If device rotated to landscape on mobile, show blocking overlay asking to rotate back */}
          {(!isDesktop && isLandscapeBlocked) && (
            <div className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-6">
              <div className="text-center text-white max-w-sm">
                <h2 className="text-xl font-semibold mb-2">Please rotate your device</h2>
                <p className="text-sm opacity-80 mb-4">This page supports portrait mode only. Please rotate your phone back to portrait to continue.</p>
                <div className="mx-auto w-24 h-24 rounded-lg bg-white/5 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 2v20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 2v20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 7v10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                        // start observing newly mounted elements
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
                      // Active when index === activeIndex (first card default 0)
                      isActive={idx === activeIndex}
                      userData={fullUser}
                      // Hide live controls on the public Studio page for MVP
                      hideLive={true}
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
                // Hide live controls on the public Studio page for MVP
                hideLive={true}
                // Forward logged-in user to mobile ReelCards so comments work
                userData={fullUser}
              />
            )
          )}
        </div>
        {/* Right Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && user && channel && (
          <div className="hidden lg:flex flex-col fixed right-0 top-16 h-[calc(100vh-56px)] w-48 md:w-64 lg:w-80 p-2 md:p-6 space-y-4 md:space-y-6" style={{ zIndex: 10 }}>
            {/* Your Studio Card */}
            <div className="bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-xl font-bold mb-3">Your Studio</h3>
              <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{channel.name}</div>
              <div className="text-base text-gray-800 dark:text-gray-200 mb-3 font-medium">{channel.description}</div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">
                Link: <a href={`https://nexsq.com/studio/${channel.id}`} className="underline text-purple-600 dark:text-purple-400" target="_blank" rel="noopener noreferrer">https://nexsq.com/studio/{channel.id}</a>
              </div>
              {/* Overall View Tracker */}
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Total Views: <span className="font-bold">{totalChannelViews}</span></span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Subscribers: <span className="font-bold">{subscriberCounts[channel.id] ?? 0}</span></span>
              </div>
              {/* Progress Tracker Bar */}
              {!canPersonalize && (
                <div className="mb-2">
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-fuchsia-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.floor(((totalChannelViews / 1000) + ((subscriberCounts[channel.id] ?? 0) / 200)) / 2 * 100))}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 font-semibold">
                    <span>{totalChannelViews}/1000 views</span>
                    <span>{subscriberCounts[channel.id] ?? 0}/200 subs</span>
                  </div>
                </div>
              )}
              {/* End Progress Tracker Bar */}
              {canPersonalize ? (
                <Button size="sm" variant="outline" onClick={() => navigate('/studio/settings')}>Personalize Studio Link</Button>
              ) : (
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-semibold">Get 1000 views & 200 subscribers to customize your studio link!</div>
              )}
            </div>
            {/* Invite Friends Card */}
            <div className="bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-lg font-bold mb-3">Invite Friends</h3>
              <div className="text-sm mb-3">Share your channel link to invite friends to subscribe!</div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://nexsq.com/studio/${channel.id}`}
                  className="flex-1 bg-gray-800 text-white border-none focus:ring-0 focus:outline-none text-xs px-2 py-1 rounded"
                  style={{ minWidth: 0 }}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`https://nexsq.com/studio/${channel.id}`);
                    toast({ description: 'Link copied to clipboard!' });
                  }}
                  className="text-xs"
                >
                  Copy Link
                </Button>
              </div>
            </div>
            {/* Monetization Card */}
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
