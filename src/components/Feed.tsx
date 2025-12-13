import React, { useState, useRef, useEffect } from 'react';
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
import { ArrowDown, Loader2, ArrowUp, ExternalLink, Info } from 'lucide-react';
import { LiveChat } from './LiveChat';

interface Post {
  id: string;
  content?: string;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  reposts_count?: number;
  post_type?: string;
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

const Feed: React.FC = () => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const [pullToRefresh, setPullToRefresh] = useState({
    active: false,
    startY: 0,
    distance: 0
  });
  
  const queryClient = useQueryClient();
  const { user } = useAuth() as any;
  const feedRef = useRef<HTMLDivElement>(null);
  const [adCampaigns, setAdCampaigns] = useState<Record<number, AdCampaign | null>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [showCommentsOverlay, setShowCommentsOverlay] = useState(false);
  
  const QUERY_KEYS = {
    posts: ['posts'],
    studioShows: ['studioShows'],
    reactions: (ids: string[]) => ['reactions', ids],
    comments: (postId: string) => ['comments', postId]
  } as const;

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

  // Infinite query for posts with optimal caching
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
  } = useInfiniteQuery({
    queryKey: QUERY_KEYS.posts,
    queryFn: async ({ pageParam = 0 }) => {
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
          is_custom_special_day,
          moment_special_id,
          share_to_feed,
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
        .order('created_at', { ascending: false })
        .range(pageParam * 10, (pageParam + 1) * 10 - 1);

      if (error) throw error;

      // Process posts with comment counts and original posts
      const processedPosts = await Promise.all(
        (data || []).map(async (post) => {
          // Get actual comment count
          const { count: commentCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          
          const processedPost = { 
            ...processPostMediaUrls(post), 
            comments_count: commentCount || 0 
          };
          
          // Handle reposts
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
        nextPage: data && data.length === 10 ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Query for studio shows with caching
  const { data: studioShows = [] } = useQuery({
    queryKey: QUERY_KEYS.studioShows,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_shows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Get all posts from pages
  const posts: Post[] = postsData?.pages.flatMap(page => page.posts) || [];

  // Fetch ad campaigns from campaigns table
  useEffect(() => {
    let mounted = true;
    
    // Calculate how many batches we need (every 6 posts)
    const requiredBatches = Math.max(0, Math.floor(posts.length / 6));
    
    const fetchForBatch = async (batchIndex: number) => {
      // Don't fetch if we already have an ad campaign for this batch
      if (adCampaigns[batchIndex]) return;
      
      try {
        console.log(`Fetching ad campaign for batch ${batchIndex}`);
        
        // Fetch ad campaign from API (use apiUrl helper so production can set VITE_API_BASE_URL)
        const uid = user?.id;
        const endpoint = apiUrl(`/api/ads/serve${uid ? `?user_id=${uid}` : ''}`);
        const resp = await fetch(endpoint);
        
        if (!resp.ok) {
          console.warn(`Failed to fetch ad campaign for batch ${batchIndex}:`, resp.status);
          return;
        }
        
        // Check if response is empty
        const text = await resp.text();
        if (!text || text.trim() === '') {
          console.warn(`Empty response for batch ${batchIndex}`);
          return;
        }
        
        const j = JSON.parse(text);
        console.log('Ad API response for batch', batchIndex, ':', j);
        
        // Check if response has the expected structure
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
        // Don't throw, just log the error
      }
    };

    // Fetch ads for all required batches
    for (let i = 0; i < requiredBatches; i++) {
      if (!adCampaigns[i]) {
        fetchForBatch(i);
      }
    }

    return () => { mounted = false; };
  }, [posts.length, user?.id, adCampaigns]);

  // Debug logging for ads
  useEffect(() => {
    console.log('=== AD SYSTEM DEBUG ===');
    console.log('Total organic posts:', posts.length);
    console.log('Ad campaigns in state:', Object.keys(adCampaigns).length);
    console.log('Batches needed:', Math.floor(posts.length / 6));
    
    // Check each batch
    const totalBatches = Math.floor(posts.length / 6);
    for (let i = 0; i < totalBatches; i++) {
      const ad = adCampaigns[i];
      console.log(`Batch ${i}:`, ad ? `Has ad (${ad.advertiser_name})` : 'No ad');
    }
    
    console.log('=== END DEBUG ===');
  }, [adCampaigns, posts.length]);

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

  // Infinite scroll implementation with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Event handlers
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
    // Track ad click
    fetch(apiUrl('/api/ads/click'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: adCampaign.id,
        user_id: user?.id
      })
    }).catch(console.error);

    // Open ad URL in new tab
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
  if (postsLoading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
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

  return (
    <div 
      ref={feedRef}
      className="w-full max-w-2xl mx-auto px-2 sm:px-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div 
        className={`fixed top-0 left-0 right-0 flex justify-center pt-2 transition-opacity duration-300 ${
          pullToRefresh.active ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div 
          className={`w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center transition-transform ${
            pullToRefresh.distance > 50 ? 'rotate-180' : ''
          }`}
          style={{
            transform: `translateY(${pullToRefresh.distance}px) rotate(${pullToRefresh.distance > 50 ? 180 : 0}deg)`
          }}
        >
          <ArrowDown className="h-5 w-5" />
        </div>
      </div>

      <div className="relative">
        <VideoContainer 
          shows={studioShows} 
          currentShowIndex={currentShowIndex}
          onCurrentShowChange={handleCurrentShowChange}
          onCommentClick={handleCommentClick}
        />
      </div>

      <div className="mb-4 sm:mb-2" />

      {/* Comments overlay */}
      {showCommentsOverlay && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setShowCommentsOverlay(false)}
        />
      )}

      {/* Live comments overlay */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out
          ${showCommentsOverlay ? 'translate-y-0' : 'translate-y-full'}
          bg-black/90 backdrop-blur-lg rounded-t-xl
        `}
        style={{ height: '70vh' }}
      >
        <LiveChat />
      </div>

      <div className="mb-4" />
      <Moments />
      <div className="mb-4" />
      <CreatePost onPostCreated={handleNewPost} />
      
      {postsError && (
        <div className="p-4 mb-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          Failed to load posts. Please try again.
        </div>
      )}

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400">No posts yet. Be the first to share something!</div>
          </div>
        ) : (
          <>
            {posts.map((post, idx) => (
              <React.Fragment key={post.id}>
                {/* Render the organic post */}
                <PostCard
                  post={{
                    ...post,
                    image_url: post.post_type !== 'repost' ? 
                      (post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : post.media_url) : 
                      undefined,
                    video_url: post.post_type !== 'repost' ? post.media_url : undefined,
                    media_urls: post.media_urls
                  }}
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

                {/* After every 6 organic posts insert an AD */}
                {(idx + 1) % 6 === 0 && (() => {
                  const batchIndex = Math.floor(idx / 6);
                  const adCampaign = adCampaigns[batchIndex] || getFallbackAd(batchIndex);
                  
                  // Render the AD component
                  return (
                    <div key={`ad-${adCampaign.id}-${batchIndex}`} className="border rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 shadow-lg">
                      {/* Ad header */}
                      <div className="p-4 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold mr-3">
                              {adCampaign.advertiser_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold">{adCampaign.advertiser_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Sponsored • {adCampaign.campaign_type.toUpperCase()}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleAdInfo(adCampaign)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                              title="Ad info"
                            >
                              <Info className="h-4 w-4 text-gray-500" />
                            </button>
                            <div className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              Ad
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ad content */}
                      <div className="p-4">
                        <h3 className="font-bold text-lg mb-2">{adCampaign.creative?.title || adCampaign.name}</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">{adCampaign.creative?.description || `Sponsored by ${adCampaign.advertiser_name}`}</p>
                        
                        {adCampaign.creative?.image_url && (
                          <div className="mb-4 rounded-lg overflow-hidden cursor-pointer" onClick={() => handleAdClick(adCampaign)}>
                            <img 
                              src={adCampaign.creative.image_url} 
                              alt={adCampaign.creative.title}
                              className="w-full h-auto max-h-96 object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        
                        {adCampaign.creative?.video_url && (
                          <div className="mb-4 rounded-lg overflow-hidden">
                            <video 
                              src={adCampaign.creative.video_url}
                              className="w-full rounded-lg"
                              controls
                              playsInline
                            />
                          </div>
                        )}
                        
                        {/* Call to Action button */}
                        <button
                          onClick={() => handleAdClick(adCampaign)}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          {adCampaign.creative?.cta_text || 'Learn More'}
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Ad footer */}
                      <div className="px-4 py-3 border-t text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex justify-between items-center">
                          <span>Advertisement</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">💰 Bid: ${adCampaign.bid_amount.toFixed(2)}</span>
                            {adCampaign.id.includes('fallback') && (
                              <span className="text-xs text-orange-600">Demo Ad</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      {/* Infinite scroll trigger element */}
      <div ref={loadMoreRef} className="h-2 w-full" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}

      {!hasNextPage && posts.length > 0 && (
        <div className="flex flex-col items-center gap-2 py-4 text-gray-500 dark:text-gray-400">
          <span>You're all squared up...</span>
          <button
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline focus:outline-none"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      )}

      {showRepostModal && selectedPost && (
        <RepostModal
          post={selectedPost}
          onClose={() => setShowRepostModal(false)}
          onRepost={handleRepostComplete}
        />
      )}
    </div>
  );
};

export default Feed;