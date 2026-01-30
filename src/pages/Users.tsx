import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Search, ArrowLeft, Users as UsersIcon, TrendingUp, Sparkles, Filter, Check, X, MoreVertical, MapPin, Globe, Calendar, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getMediaUrl } from '@/utils/mediaUtils';
import { getVerificationBadge } from '@/utils/verificationUtils';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonAvatar from '@/components/skeletons/SkeletonAvatar';
import SkeletonLine from '@/components/skeletons/SkeletonLine';

interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  username: string;
  avatar_url?: string;
  verified?: boolean;
  bio?: string;
  location?: string;
  website?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  created_at: string;
  interests?: string[];
  is_active?: boolean;
}

const Users = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'name'>('popular');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchFollowingUsers();
    }
  }, [user]);

  useEffect(() => {
    let filtered = [...users];
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.bio?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply tab filter
    if (activeTab === 'following') {
      filtered = filtered.filter(u => followingUsers.has(u.id));
    } else if (activeTab === 'suggested') {
      // Suggested users: Not following and have some followers/posts
      filtered = filtered.filter(u => 
        !followingUsers.has(u.id) && 
        (u.followers_count || 0) > 0 &&
        u.id !== user?.id
      );
    } else if (activeTab === 'new') {
      // New users: Joined in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(u => new Date(u.created_at) > weekAgo);
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'popular':
          return (b.followers_count || 0) - (a.followers_count || 0);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name':
          return (a.first_name || a.username).localeCompare(b.first_name || b.username);
        default:
          return 0;
      }
    });
    
    setFilteredUsers(filtered);
  }, [searchQuery, users, activeTab, sortBy, followingUsers, user]);

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

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .order('followers_count', { ascending: false })
        .limit(100);

      if (!error && data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string, targetUsername: string) => {
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
        description: `Now following @${targetUsername}!`,
        duration: 2000,
      });
      
      // Update followers count locally
      setUsers(prev => prev.map(u => 
        u.id === targetUserId 
          ? { ...u, followers_count: (u.followers_count || 0) + 1 }
          : u
      ));
    } catch (error: any) {
      toast({
        description: "Failed to follow user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (targetUserId: string, targetUsername: string) => {
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
        description: `Unfollowed @${targetUsername}`,
        duration: 2000,
      });
      
      // Update followers count locally
      setUsers(prev => prev.map(u => 
        u.id === targetUserId 
          ? { ...u, followers_count: Math.max(0, (u.followers_count || 1) - 1) }
          : u
      ));
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

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getJoinDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Today';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const UserCardSkeleton = () => (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <SkeletonAvatar className="h-16 w-16" />
        <div className="flex-1 space-y-3">
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-3 w-1/4" />
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-2/3" />
        </div>
      </div>
    </Card>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a] p-4">
        <div className="text-center space-y-4 max-w-md">
          <UsersIcon className="h-16 w-16 mx-auto text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Discover People
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Please log in to browse and connect with other users
          </p>
          <Button onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Discover
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Connect with amazing people on our platform
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Sort: {sortBy === 'popular' ? 'Popular' : sortBy === 'newest' ? 'Newest' : 'Name'}
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search users by name, username, or bio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-lg border-gray-200 dark:border-gray-800 focus:border-blue-500 rounded-2xl shadow-sm"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <Card className="p-4 mb-6 border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Sort By</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['popular', 'newest', 'name'].map((sort) => (
                  <Button
                    key={sort}
                    variant={sortBy === sort ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSortBy(sort as any);
                      setShowFilters(false);
                    }}
                    className="rounded-full"
                  >
                    {sort === 'popular' && <TrendingUp className="h-3 w-3 mr-1" />}
                    {sort === 'newest' && <Sparkles className="h-3 w-3 mr-1" />}
                    {sort === 'name' && 'A-Z'}
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid grid-cols-4 lg:w-auto w-full bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl">
              <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800">
                <UsersIcon className="h-4 w-4 mr-2" />
                All Users
              </TabsTrigger>
              <TabsTrigger value="suggested" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800">
                <Sparkles className="h-4 w-4 mr-2" />
                Suggested
              </TabsTrigger>
              <TabsTrigger value="following" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800">
                <Check className="h-4 w-4 mr-2" />
                Following
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800">
                <Calendar className="h-4 w-4 mr-2" />
                New
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Showing {filteredUsers.length} users • {activeTab === 'following' ? 'People you follow' : activeTab === 'suggested' ? 'Based on your interests' : activeTab === 'new' ? 'Recently joined' : 'All users'}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((userData) => (
              <Card 
                key={userData.id} 
                className="group relative overflow-hidden border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 hover:shadow-xl dark:hover:shadow-blue-900/10 rounded-2xl"
              >
                {/* Background gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-purple-50/0 to-pink-50/0 group-hover:from-blue-50/20 group-hover:via-purple-50/20 group-hover:to-pink-50/20 dark:group-hover:from-blue-900/5 dark:group-hover:via-purple-900/5 dark:group-hover:to-pink-900/5 transition-all duration-500" />
                
                <div className="relative p-6">
                  {/* User header */}
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => handleUserClick(userData.id)}
                    >
                      <div className="relative">
                        <Avatar className="h-14 w-14 ring-2 ring-white dark:ring-gray-800 shadow-lg">
                          <AvatarImage 
                            src={userData.avatar_url ? getMediaUrl(userData.avatar_url, 'posts') : undefined} 
                            alt={userData.username} 
                          />
                          <AvatarFallback className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white text-lg font-bold">
                            {(userData.first_name || userData.username || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {userData.is_active && (
                          <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">
                            {`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username}
                          </h3>
                          {(() => {
                            const badge = getVerificationBadge(undefined, userData.followers_count || 0, userData.posts_count || 0);
                            if (!badge) return null;
                            return (
                              <Badge 
                                variant="outline" 
                                className={`ml-1 text-xs px-1.5 py-0.5 ${badge.color.includes('blue') ? 'border-blue-200 text-blue-700 dark:text-blue-300 dark:border-blue-800' : ''}`}
                                title={badge.tooltip}
                              >
                                {badge.icon}
                                <span className="ml-1 font-medium">{badge.text}</span>
                              </Badge>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          @{userData.username}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* User bio */}
                  {userData.bio && (
                    <div 
                      className="mb-4 cursor-pointer"
                      onClick={() => handleUserClick(userData.id)}
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                        {userData.bio}
                      </p>
                    </div>
                  )}
                  
                  {/* User stats */}
                  <div className="flex items-center justify-between mb-4 text-sm">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {formatNumber(userData.followers_count || 0)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Followers
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {formatNumber(userData.posts_count || 0)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Posts
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {getJoinDate(userData.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Location & Website */}
                  {(userData.location || userData.website) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
                      {userData.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {userData.location}
                        </div>
                      )}
                      {userData.website && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <a 
                            href={userData.website.startsWith('http') ? userData.website : `https://${userData.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Website
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Follow Button */}
                  <Button
                    size="sm"
                    variant={followingUsers.has(userData.id) ? "outline" : "default"}
                    disabled={loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (followingUsers.has(userData.id)) {
                        handleUnfollow(userData.id, userData.username);
                      } else {
                        handleFollow(userData.id, userData.username);
                      }
                    }}
                    className="w-full rounded-lg transition-all duration-300"
                  >
                    {followingUsers.has(userData.id) ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="max-w-md mx-auto">
              <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <UsersIcon className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No users found' : activeTab === 'following' ? 'Not following anyone yet' : 'No users available'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery 
                  ? `No users match "${searchQuery}". Try a different search.`
                  : activeTab === 'following'
                  ? 'Start following people to see them here!'
                  : 'Check back later for more users.'
                }
              </p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery('')}
                  className="rounded-full"
                >
                  Clear Search
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Empty state for following tab */}
        {!loading && activeTab === 'following' && followingUsers.size === 0 && (
          <div className="text-center py-12">
            <Star className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Start building your network
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Follow interesting people to see their posts in your feed and stay updated with their content.
            </p>
            <Button 
              onClick={() => setActiveTab('suggested')}
              className="rounded-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Discover Suggested Users
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;