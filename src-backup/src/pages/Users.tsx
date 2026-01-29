
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getMediaUrl } from '@/utils/mediaUtils';

interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  username: string;
  avatar_url?: string;
  verified?: boolean;
  bio?: string;
}

const Users = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchFollowingUsers();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchFollowingUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      if (!error && data) {
        setFollowingUsers(new Set(data.map(f => f.following_id)));
      }
    } catch (error) {
      console.error('Error fetching following users:', error);
    }
  };

  const fetchUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, avatar_url, verified, bio')
        .neq('id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('followers')
        .insert({
          follower_id: user.id,
          following_id: targetUserId
        });

      if (error) throw error;

      setFollowingUsers(prev => new Set([...prev, targetUserId]));

      toast({
        description: "Successfully followed user!",
      });
    } catch (error: any) {
      toast({
        description: "Failed to follow user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) throw error;

      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });

      toast({
        description: "Unfollowed user successfully!",
      });
    } catch (error: any) {
      toast({
        description: "Failed to unfollow user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to view users</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Discover Users
            </h1>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((userData) => (
            <Card key={userData.id} className="p-4 hover:shadow-lg transition-shadow">
              <div 
                className="flex flex-col items-center text-center cursor-pointer"
                onClick={() => handleUserClick(userData.id)}
              >
                <Avatar className="h-16 w-16 mb-3">
                  <AvatarImage 
                    src={userData.avatar_url ? getMediaUrl(userData.avatar_url, 'posts') : undefined} 
                    alt={userData.username} 
                  />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg">
                    {(userData.first_name || userData.username || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="mb-3">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username}
                    </h3>
                    {userData.verified && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    @{userData.username}
                  </p>
                  {userData.bio && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                      {userData.bio}
                    </p>
                  )}
                </div>
              </div>
              
              <Button
                size="sm"
                variant={followingUsers.has(userData.id) ? "outline" : "default"}
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  if (followingUsers.has(userData.id)) {
                    handleUnfollow(userData.id);
                  } else {
                    handleFollow(userData.id);
                  }
                }}
                className="w-full"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                {followingUsers.has(userData.id) ? 'Unfollow' : 'Follow'}
              </Button>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No users found matching your search.' : 'No users available.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
