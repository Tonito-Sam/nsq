import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  verified?: boolean;
}

interface FollowersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialTab?: 'followers' | 'following';
}

export const FollowersModal = ({ open, onOpenChange, userId, initialTab = 'followers' }: FollowersModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && userId && user) {
      fetchFollowersAndFollowing();
      fetchFollowingUsers();
    }
  }, [open, userId, user]);

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
      setFollowingUsers(new Set());
    }
  };

  const fetchFollowersAndFollowing = async () => {
    setLoading(true);
    try {
      // Fetch followers - users who follow this profile
      const { data: followersData, error: followersError } = await supabase
        .from('followers')
        .select(`
          follower_id,
          users!followers_follower_id_fkey(
            id,
            first_name,
            last_name,
            username,
            avatar_url,
            bio,
            verified
          )
        `)
        .eq('following_id', userId);

      if (followersError) throw followersError;

      // Fetch following - users this profile follows
      const { data: followingData, error: followingError } = await supabase
        .from('followers')
        .select(`
          following_id,
          users!followers_following_id_fkey(
            id,
            first_name,
            last_name,
            username,
            avatar_url,
            bio,
            verified
          )
        `)
        .eq('follower_id', userId);

      if (followingError) throw followingError;

      setFollowers(followersData?.map(f => f.users).filter(Boolean) || []);
      setFollowing(followingData?.map(f => f.users).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching followers/following:', error);
      // Mock data for demo
      const mockUsers: User[] = [
        {
          id: '1',
          first_name: 'Sarah',
          last_name: 'Johnson',
          username: 'sarahj',
          avatar_url: '/placeholder.svg',
          bio: 'Digital artist and creator',
          verified: true
        },
        {
          id: '2',
          first_name: 'Mike',
          last_name: 'Chen',
          username: 'mikec',
          avatar_url: '/placeholder.svg',
          bio: 'Tech enthusiast',
          verified: false
        },
        {
          id: '3',
          first_name: 'Emily',
          last_name: 'Davis',
          username: 'emilyd',
          avatar_url: '/placeholder.svg',
          bio: 'Photographer and traveler',
          verified: true
        }
      ];
      setFollowers(mockUsers);
      setFollowing(mockUsers.slice(0, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId: string) => {
    if (!user) return;
    const isFollowing = followingUsers.has(targetUserId);
    try {
      if (isFollowing) {
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
        await supabase
          .from('followers')
          .insert({ follower_id: user.id, following_id: targetUserId });
        setFollowingUsers(prev => new Set([...prev, targetUserId]));
      }
      fetchFollowersAndFollowing();
    } catch (error) {
      // Optionally show error
    }
  };

  const UserItem = ({ userData, showFollowButton = true }: { userData: User; showFollowButton?: boolean }) => {
    const isFollowing = followingUsers.has(userData.id);
    return (
      <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={userData.avatar_url} />
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              {userData.first_name?.[0]}{userData.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate cursor-pointer" onClick={() => navigate(`/profile/${userData.username}`)}>
                {userData.first_name} {userData.last_name}
              </p>
              {userData.verified && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 cursor-pointer" onClick={() => navigate(`/profile/${userData.username}`)}>@{userData.username}</p>
            {userData.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{userData.bio}</p>
            )}
          </div>
        </div>
        {showFollowButton && user?.id !== userData.id && (
          <Button
            variant={isFollowing ? 'outline' : 'default'}
            size="sm"
            onClick={() => handleFollowToggle(userData.id)}
            className={`ml-3 ${isFollowing ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            {isFollowing ? <UserCheck className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers">
              Followers ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following">
              Following ({following.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-4">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No followers yet
                </div>
              ) : (
                followers.map((follower) => (
                  <UserItem key={follower.id} userData={follower} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : following.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Not following anyone yet
                </div>
              ) : (
                following.map((followingUser) => (
                  <UserItem key={followingUser.id} userData={followingUser} showFollowButton={false} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
