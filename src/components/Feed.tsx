/**
 * Feed Component - INFINITE SCROLL FIX APPLIED
 * 
 * Key Changes:
 * 1. Added refs (hasNextPageRef, isFetchingNextPageRef) to track latest query state
 * 2. Added isIntersecting state to trigger React's reactivity system
 * 3. Separated intersection detection from fetch logic
 * 4. Observer callback now has empty deps (stable) and only sets intersection state
 * 5. Separate useEffect monitors intersection + reads latest values from refs to trigger fetch
 * 
 * This fixes the "stale closure" issue where the IntersectionObserver callback
 * captured old values of hasNextPage and isFetchingNextPage.
 * 
 * See lines ~750-850 for the infinite scroll implementation.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiUrl from '@/lib/api';
import { useInfiniteQuery, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { CreatePost } from './CreatePost';
import { PostCard } from './PostCard';
import { Moments } from './Moments';
import { VideoContainer } from './VideoContainer';
import { RepostModal } from './RepostModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ArrowDown, Loader2, ArrowUp, ExternalLink, Info, Video, Play, Pause, Volume2, VolumeX, MoreVertical, ShoppingBag, Star } from 'lucide-react';
import { LiveChat } from './LiveChat';
import { Skeleton } from '@/components/ui/skeleton';
import FeedSkeleton from '@/components/skeletons/FeedSkeleton';
import { groupPlatformCelebrations } from '@/lib/platformCelebrationGroups';
import type { PlatformCelebrationSlide, PlatformSpecialDayRelation } from '@/lib/platformCelebrationGroups';

interface Post {
  id: string;
  content?: string;
  created_at: string;
  pinned_until?: string | null;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  reposts_count?: number;
  post_type?: string;
  is_platform_celebration?: boolean;
  moment_special_name?: string | null;
  moment_special_message?: string | null;
  moment_special_icon?: string | null;
  moment_special_bg?: string | null;
  moment_bg?: string | null;
  platform_special_day?: PlatformSpecialDayRelation | PlatformSpecialDayRelation[] | null;
  special_day_events?: PlatformCelebrationSlide[];
  media_url?: string;
  media_urls?: string[];
  user_id?: string;
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    verified?: boolean;
    heading?: string;
    bio?: string;
  };
  original_post?: any;
  isSponsored?: boolean;
  sponsored_meta?: any;
}

interface AdCampaign {
  id: string;
  name: string;
  advertiser_name: string;
  bid_amount: number;
  campaign_type: string;
  creative?: {
    title: string;
    description: string;
    image_url?: string;
    video_url?: string;
    cta_text: string;
    cta_url: string;
  };
}

interface Reel {
  id: string;
  video_url?: string;
  caption?: string;
  likes: number;
  views: number;
  created_at: string;
  duration?: number;
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    verified?: boolean;
  } | null;
}

interface StoreProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  original_price?: number;
  sale_price?: number;
  is_on_sale?: boolean;
  sale_percentage?: number;
  is_deals_of_day?: boolean;
  product_type?: string;
  category?: string;
  images?: string[];
  tags?: string[];
  is_active?: boolean;
  views?: number;
  store_id: string;
  store?: {
    store_name?: string;
    base_currency?: string;
  };
  created_at: string;
}

const formatCurrency = (amount: number, currency?: string) => {
  const curr = currency || 'ZAR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr }).format(amount);
  } catch (e) {
    return `${curr} ${amount.toFixed(2)}`;
  }
};

const Feed: React.FC = () => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const activeReelPreviewRef = useRef<Set<HTMLVideoElement>>(new Set());
  const feedContainerRef = useRef<HTMLDivElement>(null);
  
  const PAGE_SIZE = 10;
  
  const [pullToRefresh, setPullToRefresh] = useState({
    active: false,
    startY: 0,
    distance: 0
  });
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [playingReelIds, setPlayingReelIds] = useState<string[]>([]);
  const [mutedStates, setMutedStates] = useState<Record<string, boolean>>({});
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  const queryClient = useQueryClient();
  const { user } = useAuth() as any;
  const feedRef = useRef<HTMLDivElement>(null);
  const [adCampaigns, setAdCampaigns] = useState<Record<number, AdCampaign | null>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [scheduleTransition, setScheduleTransition] = useState(false);
  const [nextProgramIndex, setNextProgramIndex] = useState<number | null>(null);
  const [showCommentsOverlay, setShowCommentsOverlay] = useState(false);
  const [showReelsOverlay, setShowReelsOverlay] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  
  const QUERY_KEYS = {
    posts: ['posts'],
    studioShows: ['studioShows'],
    reactions: (ids: string[]) => ['reactions', ids],
    comments: (postId: string) => ['comments', postId],
    reels: ['reels'],
    storeProducts: ['storeProducts']
  } as const;

  // Fetch reels data
  useEffect(() => {
    let mounted = true;
    const fetchReels = async () => {
      setReelsLoading(true);
      try {
        const selectCols = `
            id,
            video_url,
            caption,
            likes,
            views,
            duration,
            created_at,
            user:users!studio_videos_user_id_fkey(
              first_name,
              last_name,
              username,
              avatar_url,
              verified
            )
          `;

        let data: any = null;
        let error: any = null;

        let res = await supabase
          .from('studio_videos')
          .select(selectCols)
          .eq('share_to_feeds', true)
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(60);
        data = res.data; error = res.error;

        if (error && String(error.code) === '42703') {
          console.warn('share_to_feeds column not found, retrying with share_to_feed');
          res = await supabase
            .from('studio_videos')
            .select(selectCols)
            .eq('share_to_feed', true)
            .not('video_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(60);
          data = res.data; error = res.error;
        }

        if (error && String(error.code) === '42703') {
          console.warn('Neither share_to_feeds nor share_to_feed exist; fetching all videos with video_url');
          res = await supabase
            .from('studio_videos')
            .select(selectCols)
            .not('video_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(60);
          data = res.data; error = res.error;
        }

        if (error) {
          console.error('Supabase error fetching studio_videos:', error);
          throw error;
        }
        
        const rawReels = (data || []) as any[];
        const validReels: any[] = [];
        for (const r of rawReels) {
          if (!r || !r.video_url) continue;
          validReels.push({
            ...r,
            duration: r.duration || 30
          });
        }

        const mapped: Reel[] = validReels.map((r: any) => ({
          id: r.id,
          video_url: r.video_url || r.media_url,
          caption: r.caption,
          likes: r.likes || 0,
          views: r.views || 0,
          created_at: r.created_at,
          duration: r.duration || undefined,
          user: Array.isArray(r.user) ? (r.user[0] || null) : (r.user || null),
        }));

        const shuffled = [...mapped].sort(() => Math.random() - 0.5);

        if (mounted) {
          setReels(shuffled);
        }

        const initialMuted: Record<string, boolean> = {};
        shuffled.forEach(reel => {
          initialMuted[reel.id] = true;
        });
        setMutedStates(initialMuted);
      } catch (error) {
        console.error('Error fetching reels:', error);
        toast({ description: 'Failed to load reels', variant: 'destructive' });
      } finally {
        setReelsLoading(false);
      }
    };

    fetchReels();
    return () => { 
      mounted = false;
    };
  }, []);

  // Fetch products from store_products table
  useEffect(() => {
    let mounted = true;
    const fetchStoreProducts = async () => {
      setProductsLoading(true);
      try {
        console.log('Fetching store products with seller info...');

        const { data: productsData, error: productsError } = await supabase
          .from('store_products')
          .select(`
            id,
            title,
            description,
            price,
            original_price,
            sale_price,
            is_on_sale,
            sale_percentage,
            is_deals_of_day,
            product_type,
            category,
            images,
            tags,
            is_active,
            views,
            store_id,
            created_at,
            store:user_stores!inner(
              store_name,
              base_currency
            )
          `)
          .eq('is_active', true)
          .eq('store.is_active', true)
          .order('created_at', { ascending: false })
          .limit(12);

        if (productsError) {
          console.error('Error fetching store products:', productsError);
          throw productsError;
        }

        const rawProducts = productsData || [];

        if (mounted) {
          const formattedProducts: StoreProduct[] = rawProducts.map((product: any) => ({
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price,
            original_price: product.original_price,
            sale_price: product.sale_price,
            is_on_sale: product.is_on_sale || false,
            sale_percentage: product.sale_percentage,
            is_deals_of_day: product.is_deals_of_day || false,
            product_type: product.product_type,
            category: product.category,
            images: product.images || [],
            tags: product.tags || [],
            is_active: product.is_active,
            views: product.views || 0,
            store_id: product.store_id,
            store: {
              store_name: product.store?.store_name || 'Seller',
              base_currency: product.store?.base_currency || 'ZAR'
            },
            created_at: product.created_at
          }));

          const shuffledProducts = [...formattedProducts].sort(() => Math.random() - 0.5);
          setStoreProducts(shuffledProducts);
          console.log('Set products with seller info:', shuffledProducts.length);
        }
      } catch (error) {
        console.error('Error in fetchStoreProducts:', error);
        if (mounted) {
          console.log('Using fallback demo products');
          setStoreProducts(getDemoStoreProducts());
        }
      } finally {
        if (mounted) {
          setProductsLoading(false);
        }
      }
    };

    fetchStoreProducts();
    return () => { mounted = false; };
  }, []);

  // Generate demo store products as fallback
  const getDemoStoreProducts = (): StoreProduct[] => {
    return [
      {
        id: '1',
        title: 'Wireless Earbuds Pro',
        description: 'Premium noise-cancelling wireless earbuds with 30hr battery',
        price: 129.99,
        original_price: 149.99,
        sale_price: 99.99,
        is_on_sale: true,
        sale_percentage: 33,
        is_deals_of_day: true,
        product_type: 'electronics',
        category: 'Audio',
        images: ['https://images.unsplash.com/photo-1590658165737-15a047b8b5e9?w=400&h=400&fit=crop'],
        tags: ['wireless', 'audio', 'tech'],
        is_active: true,
        views: 128,
        store_id: 'store-1',
        store: {
          store_name: 'Tech Haven',
          base_currency: 'ZAR'
        },
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        title: 'Organic Cotton T-Shirt',
        description: 'Sustainable organic cotton t-shirt in various colors',
        price: 29.99,
        product_type: 'clothing',
        category: 'Fashion',
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'],
        tags: ['organic', 'cotton', 'sustainable'],
        is_active: true,
        views: 56,
        store_id: 'store-2',
        store: {
          store_name: 'Eco Wear',
          base_currency: 'ZAR'
        },
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        title: 'Smart Fitness Watch',
        description: 'Track your workouts, heart rate, and sleep patterns',
        price: 199.99,
        original_price: 249.99,
        sale_price: 149.99,
        is_on_sale: true,
        sale_percentage: 40,
        is_deals_of_day: true,
        product_type: 'electronics',
        category: 'Fitness',
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'],
        tags: ['fitness', 'smartwatch', 'health'],
        is_active: true,
        views: 89,
        store_id: 'store-3',
        store: {
          store_name: 'Fit Tech',
          base_currency: 'ZAR'
        },
        created_at: new Date().toISOString()
      }
    ];
  };

  // Helper function to process media URLs
  const processPostMediaUrls = (post: any): any => {
    let media_urls: string[] | undefined = undefined;
    if (Array.isArray(post.media_urls) && post.media_urls.length > 0) {
      media_urls = post.media_urls;
    } else if (typeof post.media_url === 'string') {
      try {
        if (post.media_url.trim().startsWith('[')) {
          const urls = JSON.parse(post.media_url);
          if (Array.isArray(urls)) media_urls = urls;
        } else if (post.media_url.includes(',')) {
          media_urls = post.media_url.split(',').map((u: string) => u.trim()).filter(Boolean);
        } else {
          media_urls = [post.media_url];
        }
      } catch (e) {
        media_urls = [post.media_url];
      }
    }
    return { ...post, media_urls, media_url: (media_urls && media_urls.length > 0) ? media_urls[0] : post.media_url };
  };

  // Optimized infinite query for posts
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: QUERY_KEYS.posts,
    queryFn: async ({ pageParam = 0 }) => {
      console.log('[Feed] Fetching page:', pageParam);
      
      try {
        const from = pageParam * PAGE_SIZE;
        const to = (pageParam + 1) * PAGE_SIZE - 1;
        
        const { data, error, count } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            created_at,
            likes_count,
            comments_count,
            shares_count,
            reposts_count,
            post_type,
            moment_bg,
            moment_font,
            moment_font_size,
            moment_type,
            moment_special_message,
            moment_special_icon,
            moment_special_name,
            moment_special_bg,
            moment_special_countries,
            is_custom_special_day,
            moment_special_id,
            share_to_feed,
            is_platform_celebration,
            platform_special_day_id,
            platform_special_day:platform_special_days(event_date,country_code,name,local_name,description,icon,background),
            pinned_until,
            media_url,
            media_urls,
            voice_note_url,
            voice_duration,
            poll_options,
            event_date,
            event_location,
            location,
            feeling,
            user_id,
            user:users!posts_user_id_fkey(
              first_name,
              last_name,
              username,
              avatar_url,
              verified,
              heading,
              bio
            )
          `, { count: 'exact' })
          .is('group_id', null)
          .or('post_type.neq.moment,share_to_feed.eq.true')
          .order('pinned_until', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('[Feed] Error fetching posts:', error);
          throw error;
        }

        console.log(`[Feed] Fetched ${data?.length || 0} posts for page ${pageParam}`);

        const processedPosts = await Promise.all(
          (data || []).map(async (post) => {
            const { count: commentCount } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);
            
            const processedPost = { 
              ...processPostMediaUrls(post), 
              ...(post.is_platform_celebration ? {
                user: {
                  first_name: 'NexSq',
                  last_name: 'Celebrations',
                  username: 'nexsq',
                  avatar_url: '/favicon.ico',
                  verified: true,
                },
              } : {}),
              comments_count: commentCount || 0 
            };
            
            if (post.post_type === 'repost' && post.media_url) {
              const { data: originalPost } = await supabase
                .from('posts')
                .select(`
                  id,
                  content,
                  media_url,
                  media_urls,
                  created_at,
                  post_type,
                  user:users!posts_user_id_fkey(
                    first_name,
                    last_name,
                    username,
                    avatar_url
                  )
                `)
                .eq('id', post.media_url)
                .single();
              
              const processedOriginalPost = originalPost ? processPostMediaUrls(originalPost) : null;
              
              return {
                ...processedPost,
                original_post: processedOriginalPost,
                media_url: null,
                media_urls: undefined,
              };
            }
            
            return processedPost;
          })
        );

        return {
          posts: processedPosts,
          nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
          totalCount: count || 0,
        };
      } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw error;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Query for studio shows with caching
  const { data: studioShows = [] } = useQuery({
    queryKey: QUERY_KEYS.studioShows,
    queryFn: async () => {
      const { data: shows, error } = await supabase
        .from('studio_shows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const activeShows = shows || [];
      if (activeShows.length === 0) return [];

      const showIds = activeShows.map((show) => show.id);
      const { data: episodes, error: episodesError } = await supabase
        .from('studio_episodes')
        .select('*')
        .in('show_id', showIds)
        .eq('is_active', true)
        .order('scheduled_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (episodesError) {
        console.warn('[Feed] Could not load studio episodes for TV playlist:', episodesError);
      }

      const episodesByShow = new Map<string, any[]>();
      for (const episode of episodes || []) {
        const episodeShowId = String(episode.show_id);
        const showEpisodes = episodesByShow.get(episodeShowId) || [];
        showEpisodes.push(episode);
        episodesByShow.set(episodeShowId, showEpisodes);
      }

      const programStart = (show: any) => {
        if (show.time_slot_start) return String(show.time_slot_start);
        if (!show.scheduled_time) return '99:99:99';
        const scheduledDate = new Date(show.scheduled_time);
        return Number.isNaN(scheduledDate.getTime())
          ? String(show.scheduled_time)
          : scheduledDate.toISOString().slice(11, 19);
      };
      const orderedShows = [...activeShows].sort((first: any, second: any) =>
        programStart(first).localeCompare(programStart(second)) ||
        String(first.created_at || '').localeCompare(String(second.created_at || ''))
      );

      return orderedShows.flatMap((show: any) => {
        const playableEpisodes = (episodesByShow.get(String(show.id)) || [])
          .filter((episode) => typeof episode.video_url === 'string' && episode.video_url.trim());

        if (playableEpisodes.length > 0) {
          return playableEpisodes.map((episode) => ({
            ...episode,
            id: episode.id,
            show_id: show.id,
            show_title: show.title,
            title: episode.title || show.title,
            description: episode.description || show.description,
            video_url: episode.video_url,
            thumbnail_url: episode.thumbnail_url || show.thumbnail_url,
            duration: episode.duration || show.duration,
            category: show.category,
            time_slot_start: show.time_slot_start,
            time_slot_end: show.time_slot_end,
            days_of_week: show.approved_days?.length ? show.approved_days : show.days_of_week,
            approved_days: show.approved_days,
            schedule_pattern: show.schedule_pattern,
            program_scheduled_time: show.scheduled_time,
            program_end_time: show.end_time,
            is_live: false,
            is_active: true,
          }));
        }

        const videoUrl = show.video_url || show.live_url;
        return videoUrl ? [{
          ...show,
          video_url: videoUrl,
          show_id: show.id,
          show_title: show.title,
          program_scheduled_time: show.scheduled_time,
          program_end_time: show.end_time,
        }] : [];
      });
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!studioShows.length) {
      setScheduleTransition(false);
      setNextProgramIndex(null);
      return;
    }

    const selectScheduledProgram = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const today = now.toDateString();
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const parseDays = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((day) => String(day).trim().toLowerCase()).filter(Boolean);
        }
        if (typeof value !== 'string' || !value.trim()) return [];
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map((day) => String(day).trim().toLowerCase()).filter(Boolean);
          }
        } catch {}
        return value.split(',').map((day) => day.trim().toLowerCase()).filter(Boolean);
      };
      const programs = studioShows.flatMap((program: any, index: number) => {
        const days = parseDays(program.approved_days?.length ? program.approved_days : program.days_of_week);
        const pattern = String(program.schedule_pattern || '').toLowerCase();
        const startValue = program.time_slot_start || program.program_scheduled_time;
        const endValue = program.time_slot_end || program.program_end_time;
        const parseMinutes = (value: string) => {
          const timeMatch = value.match(/^(\d{1,2}):(\d{2})/);
          if (timeMatch) return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date.getHours() * 60 + date.getMinutes();
        };
        const start = typeof startValue === 'string' ? parseMinutes(startValue) : null;
        const end = typeof endValue === 'string' ? parseMinutes(endValue) : null;
        if (start === null || end === null) return [];

        const recurring = pattern === 'daily' || days.includes(dayName);
        const scheduledDate = program.program_scheduled_time
          ? new Date(program.program_scheduled_time)
          : null;
        const oneOff = !pattern && days.length === 0 && scheduledDate &&
          !Number.isNaN(scheduledDate.getTime()) && scheduledDate.toDateString() === today;
        if (!recurring && !oneOff) return [];

        const normalizedEnd = end <= start ? end + 24 * 60 : end;
        const normalizedNow = currentMinutes < start ? currentMinutes + 24 * 60 : currentMinutes;
        return [{ index, start, end: normalizedEnd, active: normalizedNow >= start && normalizedNow < normalizedEnd }];
      });

      const currentProgram = programs.find((program) => program.active);
      const nextProgram = programs
        .filter((program) => program.start > currentMinutes)
        .sort((first, second) => first.start - second.start)[0];
      const nextIndex = currentProgram?.index ?? nextProgram?.index ?? 0;
      setNextProgramIndex(currentProgram ? null : nextProgram?.index ?? null);
      setCurrentShowIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
      setScheduleTransition(!currentProgram);
    };

    selectScheduledProgram();
    const intervalId = window.setInterval(selectScheduledProgram, 30_000);
    return () => window.clearInterval(intervalId);
  }, [studioShows]);

  // Get all posts from pages
  const loadedPosts: Post[] = (postsData as any)?.pages?.flatMap((page: any) => page.posts) || [];
  const [pinSortNow, setPinSortNow] = useState(() => Date.now());
  const nextPinExpiry = loadedPosts.reduce((nextExpiry, post) => {
    const expiry = Date.parse(post.pinned_until || '');
    return Number.isFinite(expiry) && expiry > pinSortNow && expiry < nextExpiry
      ? expiry
      : nextExpiry;
  }, Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!Number.isFinite(nextPinExpiry)) return;

    const timeoutId = window.setTimeout(
      () => setPinSortNow(Date.now()),
      Math.max(0, nextPinExpiry - Date.now() + 1),
    );
    return () => window.clearTimeout(timeoutId);
  }, [nextPinExpiry]);

  const orderedPosts = [...loadedPosts].sort((first, second) => {
    const firstExpiry = Date.parse(first.pinned_until || '');
    const secondExpiry = Date.parse(second.pinned_until || '');
    const firstIsPinned = Number.isFinite(firstExpiry) && firstExpiry > pinSortNow;
    const secondIsPinned = Number.isFinite(secondExpiry) && secondExpiry > pinSortNow;

    if (firstIsPinned !== secondIsPinned) return firstIsPinned ? -1 : 1;
    return Date.parse(second.created_at) - Date.parse(first.created_at);
  });
  const posts = groupPlatformCelebrations(orderedPosts);

  // Only the most-visible Shorts preview plays, even though responsive rails are duplicated in the DOM.
  useEffect(() => {
    if (posts.length < 6 || reels.length === 0 || !feedRef.current) return;

    const previewVideos = Array.from(
      feedRef.current.querySelectorAll<HTMLVideoElement>('[data-reel-preview]')
    );
    if (previewVideos.length === 0) return;

    const visibilityByVideo = new Map<HTMLVideoElement, number>();
    const reconcilePlayback = () => {
      const visibleVideos = [...visibilityByVideo.entries()]
        .filter(([, ratio]) => ratio >= 0.5)
        .sort(([, firstRatio], [, secondRatio]) => secondRatio - firstRatio);
      const nextActiveVideos = visibleVideos.slice(0, 1).map(([video]) => video);
      const nextActiveSet = new Set(nextActiveVideos);

      previewVideos.forEach((video) => {
        if (!nextActiveSet.has(video) && !video.paused) video.pause();
      });

      const previousActiveSet = activeReelPreviewRef.current;
      activeReelPreviewRef.current = nextActiveSet;

      nextActiveVideos.forEach((video) => {
        if (previousActiveSet.has(video) && !video.paused) return;
        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = false;
        video.playsInline = true;
        video.play().catch((error) => {
          if (activeReelPreviewRef.current.has(video)) {
            console.warn('Failed to play muted reel preview:', error);
          }
        });
      });

      const activeReelIds = [...new Set(
        nextActiveVideos.map((video) => video.dataset.reelId).filter((id): id is string => !!id)
      )].sort();
      setPlayingReelIds((currentIds) =>
        currentIds.length === activeReelIds.length && currentIds.every((id, index) => id === activeReelIds[index])
          ? currentIds
          : activeReelIds
      );
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visibilityByVideo.set(
          entry.target as HTMLVideoElement,
          entry.isIntersecting ? entry.intersectionRatio : 0
        );
      });
      reconcilePlayback();
    }, { threshold: [0, 0.5, 0.75, 1] });
    const handleResize = () => {
      visibilityByVideo.clear();
      previewVideos.forEach((video) => {
        observer.unobserve(video);
        observer.observe(video);
      });
    };
    window.addEventListener('resize', handleResize);

    previewVideos.forEach((video) => observer.observe(video));

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      previewVideos.forEach((video) => video.pause());
      activeReelPreviewRef.current.clear();
    };
  }, [posts.length, reels]);

  // Fetch ad campaigns from campaigns table
  useEffect(() => {
    let mounted = true;
    
    const requiredBatches = Math.max(0, Math.floor(posts.length / 6));
    
    const fetchForBatch = async (batchIndex: number) => {
      if (adCampaigns[batchIndex]) return;
      
      try {
        console.log(`Fetching ad campaign for batch ${batchIndex}`);
        
        const uid = user?.id;
        const endpoint = apiUrl(`/api/ads/serve${uid ? `?user_id=${uid}` : ''}`);
        const resp = await fetch(endpoint);
        
        if (!resp.ok) {
          console.warn(`Failed to fetch ad campaign for batch ${batchIndex}:`, resp.status);
          return;
        }
        
        const text = await resp.text();
        if (!text || text.trim() === '') {
          console.warn(`Empty response for batch ${batchIndex}`);
          return;
        }
        
        const j = JSON.parse(text);
        console.log('Ad API response for batch', batchIndex, ':', j);
        
        if (!j || !j.served || !j.campaign) {
          console.warn('No ad campaign available for batch:', batchIndex);
          return;
        }

        if (mounted) {
          console.log('Setting ad campaign for batch:', batchIndex, j.campaign.name);
          setAdCampaigns(prev => ({ 
            ...prev, 
            [batchIndex]: j.campaign 
          }));
        }
        
      } catch (e) {
        console.error('Error in ad campaign fetch for batch', batchIndex, ':', e);
      }
    };

    for (let i = 0; i < requiredBatches; i++) {
      if (!adCampaigns[i]) {
        fetchForBatch(i);
      }
    }

    return () => { mounted = false; };
  }, [posts.length, user?.id, adCampaigns]);

  // Query for reactions with caching
  const { data: postReactions = {} } = useQuery({
    queryKey: QUERY_KEYS.reactions(posts.map(p => p.id)),
    queryFn: async () => {
      if (!user?.id || posts.length === 0) return {};

      const postIds = posts.map(p => p.id);
      const { data: reactions, error } = await supabase
        .from('likes')
        .select('post_id, reaction_type, user_id')
        .in('post_id', postIds);

      if (error) throw error;

      const reactionsByPost: {[postId: string]: { counts: {[type: string]: number}, userReaction: string | null }} = {};
      posts.forEach(post => {
        reactionsByPost[post.id] = { counts: {}, userReaction: null };
      });

      (reactions || []).forEach(r => {
        if (!r.post_id || !r.reaction_type) return;
        if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = { counts: {}, userReaction: null };
        reactionsByPost[r.post_id].counts[r.reaction_type] = (reactionsByPost[r.post_id].counts[r.reaction_type] || 0) + 1;
        if (r.user_id === user.id) reactionsByPost[r.post_id].userReaction = r.reaction_type;
      });

      return reactionsByPost;
    },
    enabled: !!user?.id && posts.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Mutations for optimized updates
  const reactMutation = useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existingReaction } = await supabase
        .from('likes')
        .select('id, reaction_type')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .single();

      if (existingReaction && existingReaction.reaction_type === reactionType) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);
      } else {
        if (existingReaction) {
          await supabase
            .from('likes')
            .update({ reaction_type: reactionType })
            .eq('id', existingReaction.id);
        } else {
          await supabase
            .from('likes')
            .insert({
              user_id: user.id,
              post_id: postId,
              reaction_type: reactionType
            });
        }
      }

      return { postId, reactionType };
    },
    onSuccess: async (result: any) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reactions(posts.map(p => p.id)) });

      try {
        if (!user?.id) return;
        const postId = result.postId;
        const { data: postData, error: postErr } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', postId)
          .single();
        const owner = postData?.user_id;
        if (!postErr && owner && String(owner) !== String(user.id)) {
          fetch('/api/notifications/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: owner,
              actor_id: user.id,
              type: 'like',
              title: 'New like',
              message: 'Someone liked your post',
              target_table: 'post_likes',
              data: { post_id: postId }
            })
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('post like notification failed', e);
      }
    },
    onError: (error) => {
      console.error('Error handling reaction:', error);
      toast({ description: 'Failed to update reaction', variant: 'destructive' });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      return postId;
    },
    onSuccess: (postId) => {
      queryClient.setQueryData(QUERY_KEYS.posts, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((post: Post) => post.id !== postId)
          }))
        };
      });
      toast({ title: 'Deleted', description: 'Post deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete post.' });
    },
  });

  // ============================================================================
  // ROBUST INFINITE SCROLL IMPLEMENTATION - Fixed for stale closures
  // ============================================================================
  
  // AGGRESSIVE DEBUG: Log component state
  console.log('[Feed] Component rendered with:', {
    hasNextPage,
    isFetchingNextPage,
    postsCount: posts.length,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // State to track intersection
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  // Track latest values in refs to avoid stale closures
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);

  // Update refs whenever values change
  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
    console.log('[InfiniteScroll] ✏️ hasNextPage updated to:', hasNextPage);
  }, [hasNextPage]);

  useEffect(() => {
    isFetchingNextPageRef.current = isFetchingNextPage;
    console.log('[InfiniteScroll] ✏️ isFetchingNextPage updated to:', isFetchingNextPage);
  }, [isFetchingNextPage]);

  // Stable intersection callback (no dependencies on query state)
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    
    console.log('[InfiniteScroll] 📍 Intersection event:', {
      isIntersecting: entry.isIntersecting,
      intersectionRatio: entry.intersectionRatio.toFixed(2),
      targetVisible: entry.boundingClientRect.top < window.innerHeight,
      timestamp: new Date().toLocaleTimeString()
    });
    
    setIsIntersecting(entry.isIntersecting);
  }, []); // Empty deps - truly stable

  // Separate effect to trigger fetch based on intersection + latest query state
  useEffect(() => {
    const shouldFetch = 
      isIntersecting && 
      hasNextPageRef.current === true && 
      !isFetchingNextPageRef.current;
    
    if (shouldFetch) {
      console.log('[InfiniteScroll] ✅ TRIGGERING fetchNextPage', {
        isIntersecting,
        hasNextPage: hasNextPageRef.current,
        isFetchingNextPage: isFetchingNextPageRef.current,
        timestamp: new Date().toLocaleTimeString()
      });
      
      fetchNextPage();
    } else if (isIntersecting) {
      console.log('[InfiniteScroll] ⏸️ Intersection detected but NOT fetching:', {
        hasNextPage: hasNextPageRef.current,
        isFetchingNextPage: isFetchingNextPageRef.current,
        reason: hasNextPageRef.current === false 
          ? '❌ No more pages available' 
          : hasNextPageRef.current === undefined
          ? '⚠️ hasNextPage is undefined'
          : '⏳ Already fetching current page',
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }, [isIntersecting, fetchNextPage]); // React when intersection changes

  // Create IntersectionObserver and observe the sentinel
  useEffect(() => {
    console.log('[InfiniteScroll] 🔄 Creating new IntersectionObserver');
    
    const observer = new IntersectionObserver(handleIntersection, {
      root: null, // Use viewport as root
      rootMargin: '600px 0px', // Trigger 600px before sentinel becomes visible
      threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for better detection
    });

    const target = loadMoreRef.current;

    console.log('[InfiniteScroll] 🎯 Sentinel element check:', {
      exists: !!target,
      element: target,
      postsCount: posts.length,
      hasNextPage,
      isFetchingNextPage
    });

    if (target) {
      console.log('[InfiniteScroll] 👀 Started observing sentinel element');
      observer.observe(target);
      
      // FORCE check if already in viewport
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        console.log('[InfiniteScroll] 🔍 Sentinel position check:', {
          top: rect.top,
          bottom: rect.bottom,
          windowHeight: window.innerHeight,
          isVisible: rect.top < window.innerHeight,
          distance: rect.top - window.innerHeight
        });
      }, 500);
    } else {
      console.error('[InfiniteScroll] ❌ ERROR: Sentinel element (loadMoreRef) is NULL!');
    }

    // Cleanup function
    return () => {
      if (target) {
        console.log('[InfiniteScroll] 🔴 Unobserving sentinel element');
        observer.unobserve(target);
      }
      observer.disconnect();
      console.log('[InfiniteScroll] 🔌 Observer disconnected');
    };
  }, [handleIntersection, posts.length]); // IMPORTANT: Also recreate when posts change!

  // ============================================================================
  // END INFINITE SCROLL IMPLEMENTATION
  // ============================================================================

  // Reset scroll position when leaving and returning
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (posts.length < PAGE_SIZE) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.posts });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [posts.length, queryClient]);

  // Event handlers for reels
  const navigate = useNavigate();

  const handleReelClick = (reel: Reel, index: number) => {
    navigate(`/studio?video=${reel.id}&autoplay=true`);
  };

  const handleReelClose = () => {
    setShowReelsOverlay(false);
    setSelectedReel(null);
  };

  const handleReelMute = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMutedStates(prev => ({
      ...prev,
      [reelId]: !prev[reelId]
    }));
  };

  const handleReelLike = async (reelId: string) => {
    if (!user?.id) {
      toast({ description: 'Please login to like reels', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.rpc('increment_likes', { reel_id: reelId });
      if (error) throw error;
      
      setReels(prev => prev.map(reel => 
        reel.id === reelId ? { ...reel, likes: reel.likes + 1 } : reel
      ));
    } catch (error) {
      console.error('Error liking reel:', error);
      toast({ description: 'Failed to like reel', variant: 'destructive' });
    }
  };

  const handleReelShare = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/reel/${reelId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Copied!', description: 'Reel URL copied to clipboard.' });
    });
  };

  // Handle product click
  const handleProductClick = (product: StoreProduct) => {
    navigate(`/product/${product.id}`);
  };

  // Add this to your existing event handlers
  const handleReact = (postId: string, reactionType: string) => {
    reactMutation.mutate({ postId, reactionType });
  };

  const handleComment = async (postId: string) => {
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(postId) });
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const handleNewPost = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.posts });
  };

  const handleRepost = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setShowRepostModal(true);
    }
  };

  const handleRepostComplete = () => {
    setShowRepostModal(false);
    setSelectedPost(null);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.posts });
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Copied!', description: 'Post URL copied to clipboard.' });
    });
  };

  const handleHidePost = async (postId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('hidden_posts').upsert({
        user_id: user.id,
        post_id: postId
      }, { onConflict: 'user_id,post_id' });
      
      if (error) throw error;
      
      queryClient.setQueryData(QUERY_KEYS.posts, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((post: Post) => post.id !== postId)
          }))
        };
      });
      
      toast({ title: 'Hidden', description: 'Post hidden from your feed.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to hide post.' });
    }
  };

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullToRefresh({
        active: true,
        startY: e.touches[0].clientY,
        distance: 0
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullToRefresh.active) {
      const distance = e.touches[0].clientY - pullToRefresh.startY;
      if (distance > 0) {
        setPullToRefresh(prev => ({
          ...prev,
          distance: Math.min(distance, 100)
        }));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullToRefresh.active && pullToRefresh.distance > 50) {
      refetchPosts();
    }
    setPullToRefresh({
      active: false,
      startY: 0,
      distance: 0
    });
  };

  // Ad click handler
  const handleAdClick = (adCampaign: AdCampaign) => {
    fetch(apiUrl('/api/ads/click'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: adCampaign.id,
        user_id: user?.id
      })
    }).catch(console.error);

    if (adCampaign.creative?.cta_url && adCampaign.creative.cta_url !== '#') {
      window.open(adCampaign.creative.cta_url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Advertisement',
        description: `This ad is from ${adCampaign.advertiser_name}`,
        duration: 2000,
      });
    }
  };

  // Ad info handler
  const handleAdInfo = (adCampaign: AdCampaign) => {
    toast({
      title: 'Advertisement Info',
      description: `This is a ${adCampaign.campaign_type.toUpperCase()} advertisement by ${adCampaign.advertiser_name}.`,
      duration: 3000,
    });
  };

  const handleCommentClick = () => {
    setShowCommentsOverlay(prev => !prev);
  };

  const handleCurrentShowChange = (index: number) => {
    setCurrentShowIndex(index);
  };

  // Loading state
  const renderVideoContainerSkeleton = () => (
    <div className="p-4">
      <Skeleton className="h-56 md:h-72 w-full rounded-lg" />
    </div>
  );

  const renderMomentsSkeleton = () => (
    <div className="p-4">
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );

  const renderCreatePostSkeleton = () => (
    <div className="p-4">
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );

  const renderPostCardSkeleton = () => (
    <div className="p-4 border-b">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );

  const renderReelsSkeleton = () => (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );

  const renderProductsSkeleton = () => (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-28 w-full rounded-md" />
      </div>
    </div>
  );

  const renderAdSkeleton = () => (
    <div className="p-4">
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );

  if (postsLoading && posts.length === 0) {
    return (
      <FeedSkeleton count={4} />
    );
  }

  // Fallback ad for when no campaigns are available
  const getFallbackAd = (batchIndex: number): AdCampaign => ({
    id: `fallback-ad-${batchIndex}`,
    name: 'Community Spotlight',
    advertiser_name: 'Our Community',
    bid_amount: 0.50,
    campaign_type: 'cpm',
    creative: {
      title: 'Welcome to Our Platform!',
      description: 'Discover amazing content from our community creators. Stay connected and explore!',
      cta_text: 'Explore More',
      cta_url: '#'
    }
  });

  // Render loading skeletons for reels
  const renderReelSkeleton = () => (
    <Skeleton className="aspect-[9/16] rounded-md" />
  );

  // Render loading skeletons for products
  const renderProductSkeleton = () => (
    <Skeleton className="w-[calc(33.333%-0.5rem)] min-w-[calc(33.333%-0.5rem)] flex-shrink-0 aspect-square rounded-lg" />
  );

  return (
    <div 
      ref={feedRef}
      className="w-full max-w-2xl mx-auto px-2 sm:px-0 overflow-x-hidden custom-scrollbar pb-28 md:pb-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div 
        className={`fixed top-0 left-0 right-0 flex justify-center pt-2 transition-all duration-300 ease-out ${
          pullToRefresh.active ? 'opacity-100' : 'opacity-0 pointer-events-none -translate-y-4'
        }`}
      >
        <div 
          className="flex items-center justify-center gap-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-full shadow-lg"
          style={{
            transform: `translateY(${Math.min(pullToRefresh.distance, 100)}px)`,
          }}
        >
          <div className={`transition-transform duration-300 ${pullToRefresh.distance > 50 ? 'rotate-180' : ''}`}>
            <ArrowDown className="h-5 w-5 text-gray-600" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {pullToRefresh.distance > 50 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      <div className="relative">
        <VideoContainer 
          shows={studioShows} 
          selectedShowId={studioShows[currentShowIndex]?.id}
          currentShowIndex={currentShowIndex}
          scheduleTransition={scheduleTransition}
          nextProgram={nextProgramIndex === null ? undefined : studioShows[nextProgramIndex]}
          onCurrentShowChange={handleCurrentShowChange}
          onCommentClick={handleCommentClick}
        />
      </div>

      <div className="mb-4 sm:mb-2" />

      {/* Comments overlay */}
      {showCommentsOverlay && (
        <div
          className="fixed inset-0 bg-black z-40"
          onClick={() => setShowCommentsOverlay(false)}
        />
      )}

      {/* Live comments overlay */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out
          ${showCommentsOverlay ? 'translate-y-0' : 'translate-y-full'}
          bg-black/95 backdrop-blur-xl rounded-t-2xl
        `}
        style={{ height: '70vh' }}
      >
        <LiveChat />
      </div>

      {reelsLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-2 mb-6">
          {[...Array(12)].map((_, i) => (
            <div key={i}>{renderReelSkeleton()}</div>
          ))}
        </div>
      )}

      <div className="mb-4" />
      <Moments />
      <div className="mb-4" />
      <CreatePost onPostCreated={handleNewPost} />
      
      {postsError && (
        <div className="mx-4 my-3 p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm">
          Failed to load posts. Pull down to refresh.
        </div>
      )}

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-gray-500 dark:text-gray-400 text-sm">No posts yet. Be the first to share something!</div>
          </div>
        ) : (
          <>
            {/* Fullscreen overlay for reels */}
            {fullscreenIndex !== null && reels[fullscreenIndex] && (
              <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="relative w-full max-w-3xl h-[90vh]">
                  <button className="absolute top-4 right-4 text-white p-2" onClick={() => setFullscreenIndex(null)}>Close</button>
                  <video
                    src={reels[fullscreenIndex].video_url}
                    controls
                    autoPlay
                    muted={false}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute left-4 bottom-4 text-white">
                    <div className="font-semibold">{reels[fullscreenIndex].user?.username || reels[fullscreenIndex].user?.first_name}</div>
                    <div className="text-sm">{reels[fullscreenIndex].caption}</div>
                  </div>
                </div>
              </div>
            )}
            
            {posts.map((post, idx) => (
              <React.Fragment key={post.id}>
                {/* Render the organic post */}
                <PostCard
                  post={{
                    ...post,
                    post_type: post.post_type || 'post',
                    user_id: post.user_id || '',
                    image_url: (post.post_type || 'post') !== 'repost' ? 
                      (post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : post.media_url) : 
                      undefined,
                    video_url: (post.post_type || 'post') !== 'repost' ? post.media_url : undefined,
                    media_urls: post.media_urls
                  } as any}
                  currentUser={user}
                  reactionCounts={postReactions[post.id]?.counts || {}}
                  userReaction={postReactions[post.id]?.userReaction || null}
                  onReact={(reactionType) => handleReact(post.id, reactionType)}
                  onComment={handleComment}
                  onRepost={handleRepost}
                  onShare={() => handleShare(post.id)}
                  onDeletePost={handleDeletePost}
                  onHidePost={handleHidePost}
                  showComments={!!openComments[post.id]}
                />

                {/* After every 6 organic posts insert Reels then an AD */}
                {(idx + 1) % 6 === 0 && (() => {
                  const batchIndex = Math.floor(idx / 6);
                  const reelsPerBatch = Math.min(12, Math.max(1, Math.ceil(reels.length / 2)));
                  const reelStart = reels.length > 0 ? (batchIndex * reelsPerBatch) % reels.length : 0;
                  const batchReels = Array.from(
                    { length: Math.min(reelsPerBatch, reels.length) },
                    (_, reelIndex) => reels[(reelStart + reelIndex) % reels.length]
                  );
                  const adCampaign = adCampaigns[batchIndex] || getFallbackAd(batchIndex);

                  // Reels block
                  const reelsBlock = reels.length > 0 ? (
                    <div key={`reels-${batchIndex}`} className="mb-4">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <div className="flex items-center gap-2">
                          <Video className="h-5 w-5 text-red-500" />
                          <span className="font-bold text-base">Shorts</span>
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">One-Studio</span>
                        </div>
                        <button onClick={() => navigate('/studio')} className="text-sm text-blue-500 font-medium">View All</button>
                      </div>

                      {/* Mobile: horizontal scroll */}
                      <div className="sm:hidden flex space-x-2 overflow-x-auto pb-2 px-2">
                        {batchReels.map((reel, i) => (
                          <div key={`m-${reel.id}-${i}`} className="w-28 flex-shrink-0 aspect-[9/16] rounded-lg overflow-hidden relative cursor-pointer active:scale-95 transition-transform" onClick={() => handleReelClick(reel, i)}>
                            <video 
                              id={reel.id} 
                              data-reel-preview
                              data-reel-id={reel.id}
                              src={reel.video_url} 
                              muted={true}
                              playsInline={true}
                              loop={true}
                              preload="none"
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                              {playingReelIds.includes(reel.id) ? (
                                <Pause className="h-3 w-3 text-white" />
                              ) : (
                                <Play className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="absolute bottom-2 left-2 right-2 text-white text-xs">
                              <div className="flex items-center justify-between">
                                <span>{reel.user?.username || 'User'}</span>
                                <span>{reel.duration || 30}s</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop: horizontal scroll */}
                      <div className="hidden sm:block">
                        <div className="flex space-x-2 overflow-x-auto pb-2 px-2">
                          {batchReels.map((reel, i) => (
                            <div key={`d-${reel.id}-${i}`} className="w-48 flex-shrink-0 aspect-[9/16] rounded-lg overflow-hidden relative cursor-pointer active:scale-95 transition-transform group" onClick={() => handleReelClick(reel, i)}>
                              <video 
                                id={reel.id} 
                                data-reel-preview
                                data-reel-id={reel.id}
                                src={reel.video_url} 
                                muted={true}
                                playsInline={true}
                                loop={true}
                                preload="none"
                                className="w-full h-full object-cover" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                                {playingReelIds.includes(reel.id) ? (
                                  <Pause className="h-3 w-3 text-white" />
                                ) : (
                                  <Play className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <div className="absolute bottom-2 left-2 right-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold truncate">{reel.user?.username || 'User'}</span>
                                  <span>{reel.duration || 30}s</span>
                                </div>
                                {reel.caption && (
                                  <p className="truncate text-xs mt-1">{reel.caption}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null;

                  // Products block after AD
                  const productsBlock = storeProducts.length > 0 ? (
                    <div key={`products-${batchIndex}`} className="mb-6">
                      <div className="flex items-center justify-between mb-3 px-2">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-5 w-5 text-blue-600" />
                          <span className="font-bold text-base">Products</span>
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">The Square</span>
                        </div>
                        <button onClick={() => navigate('/square')} className="text-sm text-blue-500 font-medium">
                          Browse All
                        </button>
                      </div>

                      {/* Products horizontal scroll */}
                      {productsLoading ? (
                        <div className="flex space-x-3 overflow-x-auto pb-4 px-2">
                          {[...Array(6)].map((_, i) => (
                            <div key={i}>{renderProductSkeleton()}</div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Mobile: Show 3 products per row */}
                          <div className="sm:hidden flex space-x-3 overflow-x-auto pb-4 px-2">
                            {storeProducts.slice(0, 6).map((product) => (
                              <div
                                key={product.id}
                                className="w-[calc(33.333%-0.5rem)] min-w-[calc(33.333%-0.5rem)] flex-shrink-0 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-95 active:opacity-90 transition-all border border-gray-100 dark:border-gray-700"
                                onClick={() => handleProductClick(product)}
                              >
                                {/* Product Image */}
                                <div className="relative aspect-square overflow-hidden">
                                  <img
                                    src={product.images && product.images.length > 0 
                                      ? product.images[0] 
                                      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
                                    }
                                    alt={product.title}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                  />
                                  {product.is_deals_of_day && (
                                    <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                      Deal of Day
                                    </div>
                                  )}
                                  {product.is_on_sale && (
                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                                      {product.sale_percentage ? `${product.sale_percentage}% OFF` : 'Sale'}
                                    </div>
                                  )}
                                </div>

                                {/* Product Info */}
                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {product.store?.store_name || 'Seller'}
                                    </span>
                                    {product.views && product.views > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-medium">{product.views}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <h3 className="font-semibold text-sm mb-1 truncate">{product.title}</h3>
                                  
                                  <div className="flex items-center gap-2">
                                    {product.is_on_sale && product.sale_price ? (
                                      <>
                                        <span className="font-bold text-red-600">{formatCurrency(product.sale_price, product.store?.base_currency)}</span>
                                        {product.original_price && (
                                          <span className="text-xs text-gray-500 line-through">{formatCurrency(product.original_price, product.store?.base_currency)}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="font-bold">{formatCurrency(product.price, product.store?.base_currency)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop: Show all products */}
                          <div className="hidden sm:flex space-x-4 overflow-x-auto pb-4 px-2">
                            {storeProducts.map((product) => (
                              <div
                                key={product.id}
                                className="w-44 flex-shrink-0 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-95 active:opacity-90 transition-all border border-gray-100 dark:border-gray-700"
                                onClick={() => handleProductClick(product)}
                              >
                                {/* Product Image */}
                                <div className="relative aspect-square overflow-hidden">
                                  <img
                                    src={product.images && product.images.length > 0 
                                      ? product.images[0] 
                                      : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
                                    }
                                    alt={product.title}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                  />
                                  {product.is_deals_of_day && (
                                    <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                      Deal of Day
                                    </div>
                                  )}
                                  {product.is_on_sale && (
                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                                      {product.sale_percentage ? `${product.sale_percentage}% OFF` : 'Sale'}
                                    </div>
                                  )}
                                </div>

                                {/* Product Info */}
                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {product.store?.store_name || 'Seller'}
                                    </span>
                                    {product.views && product.views > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs font-medium">{product.views} views</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <h3 className="font-semibold text-sm mb-1 truncate">{product.title}</h3>
                                  
                                  <div className="flex items-center gap-2">
                                    {product.is_on_sale && product.sale_price ? (
                                      <>
                                        <span className="font-bold text-red-600">{formatCurrency(product.sale_price, product.store?.base_currency)}</span>
                                        {product.original_price && (
                                          <span className="text-xs text-gray-500 line-through">{formatCurrency(product.original_price, product.store?.base_currency)}</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="font-bold">{formatCurrency(product.price, product.store?.base_currency)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null;

                  // Render reels -> AD -> products
                  return (
                    <div key={`slot-${batchIndex}`} className="space-y-4">
                      {reelsBlock}
                      
                      {/* AD Section - Mobile App Style */}
                      <div className="border-0 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-sm mx-2" key={`ad-${adCampaign.id}-${batchIndex}`}>
                        {/* Ad header */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold mr-3">
                                {adCampaign.advertiser_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{adCampaign.advertiser_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Sponsored</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleAdInfo(adCampaign)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Ad info">
                                <Info className="h-4 w-4 text-gray-500" />
                              </button>
                              <div className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                                Ad
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ad content */}
                        <div className="p-4">
                          <h3 className="font-bold text-base mb-2">{adCampaign.creative?.title || adCampaign.name}</h3>
                          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">{adCampaign.creative?.description || `Sponsored by ${adCampaign.advertiser_name}`}</p>
                          
                          {adCampaign.creative?.image_url && (
                            <div 
                              className="mb-4 rounded-xl overflow-hidden cursor-pointer active:opacity-90 transition-opacity"
                              onClick={() => handleAdClick(adCampaign)}
                            >
                              <img 
                                src={adCampaign.creative.image_url} 
                                alt={adCampaign.creative.title} 
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          )}
                          
                          {adCampaign.creative?.video_url && (
                            <div className="mb-4 rounded-xl overflow-hidden">
                              <video 
                                src={adCampaign.creative.video_url} 
                                className="w-full rounded-lg" 
                                controls 
                                playsInline
                              />
                            </div>
                          )}
                          
                          <button 
                            onClick={() => handleAdClick(adCampaign)} 
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3.5 px-6 rounded-xl active:opacity-90 active:scale-95 transition-all text-sm"
                          >
                            {adCampaign.creative?.cta_text || 'Learn More'} 
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Ad footer */}
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
                          <div className="flex justify-between items-center">
                            <span className="text-xs">Advertisement</span>
                            {adCampaign.id.includes('fallback') && (
                              <span className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">Demo Ad</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Products Section */}
                      {productsBlock}
                    </div>
                  );
                })()}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {/* ============================================ */}
{/* SIMPLE INFINITE SCROLL INDICATOR            */}
{/* ============================================ */}
<div 
  ref={loadMoreRef} 
  className="h-20 w-full flex items-center justify-center py-4"
>
  {isFetchingNextPage ? (
    // Loading animation
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
   
    </div>
  ) : hasNextPage ? (
    // Subtle indicator that there's more content
    <div className="text-center opacity-70">
      <svg className="w-5 h-5 mx-auto mb-1 text-gray-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      <span className="text-xs text-gray-500">Scroll for more</span>
    </div>
  ) : posts.length > 0 ? (
    // End of feed
    <div className="text-center text-gray-400">
      <div className="flex items-center justify-center gap-1 mb-1">
        <div className="w-1 h-1 rounded-full bg-current"></div>
        <div className="w-1 h-1 rounded-full bg-current"></div>
        <div className="w-1 h-1 rounded-full bg-current"></div>
      </div>
      <span className="text-sm">All posts loaded</span>
    </div>
  ) : null}
</div>

      {/* Reels Fullscreen Overlay */}
      {showReelsOverlay && selectedReel && (
        <>
          <div className="fixed inset-0 bg-black z-50">
            {/* Mobile app style top bar */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/90 to-transparent">
              <div className="flex itemscenter justify-between">
                <button
                  onClick={handleReelClose}
                  className="text-white bg-black/60 rounded-full p-2.5 active:scale-95 transition-transform"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-white text-center">
                  <h2 className="font-bold text-base">Reels</h2>
                  <p className="text-xs opacity-80">@{selectedReel.user?.username}</p>
                </div>
                <button className="text-white bg-black/60 rounded-full p-2.5 active:scale-95 transition-transform">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Video container */}
            <div className="absolute inset-0 flex items-center justify-center">
              <video
                src={selectedReel.video_url}
                autoPlay
                muted={mutedStates[selectedReel.id]}
                loop
                playsInline
                controls
                className="max-w-full max-h-full"
              />
            </div>

            {/* Mobile app style side controls */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-5">
              <button
                onClick={() => handleReelLike(selectedReel.id)}
                className="flex flex-col items-center text-white"
              >
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center active:scale-95 transition-transform">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
                <span className="text-xs mt-1 font-medium">{selectedReel.likes.toLocaleString()}</span>
              </button>

              <button
                onClick={(e) => handleReelShare(selectedReel.id, e)}
                className="flex flex-col items-center text-white"
              >
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center active:scale-95 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <span className="text-xs mt-1 font-medium">Share</span>
              </button>

              <button
                onClick={(e) => handleReelMute(selectedReel.id, e)}
                className="flex flex-col items-center text-white"
              >
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center active:scale-95 transition-transform">
                  {mutedStates[selectedReel.id] ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs mt-1 font-medium">Sound</span>
              </button>
            </div>

            {/* Mobile app style caption area */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-5 bg-gradient-to-t from-black/90 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <img
                    src={selectedReel.user?.avatar_url || '/default-avatar.png'}
                    alt={selectedReel.user?.username}
                    className="w-9 h-9 rounded-full border-2 border-white"
                  />
                  {selectedReel.user?.verified && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white text-sm">@{selectedReel.user?.username}</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    {selectedReel.user?.first_name} {selectedReel.user?.last_name}
                  </p>
                </div>
              </div>
              {selectedReel.caption && (
                <p className="text-white text-sm mb-2 leading-relaxed">{selectedReel.caption}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <span>{selectedReel.views.toLocaleString()} views</span>
                <span>•</span>
                <span>{selectedReel.duration}s</span>
              </div>
            </div>
          </div>
        </>
      )}

      {showRepostModal && selectedPost && (
        <RepostModal
          post={selectedPost as any}
          onClose={() => setShowRepostModal(false)}
          onRepost={handleRepostComplete}
        />
      )}
    </div>
  );
};

export default Feed;
