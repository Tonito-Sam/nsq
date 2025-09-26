import React, { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { CreatePost } from './CreatePost';
import { PostCard } from './PostCard';
import { Moments } from './Moments';
import { VideoContainer } from './VideoContainer';
import { RepostModal } from './RepostModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { ArrowDown, Loader2, ArrowUp, Heart, Send, HeartCrack, Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  avatar?: string;
  isModerator?: boolean;
  isVip?: boolean;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  post_type: string;
  media_url?: string;
  media_urls?: string[];
  voice_note_url?: string;
  voice_duration?: number;
  poll_options?: any;
  event_date?: string;
  event_location?: string;
  user_id: string;
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    verified?: boolean;
    heading?: string;
  };
  original_post?: {
    id: string;
    content: string;
    media_url?: string;
    media_urls?: string[];
    user?: {
      first_name?: string;
      last_name?: string;
      username?: string;
      avatar_url?: string;
    };
  };
}

// React Query keys
const QUERY_KEYS = {
  posts: ['posts'] as const,
  studioShows: ['studioShows'] as const,
  reactions: (postIds: string[]) => ['reactions', postIds] as const,
  comments: (postId: string) => ['comments', postId] as const,
} as const;

export const Feed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCommentsOverlay, setShowCommentsOverlay] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [likeCount, setLikeCount] = useState(88);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});
  
  const feedRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const [pullToRefresh, setPullToRefresh] = useState({
    active: false,
    startY: 0,
    distance: 0
  });

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
        .neq('post_type', 'moment')
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
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get all posts from pages
  const posts: Post[] = postsData?.pages.flatMap(page => page.posts) || [];

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
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
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
    onSuccess: () => {
      // Invalidate reactions query to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reactions(posts.map(p => p.id)) });
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
      // Optimistically remove from cache
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
    
    // Invalidate comments query for this post
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.comments(postId) });
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const handleNewPost = () => {
    // Invalidate posts query to refetch
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
      
      // Optimistically remove from cache
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

  // Chat functions
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      username: user?.user_metadata?.first_name || user?.email || 'Anonymous',
      message: newMessage,
      timestamp: new Date(),
      avatar: user?.user_metadata?.avatar_url,
      isModerator: false,
      isVip: false
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
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

  const currentShow = studioShows && studioShows.length > 0 ? studioShows[currentShowIndex] : null;

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
        <div className="p-4 text-white font-semibold border-b border-white/20 flex items-center justify-between">
          <span>Live Chat</span>
          {currentShow && (
            <span className="text-xs text-gray-300 font-normal">
              NOW SHOWING: <span className="font-semibold text-white">{currentShow.title}</span>
            </span>
          )}
        </div>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scroll-smooth p-4"
        >
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start space-x-2 group">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={msg.avatar} />
                <AvatarFallback className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  {msg.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span
                    className={`text-xs font-medium ${
                      msg.isModerator
                        ? 'text-green-600 dark:text-green-400'
                        : msg.isVip
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-200'
                    }`}
                  >
                    {msg.username}
                  </span>
                  {msg.isModerator && (
                    <Badge className="bg-green-500 text-white text-xs h-4 px-1">MOD</Badge>
                  )}
                  {msg.isVip && (
                    <Badge className="bg-purple-500 text-white text-xs h-4 px-1">VIP</Badge>
                  )}
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-white bg-white/10 rounded-lg px-3 py-1 inline-block max-w-[90%] break-words">
                  {msg.message}
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 mt-auto border-t border-white/20 p-4">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 p-0 text-gray-400 hover:text-pink-500 transition"
            onClick={() => setLikeCount(likeCount + 1)}
          >
            <Heart className="w-5 h-5 fill-current" />
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something..."
            className="flex-1 h-9 text-sm rounded-md shadow-sm"
            maxLength={200}
          />

          <Button type="submit" size="sm" className="h-9 px-3" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
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
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                image_url: post.post_type !== 'repost' ? (post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : post.media_url) : undefined,
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
              reactionIcons={[
                { type: 'like', icon: <Heart className="w-5 h-5" /> },
                { type: 'heart-break', icon: <HeartCrack className="w-5 h-5 text-red-500" /> },
                { type: 'crying', icon: <Frown className="w-5 h-5 text-blue-400" /> }
              ]}
            />
          ))
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