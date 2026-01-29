import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
// Button import removed (not used here) to avoid unused import warning
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, Tv, Eye, Heart } from 'lucide-react';
import { EMOJI_PICKER_LIST } from './emojiList';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

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
  // optional badge/meta info
  premieredDays?: number | null;
  premieredLabel?: string | null;
  viewerCount?: number;
  likeCount?: number;
  commentsCount?: number;
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
  premieredDays,
  premieredLabel,
  viewerCount,
  likeCount,
  commentsCount,
}) => {
  if (!show) return null;
  
  // More specific check for user authentication
  const userId = userData?.id || userData?.user_metadata?.id;
  const isAuthenticated = !!userId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

  // Use the reusable scroll-lock hook while the modal is visible
  useLockBodyScroll(show);

  // Emoji list imported from local module
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

  // compute portal position when openerRef set and picker opens - prefer dropdown below button
  useEffect(() => {
    if (showEmojiPicker && openerRef.current) {
      const r = openerRef.current.getBoundingClientRect();
      const left = Math.max(8, r.left);
      // prefer below the button; if not enough space below, place above
      const spaceBelow = window.innerHeight - r.bottom;
      const preferBelow = spaceBelow > 260; // picker height ~220-260
      const top = preferBelow ? Math.max(8, r.bottom + 8) : Math.max(8, r.top - 260 - 8);
      setPickerPos({ left, top });
    } else {
      setPickerPos(null);
    }
  }, [showEmojiPicker]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-end md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-lg relative animate-slideUp flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh', marginBottom: '0px', display: 'flex', flexDirection: 'column' }}
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
            {/* badges row - optional meta passed from parent */}
            <div className="mt-3 flex items-center justify-center gap-3">
              {typeof premieredDays !== 'undefined' && premieredDays !== null && (
                <div title={premieredLabel || ''} className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                  <Tv className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
                  <span className="font-medium text-yellow-700 dark:text-yellow-300">{premieredDays === 0 ? 'today' : `${premieredDays}d`}</span>
                </div>
              )}
              {typeof viewerCount !== 'undefined' && (
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                  <Eye className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">{(viewerCount || 0).toLocaleString()}</span>
                </div>
              )}
              {typeof likeCount !== 'undefined' && (
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                  <Heart className="w-4 h-4 text-pink-600 dark:text-pink-300" />
                  <span className="font-medium text-pink-700 dark:text-pink-300">{likeCount ?? 0}</span>
                </div>
              )}
              {typeof commentsCount !== 'undefined' && (
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-md text-xs">
                  <MessageCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                  <span className="font-medium text-indigo-700 dark:text-indigo-300">{commentsCount ?? 0}</span>
                </div>
              )}
            </div>
        </div>
  {/* Input Form - fixed/sticky at top (below header) so it's always visible before the chats */}
  <div
    className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full"
    style={{
      position: 'sticky',
      top: '56px',
      zIndex: 50,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      backdropFilter: 'blur(6px)'
    }}
  >
        <div className="p-0">
      {isAuthenticated ? (
        <form onSubmit={(e) => { e.preventDefault(); handlePostComment(); }} className="flex items-center gap-3">
          <div className="relative flex-1">
            <button
              ref={openerRef}
              type="button"
              onClick={() => setShowEmojiPicker(v => !v)}
              className="absolute left-3 top-3 h-6 w-6 flex items-center justify-center text-lg"
              aria-label="Emoji picker"
            >
              😊
            </button>

            <Input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="h-10 text-sm rounded-full pl-10 pr-12 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              maxLength={300}
              autoComplete="off"
              disabled={posting}
            />

            {/* Keep icon-only send control (no extra 'Post' button) */}
            <button type="submit" className="absolute right-2 top-2 h-8 w-8 flex items-center justify-center bg-purple-600 rounded-full text-white" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>

            {showEmojiPicker && pickerPos && createPortal(
              <div ref={pickerRef} style={{ position: 'fixed', left: pickerPos.left, top: pickerPos.top, zIndex: 99999 }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 w-56">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_PICKER_LIST.map((e: any, i: number) => (
                      <button
                        key={`${e.char}-${i}`}
                        type="button"
                        title={e.name}
                        onClick={() => {
                          setNewComment((newComment || '') + e.char + ' ');
                          setShowEmojiPicker(false);
                        }}
                        className="p-1 text-lg rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {e.char}
                      </button>
                    ))}
                </div>
              </div>,
              document.body
            )}
          </div>
        </form>
      ) : (
        <div className="text-sm text-gray-500 text-center py-2">Log in to post a comment.</div>
      )}
    </div>
  </div>

  {/* Comments Area - scrollable independent area */}
  <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0" style={{ minHeight: 0, paddingTop: '12px' }}>
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
                    <div className="text-sm text-gray-800 dark:text-gray-200 break-words font-normal leading-relaxed">
                      {c.comment}
                    </div>
                  </div>
                </div>
              ))}
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