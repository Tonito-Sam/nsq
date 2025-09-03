import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getMediaUrl } from '@/utils/mediaUtils';

interface SuggestedFriendsProps {
  mobileView?: boolean;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url?: string;
  verified?: boolean;
}

export const SuggestedFriends: React.FC<SuggestedFriendsProps> = ({ mobileView = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSuggestedUsers();
      fetchFollowingUsers();
    }
  }, [user]);

  const fetchFollowingUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      if (error) throw error;

      const followingIds = new Set(data.map(f => f.following_id));
      setFollowingUsers(followingIds);
    } catch (error) {
      console.error('Error fetching following users:', error);
    }
  };

  const fetchSuggestedUsers = async () => {
    if (!user) return;

    try {
      // Get users that current user is not following and exclude current user
      const { data: followingData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      const excludeIds = [...followingIds, user.id];

      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, avatar_url, verified')
        .not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`)
        .limit(mobileView ? 3 : 5);

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    try {
      const isFollowing = followingUsers.has(targetUserId);

      if (isFollowing) {
        // Unfollow
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
      } else {
        // Follow
        await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });

        setFollowingUsers(prev => new Set([...prev, targetUserId]));

        // In-app notification
        await supabase.rpc('create_notification', {
          target_user_id: targetUserId,
          notification_type: 'follow',
          notification_title: 'New Follower',
          notification_message: `${user.user_metadata?.first_name || user.email} started following you`,
          notification_data: { userId: user.id }
        });

        // Email notification
        fetch('/api/send-follow-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toUserId: targetUserId,
            fromUser: {
              id: user.id,
              first_name: user.user_metadata?.first_name || '',
              last_name: user.user_metadata?.last_name || '',
              username: user.user_metadata?.username || '',
              email: user.email
            }
          })
        });

        // Remove from suggested list after following
        setUsers(prev => prev.filter(u => u.id !== targetUserId));
      }
    } catch (error) {
      console.error('Error handling follow:', error);
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/profile/${username}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: mobileView ? 3 : 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="space-y-1">
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-16 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">No suggestions available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!mobileView && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Suggested for you</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/users')}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            See all
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {users.map((suggestedUser) => {
          const isFollowing = followingUsers.has(suggestedUser.id);
          
          return (
            <div key={suggestedUser.id} className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                onClick={() => handleUserClick(suggestedUser.username)}
              >
                <Avatar className="h-10 w-10 ring-2 ring-gray-100 dark:ring-gray-800">
                  <AvatarImage 
                    src={suggestedUser.avatar_url ? getMediaUrl(suggestedUser.avatar_url, 'posts') : '/placeholder.svg'} 
                    alt={`${suggestedUser.first_name} ${suggestedUser.last_name}`}
                  />
                  <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium">
                    {suggestedUser.first_name?.[0]}{suggestedUser.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {suggestedUser.first_name} {suggestedUser.last_name}
                    {suggestedUser.verified && <span className="text-blue-500 ml-1">✓</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    @{suggestedUser.username}
                  </p>
                </div>
              </div>

              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow(suggestedUser.id);
                }}
                className={`ml-2 ${mobileView ? 'w-8 h-8 p-0' : ''} ${
                  isFollowing 
                    ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {mobileView ? (
                  isFollowing ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />
                ) : (
                  isFollowing ? 'Following' : 'Follow'
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {mobileView && users.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/users')}
          className="w-full text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
        >
          See all
        </Button>
      )}
    </div>
  );
};
