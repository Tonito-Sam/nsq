// CommentsSection.tsx - FIXED VERSION (input moved to top)
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  MessageCircle, 
  Tv, 
  Eye, 
  Heart, 
  X, 
  Reply,
  MoreVertical,
  Heart as HeartIcon,
  MoreHorizontal
} from 'lucide-react';
import { EMOJI_PICKER_LIST } from './emojiList';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CommentUser {
  username: string;
  avatar_url?: string;
  id?: string;
}

interface Comment {
  id: string;
  user_id: string;
  // Supabase may return nested `users` as an array; accept either shape
  user: CommentUser | CommentUser[];
  comment: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  replies_count?: number;
  replies?: Reply[];
}

interface Reply {
  id: string;
  user_id: string;
  user: CommentUser | CommentUser[];
  reply: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
}

interface CommentsSectionProps {
  show: boolean;
  onClose: () => void;
  comments: Comment[];
  commentLoading: boolean;
  newComment: string;
  posting: boolean;
  userData: any;
  setNewComment: (v: string) => void;
  handlePostComment: () => void;
  premieredDays?: number | null;
  premieredLabel?: string | null;
  viewerCount?: number;
  likeCount?: number;
  commentsCount?: number;
  videoId: string;
  onCommentsUpdate?: () => void;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  show,
  onClose,
  comments: initialComments,
  commentLoading,
  newComment,
  posting,
  userData,
  setNewComment,
  handlePostComment,
  premieredDays,
  premieredLabel,
  viewerCount,
  likeCount,
  commentsCount,
  videoId,
  onCommentsUpdate,
}) => {
  const { user } = useAuth();
  const currentUser: any = user || (userData && (userData.user || userData));
  if (!show) return null;
  
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [likingComment, setLikingComment] = useState<string | null>(null);
  
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const lastPostedTextRef = useRef<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  
  // Stop video and prevent outro when comments modal is open
  useEffect(() => {
    if (show) {
      // Add a class to body to prevent outro animations
      document.body.classList.add('comments-modal-open');
      
      // Dispatch a custom event to notify ReelCard to stop video
      const event = new CustomEvent('commentsModalOpened', { detail: true });
      window.dispatchEvent(event);
      
      // Focus the main input when modal opens
      setTimeout(() => {
        if (mainInputRef.current && user) {
          mainInputRef.current.focus();
        }
      }, 300);
      
      return () => {
        document.body.classList.remove('comments-modal-open');
        const closeEvent = new CustomEvent('commentsModalOpened', { detail: false });
        window.dispatchEvent(closeEvent);
      };
    }
  }, [show, user]);
  
  useLockBodyScroll(show);

  const normalizeUser = (maybeUser: any): CommentUser => {
    if (!maybeUser) return { username: 'User', avatar_url: undefined };
    
    let u = maybeUser;
    
    // Handle different data structures from Supabase
    if (Array.isArray(u)) {
      // Case 1: Array of users
      u = u[0] || {};
    } else if (u && typeof u === 'object') {
      // Case 2: Object with nested users array (from Supabase joins)
      if (u.users && Array.isArray(u.users)) {
        u = u.users[0] || {};
      }
      // Case 3: Object with direct user properties
      // u remains as is
    } else {
      return { username: 'User', avatar_url: undefined };
    }

    // Extract username from different possible field names
    const username = 
      u?.username || 
      u?.name || 
      u?.display_name || 
      ((u?.first_name || u?.last_name) ? 
        `${u.first_name || ''} ${u.last_name || ''}`.trim() : 
        'User');

    // Extract avatar from different possible field names
    const avatar_url = 
      u?.avatar_url || 
      u?.avatar || 
      u?.profile_image || 
      u?.image_url || 
      undefined;

    return { 
      username: username || 'User', 
      avatar_url,
      id: u?.id
    };
  };

  // Update comments when prop changes — normalize user shapes for consistent rendering
  useEffect(() => {
    try {
      const normalized = (initialComments || []).map((c: any) => {
        const normUser = normalizeUser(c.user ?? c.users);
        const replies = (c.replies || []).map((r: any) => ({
          ...r,
          user: normalizeUser(r.user ?? r.users)
        }));

        return {
          ...c,
          user: normUser,
          replies,
        } as Comment;
      });

      setComments(normalized);
    } catch (err) {
      setComments(initialComments);
    }
  }, [initialComments]);

  // Auto-focus reply input when replying
  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyingTo]);

  // Fetch comment likes status
  useEffect(() => {
    if (!user || !videoId || comments.length === 0) return;
    
    const fetchCommentLikes = async () => {
      try {
        const commentIds = comments.map(c => c.id);
        if (commentIds.length === 0) return;
        
        const { data: likes } = await supabase
          .from('studio_video_comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', user.id);
        
        if (likes) {
          const likedCommentIds = new Set(likes.map(l => l.comment_id));
          setComments(prev => prev.map(comment => ({
            ...comment,
            is_liked: likedCommentIds.has(comment.id)
          })));
        }
      } catch (error) {
        console.error('Error fetching comment likes:', error);
      }
    };
    
    fetchCommentLikes();
  }, [user, videoId, comments]);

  // Fetch replies for a comment
  const fetchReplies = async (commentId: string) => {
    if (!user || loadingReplies.has(commentId)) return;
    
    setLoadingReplies(prev => new Set(prev).add(commentId));
    
    try {
      // First fetch the replies with user data
      const { data: repliesData, error } = await supabase
        .from('studio_video_comment_replies')
        .select(`
          id,
          user_id,
          reply,
          created_at,
          users (
            id,
            username,
            avatar_url,
            first_name,
            last_name
          )
        `)
        .eq('comment_id', commentId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Process each reply
      const repliesWithLikes = await Promise.all(
        (repliesData || []).map(async (reply: any) => {
          // Get likes count
          const { count: likesCount } = await supabase
            .from('studio_video_comment_likes')
            .select('*', { count: 'exact', head: true })
            .eq('comment_id', reply.id);
          
          // Check if current user liked
          let isLiked = false;
          if (user) {
            const { data: userLike } = await supabase
              .from('studio_video_comment_likes')
              .select('id')
              .eq('comment_id', reply.id)
              .eq('user_id', user.id)
              .maybeSingle();
            isLiked = !!userLike;
          }
          
          // Normalize user data using our helper function
          const userData = normalizeUser(reply.users);
          
          return {
            ...reply,
            user: userData,
            likes_count: likesCount || 0,
            is_liked: isLiked
          };
        })
      );
      
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? { 
              ...comment, 
              replies: repliesWithLikes, 
              replies_count: repliesWithLikes.length 
            }
          : comment
      ));
      
      setExpandedReplies(prev => new Set(prev).add(commentId));
    } catch (error) {
      console.error('Error fetching replies:', error);
      console.error('Reply data structure:', error);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  // Toggle comment like
  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    
    setLikingComment(commentId);
    
    try {
      const comment = comments.find(c => c.id === commentId);
      const isLiked = comment?.is_liked;
      
      if (isLiked) {
        // Unlike
        await supabase
          .from('studio_video_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { 
                ...c, 
                is_liked: false, 
                likes_count: Math.max(0, (c.likes_count || 0) - 1) 
              }
            : c
        ));
      } else {
        // Like
        await supabase
          .from('studio_video_comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.id
          });
        
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { 
                ...c, 
                is_liked: true, 
                likes_count: (c.likes_count || 0) + 1 
              }
            : c
        ));
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    } finally {
      setLikingComment(null);
    }
  };

  // Toggle reply like
  const handleLikeReply = async (commentId: string, replyId: string) => {
    if (!user) return;
    
    try {
      const comment = comments.find(c => c.id === commentId);
      const reply = comment?.replies?.find(r => r.id === replyId);
      const isLiked = reply?.is_liked;
      
      if (isLiked) {
        // Unlike
        await supabase
          .from('studio_video_comment_likes')
          .delete()
          .eq('comment_id', replyId)
          .eq('user_id', user.id);
        
        setComments(prev => prev.map(c => {
          if (c.id !== commentId) return c;
          
          return {
            ...c,
            replies: c.replies?.map(r => {
              if (r.id !== replyId) return r;
              return { 
                ...r, 
                is_liked: false, 
                likes_count: Math.max(0, (r.likes_count || 0) - 1) 
              };
            })
          };
        }));
      } else {
        // Like
        await supabase
          .from('studio_video_comment_likes')
          .insert({
            comment_id: replyId,
            user_id: user.id
          });
        
        setComments(prev => prev.map(c => {
          if (c.id !== commentId) return c;
          
          return {
            ...c,
            replies: c.replies?.map(r => {
              if (r.id !== replyId) return r;
              return { 
                ...r, 
                is_liked: true, 
                likes_count: (r.likes_count || 0) + 1 
              };
            })
          };
        }));
      }
    } catch (error) {
      console.error('Error toggling reply like:', error);
    }
  };

  // Post a reply
  const handlePostReply = async (commentId: string) => {
    if (!user || !replyText.trim()) return;
    
    setPostingReply(true);
    
    try {
      const { data: newReplyData, error } = await supabase
        .from('studio_video_comment_replies')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          reply: replyText.trim()
        })
        .select(`
          id,
          user_id,
          reply,
          created_at,
          users (
            id,
            username,
            avatar_url,
            first_name,
            last_name
          )
        `)
        .single();
      
      if (error) throw error;
      
      // Normalize user data from the response
      const userData = normalizeUser(newReplyData.users);
      
      // Add the new reply to state
      const newReply: Reply = {
        id: newReplyData.id,
        user_id: newReplyData.user_id,
        user: userData,
        reply: newReplyData.reply,
        created_at: newReplyData.created_at,
        likes_count: 0,
        is_liked: false
      };
      
      setComments(prev => prev.map(comment => {
        if (comment.id !== commentId) return comment;
        
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply],
          replies_count: (comment.replies_count || 0) + 1
        };
      }));
      
      setReplyText('');
      setReplyingTo(null);
      
      // Call parent callback if provided
      if (onCommentsUpdate) {
        onCommentsUpdate();
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      console.error('Reply data:', error);
    } finally {
      setPostingReply(false);
    }
  };

  // Toggle replies visibility
  const toggleReplies = (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      fetchReplies(commentId);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Handle emoji picker
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (showEmojiPicker) {
        if (pickerRef.current && target && !pickerRef.current.contains(target) && openerRef.current && !openerRef.current.contains(target)) {
          setShowEmojiPicker(false);
        }
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (showEmojiPicker && openerRef.current) {
      const r = openerRef.current.getBoundingClientRect();
      const left = Math.max(8, r.left);
      const spaceBelow = window.innerHeight - r.bottom;
      const preferBelow = spaceBelow > 260;
      const top = preferBelow ? Math.max(8, r.bottom + 8) : Math.max(8, r.top - 260 - 8);
      setPickerPos({ left, top });
    } else {
      setPickerPos(null);
    }
  }, [showEmojiPicker]);

  // Scroll to bottom when new comments are added
  useEffect(() => {
    if (commentsContainerRef.current && !commentLoading) {
      const container = commentsContainerRef.current;
      // Only scroll if we're near the bottom or if it's a new comment
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom || replyingTo) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [comments, commentLoading, replyingTo]);

  // Handle main comment submission with Enter key
  const postCommentLocal = () => {
    if (!newComment.trim() || posting) return;
    lastPostedTextRef.current = newComment.trim();
    handlePostComment();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && newComment.trim() && !posting) {
      e.preventDefault();
      postCommentLocal();
    }
  };

  // After posting completes, if we captured a lastPostedText, append an optimistic comment
  useEffect(() => {
    if (!posting && lastPostedTextRef.current) {
      const text = lastPostedTextRef.current;
      lastPostedTextRef.current = null;
      const tempComment: Comment = {
        id: `temp-${Date.now()}`,
        user_id: currentUser?.id || '',
        user: normalizeUser(currentUser),
        comment: text,
        created_at: new Date().toISOString(),
        likes_count: 0,
        is_liked: false,
        replies_count: 0,
        replies: []
      };
      setComments(prev => [...prev, tempComment]);
      // Scroll to bottom after adding
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [posting]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center comments-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-slideUp"
        style={{ 
          height: '90vh',
          maxHeight: '90vh',
          marginBottom: '0px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex-shrink-0 p-4 pb-3 bg-white dark:bg-gray-900">
          <button
            aria-label="Close comments"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-3" />
          
          <h3 className="text-lg font-bold text-black dark:text-white text-center">
            Comments
          </h3>
          
          {/* Badges row */}
          <div className="mt-3 flex items-center justify-center gap-3">
            {typeof premieredDays !== 'undefined' && premieredDays !== null && (
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                <Tv className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
                <span className="font-medium text-yellow-700 dark:text-yellow-300">
                  {premieredDays === 0 ? 'today' : `${premieredDays}d`}
                </span>
              </div>
            )}
            
            {typeof viewerCount !== 'undefined' && (
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {(viewerCount || 0).toLocaleString()}
                </span>
              </div>
            )}
            
            {typeof likeCount !== 'undefined' && (
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                <Heart className="w-4 h-4 text-pink-600 dark:text-pink-300" />
                <span className="font-medium text-pink-700 dark:text-pink-300">
                  {likeCount ?? 0}
                </span>
              </div>
            )}
            
            {typeof commentsCount !== 'undefined' && (
              <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                <MessageCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {commentsCount ?? 0}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Comment Input - MOVED TO TOP */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {user || userData ? (
            <div className="relative">
              <button
                ref={openerRef}
                type="button"
                onClick={() => setShowEmojiPicker(v => !v)}
                className="absolute left-3 top-3 h-6 w-6 flex items-center justify-center text-lg z-10"
                aria-label="Emoji picker"
              >
                😊
              </button>

              <Input
                ref={mainInputRef}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment..."
                className="h-10 text-sm rounded-full pl-10 pr-12 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                maxLength={300}
                autoComplete="off"
                disabled={posting}
              />

              <button 
                onClick={postCommentLocal}
                disabled={!newComment.trim() || posting}
                className={cn(
                  "absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-full transition-all duration-200",
                  newComment.trim() 
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md" 
                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                )}
                aria-label="Send comment"
              >
                {posting ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>

              {showEmojiPicker && pickerPos && createPortal(
                <div 
                  ref={pickerRef} 
                  style={{ 
                    position: 'fixed', 
                    left: pickerPos.left, 
                    top: pickerPos.top, 
                    zIndex: 99999 
                  }} 
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-56"
                >
                  <div className="grid grid-cols-6 gap-2">
                    {EMOJI_PICKER_LIST.map((e: any, i: number) => (
                      <button
                        key={`${e.char}-${i}`}
                        type="button"
                        title={e.name}
                        onClick={() => {
                          setNewComment(newComment + e.char + ' ');
                          setShowEmojiPicker(false);
                          mainInputRef.current?.focus();
                        }}
                        className="p-1 text-lg rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {e.char}
                      </button>
                    ))}
                  </div>
                </div>,
                document.body
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Please log in to post a comment.
            </div>
          )}
          
          {user && newComment.trim() && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
              Press Enter to post
            </div>
          )}
        </div>

        {/* Comments Area - Now below the input */}
        <div 
          ref={commentsContainerRef}
          className="flex-1 overflow-y-auto px-4 pb-20 scrollbar-thin" // Added pb-20 for extra padding at bottom
        >
          {commentLoading ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">
              {user || userData ? 'No comments yet. Be the first to comment!' : 'No comments yet.'}
            </div>
          ) : (
            <div className="space-y-4 pt-2 pb-4">
              {comments.map((comment) => {
                const cUser = normalizeUser(comment.user);
                return (
                <div key={comment.id} className="space-y-2">
                  {/* Main Comment */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500">
                        {cUser?.avatar_url ? (
                          <img
                            src={cUser.avatar_url}
                            alt={cUser.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs font-semibold text-white">
                              {(cUser?.username || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Comment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-black dark:text-white">
                          {cUser?.username || 'User'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 break-words font-normal leading-relaxed mt-1">
                        {comment.comment}
                      </p>
                      
                      {/* Comment Actions */}
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          disabled={!user || likingComment === comment.id}
                          className={cn(
                            "flex items-center gap-1 text-xs transition",
                            comment.is_liked 
                              ? "text-pink-600 dark:text-pink-400" 
                              : "text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400"
                          )}
                        >
                          <HeartIcon className={cn(
                            "h-4 w-4",
                            comment.is_liked && "fill-current"
                          )} />
                          <span>{comment.likes_count || 0}</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            setReplyingTo(comment.id);
                            setReplyText('');
                          }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition"
                        >
                          <Reply className="h-4 w-4" />
                          <span>Reply</span>
                        </button>
                        
                        {(comment.replies_count || 0) > 0 && (
                          <button
                            onClick={() => toggleReplies(comment.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
                          >
                            {expandedReplies.has(comment.id) 
                              ? 'Hide replies' 
                              : `View ${comment.replies_count} ${comment.replies_count === 1 ? 'reply' : 'replies'}`
                            }
                            {loadingReplies.has(comment.id) && '...'}
                          </button>
                        )}
                      </div>
                      
                      {/* Reply Input (when replying to this comment) */}
                      {replyingTo === comment.id && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            ref={replyInputRef}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 text-sm h-8"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                                e.preventDefault();
                                handlePostReply(comment.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handlePostReply(comment.id)}
                            disabled={!replyText.trim() || postingReply}
                            className={cn(
                              "px-3 py-1.5 text-sm rounded-full",
                              replyText.trim()
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                            )}
                          >
                            {postingReply ? '...' : 'Post'}
                          </button>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Replies Section */}
                  {expandedReplies.has(comment.id) && comment.replies && comment.replies.length > 0 && (
                    <div className="ml-11 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                      {comment.replies.map((reply) => {
                        const rUser = normalizeUser(reply.user);
                        return (
                        <div key={reply.id} className="flex items-start gap-3">
                          {/* Reply Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-500">
                              {rUser?.avatar_url ? (
                                <img
                                  src={rUser.avatar_url}
                                  alt={rUser.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-[10px] font-semibold text-white">
                                    {(rUser?.username || 'U').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Reply Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-xs text-black dark:text-white">
                                {rUser?.username || 'User'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(reply.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 break-words font-normal leading-relaxed mt-1">
                              {reply.reply}
                            </p>
                            
                            {/* Reply Actions */}
                            <div className="flex items-center gap-4 mt-1">
                              <button
                                onClick={() => handleLikeReply(comment.id, reply.id)}
                                disabled={!user}
                                className={cn(
                                  "flex items-center gap-1 text-xs transition",
                                  reply.is_liked 
                                    ? "text-pink-600 dark:text-pink-400" 
                                    : "text-gray-500 hover:text-pink-600 dark:text-gray-400 dark:hover:text-pink-400"
                                )}
                              >
                                <HeartIcon className={cn(
                                  "h-3 w-3",
                                  reply.is_liked && "fill-current"
                                )} />
                                <span>{reply.likes_count || 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.35s cubic-bezier(0.4,0,0.2,1);
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #444;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
        
        /* Prevent outro overlay when comments modal is open */
        .comments-modal-open .fixed.inset-0.flex.flex-col.items-center.justify-center {
          display: none !important;
        }
        
        /* Ensure input is visible and above bottom nav */
        .comments-modal input:not(:disabled) {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Make sure modal sits above bottom navigation */
        .comments-modal {
          z-index: 100 !important;
        }
        
        /* Extra bottom padding to ensure content doesn't hide behind bottom nav */
        @media (max-height: 700px) {
          .comments-modal > div {
            height: 85vh !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CommentsSection;