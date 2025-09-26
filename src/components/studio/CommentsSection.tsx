import React from 'react';
import { Button } from '@/components/ui/button';

interface Comment {
  id: string;
  user: { username: string; avatar_url?: string };
  comment: string;
  created_at: string;
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
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  show,
  onClose,
  comments,
  commentLoading,
  newComment,
  posting,
  userData,
  setNewComment,
  handlePostComment,
}) => {
  if (!show) return null;
  
  // More specific check for user authentication
  const userId = userData?.id || userData?.user_metadata?.id;
  const isAuthenticated = !!userId;
  
  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-end md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-lg relative animate-slideUp flex flex-col overflow-hidden"
        style={{ minHeight: '50vh', maxHeight: '75vh', marginBottom: '0px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 pb-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 cursor-pointer text-2xl"
            onClick={onClose}
          >
            ×
          </div>
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-3" />
          <h3 className="text-lg font-bold text-black dark:text-white text-center">
            Comments
          </h3>
        </div>
        {/* Comments Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {commentLoading ? (
            <div className="text-gray-500 text-center py-4">Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No comments yet.</div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <img
                    src={
                      c.user?.avatar_url ||
                      'https://api.dicebear.com/7.x/avataaars/svg?seed=' +
                        c.user?.username
                    }
                    alt={c.user?.username}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-black dark:text-white">
                      {c.user?.username || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(c.created_at).toLocaleString()}
                    </div>
                    <div className="text-base text-gray-800 dark:text-gray-200 break-words">
                      {c.comment}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Input Form */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div
            className="p-4 md:pb-4"
            style={{
              paddingBottom:
                'calc(16px + env(safe-area-inset-bottom) + 70px)'
            }}
          >
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-3 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={posting}
                  onKeyDown={e =>
                    e.key === 'Enter' &&
                    !posting &&
                    newComment.trim() &&
                    handlePostComment()
                  }
                />
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-3 rounded-full flex-shrink-0 min-w-[70px]"
                  onClick={handlePostComment}
                  disabled={posting || !newComment.trim()}
                >
                  {posting ? '...' : 'Post'}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-2">
                Log in to post a comment.
              </div>
            )}
          </div>
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
        @media (min-width: 768px) {
          .flex-shrink-0 > div {
            padding-bottom: 16px !important;
          }
        }
        @supports (height: 100dvh) {
          .mobile-modal {
            height: 100dvh;
          }
        }
      `}</style>
    </div>
  );
};

export default CommentsSection;