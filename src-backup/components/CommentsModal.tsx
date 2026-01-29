import React from 'react';
import { CommentItem } from './CommentItem';

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

interface CommentsModalProps {
  comments: Comment[];
  likedComments: Set<string>;
  onClose: () => void;
  onLike: (commentId: string) => void;
  onReply: (parentId: string, content: string) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  user: any;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  comments,
  likedComments,
  onClose,
  onLike,
  onReply,
  replyingTo,
  setReplyingTo,
  user
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 transition-opacity duration-300" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#161616] rounded-t-2xl shadow-xl p-4 max-h-[80vh] flex flex-col animate-slideUp">
        <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
        <div className="font-semibold text-center text-gray-900 dark:text-gray-100 mb-4">
          Comments ({comments.length})
        </div>
        
        <div className="flex-1 overflow-y-scroll space-y-4 pr-2 pb-8 custom-scrollbar">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              likedComments={likedComments}
              onLike={onLike}
              onReply={onReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              user={user}
            />
          ))}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};
