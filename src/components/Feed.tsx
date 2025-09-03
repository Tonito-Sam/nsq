import React, { useState, useEffect, useRef } from 'react';
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

export const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCommentsOverlay, setShowCommentsOverlay] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [likeCount, setLikeCount] = useState(88);
  const [studioShows, setStudioShows] = useState<StudioShow[]>([]);
  const [currentShowIndex, setCurrentShowIndex] = useState(0); // Track current show index
  
  const feedRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [pullToRefresh, setPullToRefresh] = useState({
    active: false,
    startY: 0,
    distance: 0
  });
  const [postReactions, setPostReactions] = useState<{[postId: string]: { counts: {[type: string]: number}, userReaction: string | null }}>({});
  const [openComments, setOpenComments] = useState<{ [postId: string]: boolean }>({});
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyToCommentPostId, setReplyToCommentPostId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  // Helper function to format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle chat scroll
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const threshold = 80;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    // You can use this for auto-scroll logic if needed
  };

  // Handle send message
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

  // Fetch studio shows from database
  const fetchStudioShows = async () => {
    try {
      const { data, error } = await supabase
        .from('studio_shows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching studio shows:', error);
        return;
      }

      setStudioShows(data || []);
    } catch (err) {
      console.error('Failed to fetch studio shows:', err);
    }
  };

  const fetchReactionsForPosts = async (postsList: Post[]) => {
    if (!user?.id) return;
    const postIds = postsList.map(p => p.id);
    if (postIds.length === 0) return;

    const { data: reactions, error: reactionsError } = await supabase
      .from('likes')
      .select('post_id, reaction_type, user_id')
      .in('post_id', postIds);

    if (reactionsError) {
      console.error('Error fetching reactions:', reactionsError);
      return;
    }

    const reactionsByPost: {[postId: string]: { counts: {[type: string]: number}, userReaction: string | null }} = {};
    postsList.forEach(post => {
      reactionsByPost[post.id] = { counts: {}, userReaction: null };
    });

    (reactions || []).forEach(r => {
      if (!r.post_id || !r.reaction_type) return;
      if (!reactionsByPost[r.post_id]) reactionsByPost[r.post_id] = { counts: {}, userReaction: null };
      reactionsByPost[r.post_id].counts[r.reaction_type] = (reactionsByPost[r.post_id].counts[r.reaction_type] || 0) + 1;
      if (r.user_id === user.id) reactionsByPost[r.post_id].userReaction = r.reaction_type;
    });

    setPostReactions(reactionsByPost);
  };

  // Helper to parse/normalize media_urls on all posts
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

  // Updated fetchPosts to ensure comments_count is properly fetched and updated
  const fetchPosts = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error: fetchError, count } = await supabase
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
        .limit(refresh ? 10 : posts.length + 10);

      if (fetchError) throw fetchError;
      
      // Fetch actual comment counts for each post
      const postsWithCommentCounts = await Promise.all(
        (data || []).map(async (post) => {
          const { count: commentCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          
          return {
            ...post,
            comments_count: commentCount || 0
          };
        })
      );
      
      const postsWithOriginal = await Promise.all(
        postsWithCommentCounts.map(async (post) => {
          const processedPost = processPostMediaUrls(post);
          
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

      setPosts(postsWithOriginal);
      setHasMore((count || 0) > postsWithOriginal.length);
      setError(null);
      await fetchReactionsForPosts(postsWithOriginal);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!loadingMore && hasMore) {
      try {
        setLoadingMore(true);
        const { data, error: fetchError, count } = await supabase
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
          .range(posts.length, posts.length + 9);

        if (fetchError) throw fetchError;
        
        const newPosts = await Promise.all(
          (data || []).map(async (post) => {
            const processedPost = processPostMediaUrls(post);
            
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

        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPosts];
        });

        setHasMore((count || 0) > posts.length + newPosts.length);
        await fetchReactionsForPosts(newPosts);
      } catch (err) {
        console.error('Error loading more posts:', err);
        setError('Failed to load more posts. Please try again.');
      } finally {
        setLoadingMore(false);
      }
    }
  };

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
      fetchPosts(true);
    }
    setPullToRefresh({
      active: false,
      startY: 0,
      distance: 0
    });
  };

  useEffect(() => {
    fetchPosts();
    fetchStudioShows();

    // Live update for comments_count using Supabase subscription
    const commentsSubscription = supabase
      .channel('comments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        const postId = payload.new?.post_id || payload.old?.post_id;
        if (postId) {
          handleCommentCreated(postId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(commentsSubscription);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
        !loadingMore && 
        hasMore
      ) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, posts.length]);

  const handleNewPost = () => {
    fetchPosts(true);
  };

  const handleReact = async (postId: string, reactionType: string) => {
    if (!user?.id) return;
    // Optimistically update UI
    setPostReactions(prev => ({
      ...prev,
      [postId]: {
        counts: {
          ...(prev[postId]?.counts || {}),
          [reactionType]: ((prev[postId]?.counts?.[reactionType] || 0) + 1)
        },
        userReaction: reactionType
      }
    }));
    try {
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
      // Re-fetch to ensure backend is in sync
      await fetchReactionsForPosts(posts.filter(p => p.id === postId));
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  // Update handleComment to refresh comment count when comments are opened/closed
  const handleComment = async (postId: string) => {
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    
    // Refresh comment count for this specific post
    try {
      const { count: commentCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, comments_count: commentCount || 0 }
          : post
      ));
    } catch (error) {
      console.error('Error updating comment count:', error);
    }
  };

  // Add a function to handle when a new comment is created
  const handleCommentCreated = async (postId: string) => {
    try {
      const { count: commentCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, comments_count: commentCount || 0 }
          : post
      ));
    } catch (error) {
      console.error('Error updating comment count after creation:', error);
    }
  };

  // Handle reply to comment
  const handleReplyToComment = async (commentId: string, postId: string) => {
    if (!replyMessage.trim()) return;
    try {
      await supabase.from('comments').insert({
        post_id: postId,
        parent_comment_id: commentId,
        user_id: user.id,
        content: replyMessage
      });
      setReplyMessage('');
      setReplyToCommentId(null);
      setReplyToCommentPostId(null);
      handleCommentCreated(postId);
    } catch (error) {
      console.error('Error replying to comment:', error);
    }
  };

  const handleRepost = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setShowRepostModal(true);
    }
  };

  const handleRepostComplete = async () => {
    setShowRepostModal(false);
    setSelectedPost(null);
    
    if (!user?.id) return;
    
    if (selectedPost && selectedPost.user_id !== user.id) {
      try {
        await supabase.rpc('create_notification', {
          target_user_id: selectedPost.user_id,
          notification_type: 'repost',
          notification_title: 'Post Echoed',
          notification_message: `${user.user_metadata?.first_name || user.email} echoed your post`,
          notification_data: { postId: selectedPost.id, userId: user.id }
        });
      } catch (error) {
        console.error('Error creating repost notification:', error);
      }
    }
    
    fetchPosts(true);
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Copied!', description: 'Post URL copied to clipboard.' });
    });
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) {
        toast({ title: 'Error', description: 'Failed to delete post.' });
      } else {
        toast({ title: 'Deleted', description: 'Post deleted successfully.' });
        setPosts(prev => prev.filter(post => post.id !== postId));
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete post.' });
    }
  };

  const handleHidePost = async (postId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('hidden_posts').upsert({
        user_id: user.id,
        post_id: postId
      }, { onConflict: 'user_id,post_id' });
      if (error) {
        toast({ title: 'Error', description: 'Failed to hide post.' });
      } else {
        toast({ title: 'Hidden', description: 'Post hidden from your feed.' });
        setPosts(prev => prev.filter(post => post.id !== postId));
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to hide post.' });
    }
  };


  // Get current show and stats
  const currentShow = studioShows && studioShows.length > 0 ? studioShows[currentShowIndex] : null;
  // These would be fetched from backend per show in a real app
  const watching = currentShow ? (currentShow.is_live ? 1247 : 0) : 0;
  const likes = currentShow ? 88 : 0;
  const comments = currentShow ? 0 : 0;

  const handleLike = () => {
    // Implement your like logic here
  };

  const handleCommentClick = () => {
    setShowCommentsOverlay((prev) => !prev);
  };

  // Handler to sync current show from VideoContainer
  const handleCurrentShowChange = (index: number) => {
    setCurrentShowIndex(index);
  };

  return (
    <div 
      ref={feedRef}
      className="w-full max-w-2xl mx-auto px-2 sm:px-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
        {/* MobileOverlayBar removed: overlay now handled in VideoContainer */}
      </div>
      {/* Reduced margin to close gap between VideoContainer and Moments */}
      <div className="mb-4 sm:mb-2" />

      {/* Dimmed background to close overlay when clicking outside */}
      {showCommentsOverlay && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setShowCommentsOverlay(false)}
        />
      )}

      {/* Slide-up Live Comments Overlay */}
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
            <span className="text-xs text-gray-300 font-normal">NOW SHOWING: <span className="font-semibold text-white">{currentShow.title}</span></span>
          )}
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
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

        {/* Input Field with Like and Send */}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 mt-auto border-t border-white/20 p-4">
          {/* Like Button */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 p-0 text-gray-400 hover:text-pink-500 transition"
            onClick={() => setLikeCount(likeCount + 1)}
          >
            <Heart className="w-5 h-5 fill-current" />
          </Button>

          {/* Message Input */}
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Say something..."
            className="flex-1 h-9 text-sm rounded-md shadow-sm"
            maxLength={200}
          />

          {/* Send Button */}
          <Button type="submit" size="sm" className="h-9 px-3" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="mb-4" />
      <div className="mb-4" />
    
      <Moments />
      <div className="mb-4" />
      <CreatePost onPostCreated={handleNewPost} />
      
      {error && (
        <div className="p-4 mb-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      {(loading || refreshing) && posts.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
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
              onLike={handleReact}
              onComment={handleComment}
              onRepost={handleRepost}
              onShare={() => handleShare(post.id)}
              onDeletePost={handleDeletePost}
              onHidePost={handleHidePost}
              showComments={!!openComments[post.id]}
              onCommentCreated={() => handleCommentCreated(post.id)}
              reactionIcons={[
                { type: 'like', icon: <Heart className="w-5 h-5" /> },
                { type: 'heart-break', icon: <HeartCrack className="w-5 h-5 text-red-500" /> },
                { type: 'crying', icon: <Frown className="w-5 h-5 text-blue-400" /> }
              ]}
              onReplyToComment={(commentId: string) => {
                setReplyToCommentId(commentId);
                setReplyToCommentPostId(post.id);
              }}
            />
            ))
          )}
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
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

      {/* Reply to comment form (example, should be rendered inside comments UI) */}
      {replyToCommentId && replyToCommentPostId && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleReplyToComment(replyToCommentId, replyToCommentPostId);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={replyMessage}
              onChange={e => setReplyMessage(e.target.value)}
              placeholder="Reply to comment..."
              className="flex-1"
              maxLength={200}
            />
            <Button type="submit" disabled={!replyMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setReplyToCommentId(null); setReplyToCommentPostId(null); }}>
              Cancel
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
