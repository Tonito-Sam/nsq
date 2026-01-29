import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
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

interface CommentItemProps {
  comment: Comment;
  likedComments: Set<string>;
  onLike: (commentId: string) => void;
  onReply: (parentId: string, content: string) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  user: any;
  isReply?: boolean;
  showReplies?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  likedComments,
  onLike,
  onReply,
  replyingTo,
  setReplyingTo,
  user,
  isReply = false,
  showReplies = true
}) => {
  const [replyContent, setReplyContent] = useState('');
  const [showRepliesExpanded, setShowRepliesExpanded] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      await onReply(comment.id, replyContent);
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className={`${isReply ? 'ml-8' : ''}`}>
      <div className="flex space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.users?.avatar_url} />
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm">
            {comment.users?.first_name?.charAt(0) || comment.users?.username?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-sm">
                {comment.users?.first_name && comment.users?.last_name 
                  ? `${comment.users.first_name} ${comment.users.last_name}`
                  : comment.users?.username
                }
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-900 dark:text-gray-100">{comment.content}</p>
          </div>
          
          <div className="flex items-center space-x-4 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(comment.id)}
              className={`flex items-center space-x-1 text-xs px-2 py-1 h-auto ${
                likedComments.has(comment.id)
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-gray-500 hover:text-red-500'
              }`}
            >
              <Heart className={`h-3 w-3 ${likedComments.has(comment.id) ? 'fill-current' : ''}`} />
              <span>{comment.likes_count}</span>
            </Button>
            
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-500 px-2 py-1 h-auto"
              >
                <MessageCircle className="h-3 w-3" />
                <span>Reply</span>
                {comment.replies_count > 0 && (
                  <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                    {comment.replies_count}
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <form onSubmit={handleReplySubmit} className="mt-3">
              <div className="flex space-x-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs">
                    {user.user_metadata?.first_name?.charAt(0) || user.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    className="resize-none text-sm"
                    rows={2}
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setReplyingTo(null)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={submittingReply || !replyContent.trim()}
                    >
                      {submittingReply ? 'Replying...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Replies */}
          {showReplies && comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRepliesExpanded(!showRepliesExpanded)}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-500 px-2 py-1 h-auto mb-2"
              >
                {showRepliesExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span>
                  {showRepliesExpanded ? 'Hide' : 'Show'} {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
                </span>
              </Button>
              
              {showRepliesExpanded && (
                <div className="space-y-3">
                  {comment.replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      likedComments={likedComments}
                      onLike={onLike}
                      onReply={onReply}
                      replyingTo={replyingTo}
                      setReplyingTo={setReplyingTo}
                      user={user}
                      isReply={true}
                      showReplies={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
