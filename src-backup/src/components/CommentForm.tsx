import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  replies_count: number;
  user_id: string;
  parent_comment_id?: string;
  users?: {
    username: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
  };
  replies?: Comment[];
}

interface CommentFormProps {
  postId: string;
  onCommentAdded?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({ postId, onCommentAdded }) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [likedComments, setLikedComments] = useState(new Set<string>());
  const [showAllComments, setShowAllComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchComments();
    if (user) {
      fetchLikedComments();
    }
  }, [postId, user]);

  const fetchComments = async () => {
    try {
      // Fetch parent comments
      const { data: parentComments, error: parentError } = await supabase
        .from('comments')
        .select(`
          *,
          users (
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true });

      if (parentError) throw parentError;

      // Fetch replies for each parent comment
      const commentsWithReplies = await Promise.all(
        (parentComments || []).map(async (comment) => {
          const { data: replies, error: repliesError } = await supabase
            .from('comments')
            .select(`
              *,
              users (
                username,
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('parent_comment_id', comment.id)
            .order('created_at', { ascending: true });

          if (repliesError) {
            console.error('Error fetching replies:', repliesError);
            return { ...comment, replies: [], replies_count: 0 };
          }

          return {
            ...comment,
            replies: replies || [],
            replies_count: replies?.length || 0
          };
        })
      );

      setComments(commentsWithReplies);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchLikedComments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const likedSet = new Set(data?.map(like => like.comment_id) || []);
      setLikedComments(likedSet);
    } catch (error) {
      console.error('Error fetching liked comments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comment.trim()) return;

    setLoading(true);
    try {
      const { data: inserted, error } = await supabase
        .from('comments')
        .insert({
          content: comment.trim(),
          post_id: postId,
          user_id: user.id
        })
        .select('id')
        .single();

      if (error) throw error;

      try {
        await (supabase as any).rpc('increment_post_comments', {
          post_id: postId
        });
      } catch (updateError) {
        console.warn('Could not update comment count:', updateError);
      }

      setComment('');
      fetchComments();
      onCommentAdded?.();
      // Send notification to the post owner (if not self)
      (async () => {
        try {
          const { data: postData, error: postErr } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', postId)
            .single();
          if (!postErr && postData && postData.user_id && String(postData.user_id) !== String(user.id)) {
            await fetch('/api/notifications/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: postData.user_id,
                actor_id: user.id,
                type: 'comment',
                title: `${user.user_metadata?.first_name || user.email || 'Someone'} commented`,
                message: comment.trim().slice(0, 240),
                target_table: 'comments',
                action_id: inserted?.id || null,
                data: { comment_id: inserted?.id || null, post_id: postId }
              })
            }).catch(() => {});
          }
        } catch (e) {
          // ignore notification failures
          console.warn('comment notification failed', e);
        }
      })();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!user || !replyContent.trim()) return;

    setSubmittingReply(true);
    try {

      const { data: insertedReply, error } = await supabase
        .from('comments')
        .insert({
          content: replyContent.trim(),
          post_id: postId,
          user_id: user.id,
          parent_comment_id: parentId
        })
        .select('id, user_id, parent_comment_id')
        .single();

      if (error) throw error;

      setReplyContent('');
      setReplyingTo(null);
      fetchComments();
    
        // Send notification to post owner and optionally parent comment author
        (async () => {
          try {
            const { data: postData, error: postErr } = await supabase
              .from('posts')
              .select('user_id')
              .eq('id', postId)
              .single();

            if (!postErr && postData && postData.user_id && String(postData.user_id) !== String(user.id)) {
              await fetch('/api/notifications/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: postData.user_id,
                  actor_id: user.id,
                  type: 'comment',
                  title: `${user.user_metadata?.first_name || user.email || 'Someone'} replied`,
                  message: replyContent.trim().slice(0, 240),
                  target_table: 'comments',
                  action_id: insertedReply?.id || null,
                  data: { comment_id: insertedReply?.id || null, post_id: postId }
                })
              }).catch(() => {});
            }

            // Notify parent comment author (if exists and different from replier and post owner)
            if (insertedReply?.parent_comment_id) {
              try {
                const { data: parentComment } = await supabase
                  .from('comments')
                  .select('user_id')
                  .eq('id', insertedReply.parent_comment_id)
                  .single();
                if (parentComment && parentComment.user_id && String(parentComment.user_id) !== String(user.id)) {
                  await fetch('/api/notifications/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      user_id: parentComment.user_id,
                      actor_id: user.id,
                      type: 'reply',
                      title: `${user.user_metadata?.first_name || user.email || 'Someone'} replied to your comment`,
                      message: replyContent.trim().slice(0, 240),
                      target_table: 'comments',
                      action_id: insertedReply?.id || null,
                      data: { comment_id: insertedReply?.id || null, post_id: postId }
                    })
                  }).catch(() => {});
                }
              } catch (e) {
                // swallow
              }
            }
          } catch (e) {
            console.warn('reply notification failed', e);
          }
        })();
    } catch (error) {
      console.error('Error adding reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    try {
      const isLiked = likedComments.has(commentId);
      
      if (isLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('comment_id', commentId);

        if (error) throw error;

        setLikedComments(prev => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });

        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, likes_count: Math.max(0, comment.likes_count - 1) };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === commentId
                  ? { ...reply, likes_count: Math.max(0, reply.likes_count - 1) }
                  : reply
              )
            };
          }
          return comment;
        }));

        try {
          await (supabase as any).rpc('decrement_comment_likes', {
            comment_id: commentId
          });
        } catch (updateError) {
          console.warn('Could not update comment likes count:', updateError);
        }
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            user_id: user.id,
            comment_id: commentId
          });

        if (error) throw error;

        setLikedComments(prev => new Set([...prev, commentId]));

        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, likes_count: comment.likes_count + 1 };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map(reply =>
                reply.id === commentId
                  ? { ...reply, likes_count: reply.likes_count + 1 }
                  : reply
              )
            };
          }
          return comment;
        }));

        try {
          await (supabase as any).rpc('increment_comment_likes', {
            comment_id: commentId
          });
        } catch (updateError) {
          console.warn('Could not update comment likes count:', updateError);
        }
      }
    } catch (error) {
      console.error('Error handling comment like:', error);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`group ${isReply ? 'ml-8 mt-3' : ''}`}>
      <div className="flex space-x-3">
        <Avatar className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} ring-2 ring-transparent group-hover:ring-blue-100 dark:group-hover:ring-blue-900/30 transition-all duration-200`}>
          <AvatarImage src={comment.users?.avatar_url} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white font-medium">
            {comment.users?.first_name?.charAt(0) || comment.users?.username?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="relative bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group-hover:scale-[1.02] group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-purple-50 dark:group-hover:from-gray-800 dark:group-hover:to-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {comment.users?.first_name && comment.users?.last_name 
                  ? `${comment.users.first_name} ${comment.users.last_name}`
                  : comment.users?.username
                }
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{comment.content}</p>
          </div>
          
          <div className="flex items-center space-x-6 mt-3 ml-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleLikeComment(comment.id)}
              className={`flex items-center space-x-2 text-xs px-3 py-1.5 h-auto rounded-full transition-all duration-200 hover:scale-105 ${
                likedComments.has(comment.id)
                  ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                  : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${likedComments.has(comment.id) ? 'fill-current' : ''} transition-transform duration-200`} />
              <span className="font-medium">{comment.likes_count}</span>
            </Button>
            
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="flex items-center space-x-2 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 h-auto rounded-full transition-all duration-200 hover:scale-105 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="font-medium">Reply</span>
                {comment.replies_count > 0 && (
                  <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5 font-semibold">
                    {comment.replies_count}
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <div className="mt-4 animate-fade-in">
              <form onSubmit={(e) => handleReplySubmit(e, comment.id)} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex space-x-3">
                  <Avatar className="w-7 h-7 ring-2 ring-green-200 dark:ring-green-800">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white text-xs font-medium">
                      {user?.user_metadata?.first_name?.charAt(0) || user?.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      className="resize-none text-sm border-none bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 rounded-lg"
                      rows={2}
                    />
                    <div className="flex justify-end space-x-2 mt-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setReplyingTo(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        size="sm" 
                        disabled={submittingReply || !replyContent.trim()}
                        className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-1 rounded-full transition-all duration-200"
                      >
                        {submittingReply ? 'Replying...' : 'Reply'}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Replies */}
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleReplies(comment.id)}
                className="flex items-center space-x-2 text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 h-auto mb-3 rounded-full transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {expandedReplies.has(comment.id) ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span className="font-medium">
                  {expandedReplies.has(comment.id) ? 'Hide' : 'Show'} {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
                </span>
              </Button>
              
              {expandedReplies.has(comment.id) && (
                <div className="space-y-2 animate-fade-in">
                  {comment.replies.map((reply) => renderComment(reply, true))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 bg-white dark:bg-gray-900 rounded-xl p-4">
      {user && (
        <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex space-x-4">
              <Avatar className="w-10 h-10 ring-3 ring-purple-200 dark:ring-purple-800 shadow-lg">
                <AvatarImage src={user.user_metadata?.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white font-semibold">
                  {user.user_metadata?.first_name?.charAt(0) || user.email?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="resize-none border-none bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 rounded-xl shadow-sm text-sm placeholder:text-gray-500 transition-all duration-200"
                  rows={3}
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {comment.length}/500 characters
                  </span>
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={loading || !comment.trim()}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-2 rounded-full transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Posting...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Send className="h-4 w-4" />
                        <span>Comment</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {(!showAllComments ? comments.slice(0, 2) : comments).map((comment) => renderComment(comment))}
        
        {comments.length > 2 && !showAllComments && (
          <div className="text-center">
            <button
              className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 px-4 py-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={(e) => { e.preventDefault(); setShowAllComments(true); }}
            >
              View all {comments.length} comments
            </button>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {showAllComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" onClick={() => setShowAllComments(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-6 max-h-[85vh] flex flex-col animate-slideUp border-t border-gray-200 dark:border-gray-700">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Comments ({comments.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllComments(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-full p-2"
              >
                ✕
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {comments.map((comment) => renderComment(comment))}
              <div className="h-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
