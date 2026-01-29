import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Copy, Bookmark, EyeOff, Flag, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PostHeaderProps {
  author: {
    name: string;
    username: string;
    avatar?: string;
    verified?: boolean;
    heading?: string; // Added for profile popover
    bio?: string;     // Added for profile popover
  };
  timestamp: string;
  userId: string;
  currentUserId?: string;
  isFollowing: boolean;
  showFollowButton: boolean;
  onFollowUpdate: (userId: string, isFollowing: boolean) => void;
  onCopyPostUrl: () => void;
  onDeletePost: () => void;
  onSavePost?: () => void;
  onHidePost?: () => void;
  onEditPost?: () => void;
}

export const PostHeader: React.FC<PostHeaderProps> = ({
  author,
  timestamp,
  userId,
  currentUserId,
  isFollowing: initialIsFollowing,
  showFollowButton,
  onFollowUpdate,
  onCopyPostUrl,
  onDeletePost,
  onSavePost,
  onHidePost,
  onEditPost
}) => {
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  };
  const navigate = useNavigate();
  const { user } = useAuth ? useAuth() : { user: null };
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [popupIsFollowing, setPopupIsFollowing] = useState(initialIsFollowing);
  const [popupLoading, setPopupLoading] = useState(false);

  // Fetch follow state when popup opens
  useEffect(() => {
    const fetchFollowState = async () => {
      if (!showProfilePopup || !user || !author.username || user.id === userId) return;
      setPopupLoading(true);
      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();
      setPopupIsFollowing(!!data);
      setPopupLoading(false);
    };
    fetchFollowState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProfilePopup, user, author.username, userId]);

  // Handle follow/unfollow in popup
  const handlePopupFollow = async () => {
    if (!user || user.id === userId) return;
    setPopupLoading(true);
    if (popupIsFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);
      if (!error) setPopupIsFollowing(false);
    } else {
      // Follow
      const { error } = await supabase
        .from('followers')
        .insert({ follower_id: user.id, following_id: userId });
      if (!error) setPopupIsFollowing(true);
    }
    setPopupLoading(false);
    if (onFollowUpdate) onFollowUpdate(userId, !popupIsFollowing);
  };

  return (
    <>
      {/* Profile Popup Modal */}
      {showProfilePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowProfilePopup(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-80 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
              onClick={() => setShowProfilePopup(false)}
              aria-label="Close profile popup"
            >
              ×
            </button>
            <div className="flex flex-col items-center">
              <Avatar className="w-20 h-20 mb-3 ring-2 ring-gray-200 dark:ring-gray-700">
                <AvatarImage src={author.avatar} alt={author.name} />
                <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-2xl">
                  {author.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="font-semibold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
                <span>{author.name}</span>
                {author.verified && (
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5">✓</Badge>
                )}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">@{author.username}</div>
              {author.heading && (
                <div className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-1 text-center w-full">{author.heading}</div>
              )}
              {author.bio && (
                <div className="text-gray-500 dark:text-gray-300 text-sm mb-2 text-center w-full whitespace-pre-line">{author.bio}</div>
              )}
              {showFollowButton && user && user.id !== userId && (
                <Button
                  size="sm"
                  variant={popupIsFollowing ? 'outline' : 'default'}
                  onClick={handlePopupFollow}
                  className="mt-2"
                  disabled={popupLoading}
                >
                  {popupLoading ? '...' : popupIsFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1">
          {/* Make avatar open popup */}
          <button
            className="focus:outline-none"
            onClick={() => setShowProfilePopup(true)}
            tabIndex={0}
            aria-label={`View ${author.name}'s profile`}
            style={{ background: 'none', border: 'none', padding: 0 }}
          >
            <Avatar className="w-10 h-10 ring-2 ring-gray-100 dark:ring-gray-800">
              <AvatarImage src={author.avatar} alt={author.name} />
              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm">
                {author.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              {/* Make fullname clickable */}
              <button
                className="font-semibold text-gray-900 dark:text-white text-sm focus:outline-none hover:text-blue-600 transition-colors"
                onClick={() => navigate(`/profile/${author.username}`)}
                tabIndex={0}
                aria-label={`View ${author.name}'s profile`}
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'none' }}
              >
                {author.name}
              </button>
              {author.verified && (
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5">
                  ✓
                </Badge>
              )}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs space-y-0.5">
              {/* Make username clickable */}
              <button
                className="hover:text-blue-600 transition-colors focus:outline-none"
                onClick={() => navigate(`/profile/${author.username}`)}
                tabIndex={0}
                aria-label={`View @${author.username}'s profile`}
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'none' }}
              >
                @{author.username}
              </button>
              <div>{formatTime(timestamp)}</div>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50">
            <DropdownMenuItem onClick={onCopyPostUrl}>
              <Copy className="h-4 w-4 mr-2" />
              Copy post URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSavePost}>
              <Bookmark className="h-4 w-4 mr-2" />
              Save post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHidePost}>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide post
            </DropdownMenuItem>
            {currentUserId && currentUserId === userId && (
              <>
                <DropdownMenuItem onClick={onEditPost}>
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDeletePost}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              </>
            )}
            {(!currentUserId || currentUserId !== userId) && (
              <DropdownMenuItem>
                <Flag className="h-4 w-4 mr-2" />
                Report post
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};
