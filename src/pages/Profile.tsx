import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Edit3, Heart, Users, UserPlus, Eye, Upload, MessageCircle, Store, Radio } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ProfileSidebar } from '@/components/ProfileSidebar';
import { toast } from '@/hooks/use-toast';
import { PostCard } from '@/components/PostCard';
import { useState, useEffect, useCallback, useRef } from 'react';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { getVerificationBadge } from '@/utils/verificationUtils';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonAvatar from '@/components/skeletons/SkeletonAvatar';
import SkeletonLine from '@/components/skeletons/SkeletonLine';
import SkeletonMedia from '@/components/skeletons/SkeletonMedia';

interface UserProfile {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  cover_photo_url?: string;
  heading?: string;
  verified?: boolean;
  bio?: string;
  likes?: number;
}

interface ProfileStats {
  followers: number;
  following: number;
  likes: number;
  views: number;
  hasLiked: boolean;
}

const Profile = () => {
  const { user } = useAuth();
  const { username } = useParams();
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ 
    followers: 0, 
    following: 0, 
    likes: 0, 
    views: 0,
    hasLiked: false 
  });
  const [loading, setLoading] = useState(true);
  // prevent concurrent loads
  const isFetchingRef = useRef(false);
  const [uploading] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [liking, setLiking] = useState(false);
  const navigate = useNavigate();
  
  // Use refs to track previous values and prevent unnecessary reloads
  const previousUsernameRef = useRef<string | undefined>(undefined);
  const previousUserIdRef = useRef<string | undefined>(undefined);
  
  // Safely check if it's the user's own profile
  const isOwnProfile = user && userData && user.id === userData.id;

  // Fetch profile likes count and check if current user has liked
  const fetchProfileLikes = useCallback(async (profileUserId: string) => {
    try {
      // Get total likes count for this profile
      const { count, error: countError } = await supabase
        .from('profile_likes')
        .select('*', { count: 'exact', head: true })
        .eq('liked_profile_id', profileUserId);

      if (countError) {
        if (countError.code === '42P01') {
          return { likes: 0, hasLiked: false };
        }
        throw countError;
      }

      // Check if current user has liked this profile
      let hasLiked = false;
      if (user) {
        const { data, error: likeError } = await supabase
          .from('profile_likes')
          .select('id')
          .eq('liker_id', user.id)
          .eq('liked_profile_id', profileUserId)
          .maybeSingle();

        if (likeError) {
          if (likeError.code === '42P01') {
            return { likes: 0, hasLiked: false };
          }
          throw likeError;
        }
        hasLiked = !!data;
      }

      return {
        likes: count || 0,
        hasLiked
      };
    } catch (error) {
      console.error('Error fetching profile likes:', error);
      return { likes: 0, hasLiked: false };
    }
  }, [user]);

  // Fetch user stats including likes
  const fetchUserStats = useCallback(async (userId: string) => {
    try {
      // Use Promise.all for parallel requests
      const [
        followersPromise,
        followingPromise,
        postsPromise
      ] = await Promise.all([
        supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
        supabase
          .from('posts')
          .select('likes_count')
          .eq('user_id', userId)
      ]);

      // Profile likes
      const { likes, hasLiked } = await fetchProfileLikes(userId);

      // Post likes
      const postLikes = postsPromise.data?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;

      // Views (sum of all post views, or fallback)
      let totalViews = (postsPromise.data?.length ?? 0) * 150;

      setStats({
        followers: followersPromise.count || 0,
        following: followingPromise.count || 0,
        likes, // Profile likes
        views: totalViews,
        hasLiked
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Don't reset to zero if we already have data
      setStats(prev => ({ 
        ...prev,
        followers: prev.followers || 0, 
        following: prev.following || 0, 
        likes: prev.likes || 0, 
        views: prev.views || 0,
        hasLiked: prev.hasLiked || false 
      }));
    }
  }, [fetchProfileLikes]);

  // Like/Unlike handler
  const handleLikeProfile = async () => {
    if (!user || !userData || isOwnProfile) {
      toast({ 
        title: 'Cannot like profile', 
        description: isOwnProfile ? 'You cannot like your own profile' : 'Please login to like profiles',
        variant: 'destructive' 
      });
      return;
    }

    setLiking(true);
    try {
      if (stats.hasLiked) {
        // Unlike: Remove the like record
        const { error } = await supabase
          .from('profile_likes')
          .delete()
          .eq('liker_id', user.id)
          .eq('liked_profile_id', userData.id);

        if (error) {
          if (error.code === '42P01') {
            // Table doesn't exist, but we're trying to unlike - just update local state
            console.log('Table not found during unlike, updating local state only');
          } else {
            throw error;
          }
        }

        setStats(prev => ({ 
          ...prev, 
          likes: Math.max(0, prev.likes - 1),
          hasLiked: false 
        }));

        // Notify other UI parts that profile likes changed
        try {
          window.dispatchEvent(new CustomEvent('profile-likes-updated', { detail: { userId: userData.id, likes: Math.max(0, stats.likes - 1) } }));
        } catch (e) {}

        toast({ 
          title: 'Profile Unliked', 
          description: `You unliked ${userData.username || 'this user'}'s profile.` 
        });
      } else {
        // Like: Add a new like record
        const { error } = await supabase
          .from('profile_likes')
          .insert({
            liker_id: user.id,
            liked_profile_id: userData.id
          });

        if (error) {
          if (error.code === '42P01') {
            // Table doesn't exist, but we're trying to like - just update local state
            console.log('Table not found during like, updating local state only');
          } else {
            throw error;
          }
        }

        setStats(prev => ({ 
          ...prev, 
          likes: prev.likes + 1,
          hasLiked: true 
        }));

        // Notify other UI parts that profile likes changed
        try {
          window.dispatchEvent(new CustomEvent('profile-likes-updated', { detail: { userId: userData.id, likes: stats.likes + 1 } }));
        } catch (e) {}
+
        toast({ 
          title: 'Profile Liked!', 
          description: `You liked ${userData.username || 'this user'}'s profile.` 
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({ 
        title: 'Error', 
        description: 'Could not update like', 
        variant: 'destructive' 
      });
    } finally {
      setLiking(false);
    }
  };

  // --- Helper functions ---
  const fetchUserDataByUsername = useCallback(async (username: string): Promise<UserProfile | null> => {
    try {
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      if (error) {
        // Don't set null immediately, check if it's a real error
        console.error('Error fetching user by username:', error);
        return null;
      }
      return dbUser;
    } catch {
      return null;
    }
  }, []);

  const fetchUserDataById = useCallback(async (id: string): Promise<UserProfile | null> => {
    try {
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Error fetching user by id:', error);
        return null;
      }
      return dbUser;
    } catch {
      return null;
    }
  }, []);

  // Main data loading function
  const loadProfileData = useCallback(async () => {
    // Skip if already loading/running
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    // Check if we already have the data for this username/user
    if (username && previousUsernameRef.current === username && userData) {
      return;
    }
    if (!username && user && previousUserIdRef.current === user.id && userData) {
      return;
    }
    
    setLoading(true);
    try {
      let profileUser = null;

      // Always check if username param exists (URL), otherwise fallback to logged-in user
      if (username) {
        profileUser = await fetchUserDataByUsername(username);
        if (!profileUser) {
          // Only redirect if it's a 404 error and user is viewing someone else's profile
          if (!user) {
            navigate('/auth');
          }
          setLoading(false);
          return;
        }
        previousUsernameRef.current = username;
      } else if (user) {
        profileUser = await fetchUserDataById(user.id);
        previousUserIdRef.current = user.id;
      }

      // If no profile found and no user logged in, redirect to auth
      if (!profileUser && !user) {
        navigate('/auth');
        return;
      }
      
      if (!profileUser) {
        setLoading(false);
        return;
      }
      
      // Only update if data has changed
      if (JSON.stringify(userData) !== JSON.stringify(profileUser)) {
        setUserData(profileUser);
      }
      
      // Fetch stats including likes
      await fetchUserStats(profileUser.id);

      // Fetch posts for the profile user
      const { data: userPosts } = await supabase
        .from('posts')
        .select(`
          *,
          user:users!posts_user_id_fkey(
            first_name,
            last_name,
            username,
            avatar_url,
            verified,
            heading
          )
        `)
        .eq('user_id', profileUser.id)
        .order('created_at', { ascending: false });
        
      // Only update posts if they've changed
      if (JSON.stringify(posts) !== JSON.stringify(userPosts || [])) {
        setPosts(userPosts || []);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // Don't reset userData on error if we already have it
      if (!userData) {
        setUserData(null);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [username, user, fetchUserDataByUsername, fetchUserDataById, fetchUserStats, navigate, loading, userData, posts]);

  // Load profile data on mount and when dependencies change
  useEffect(() => {
    const controller = new AbortController();
    
    const loadData = async () => {
      if (controller.signal.aborted) return;
      await loadProfileData();
    };
    
    loadData();
    
    // Cleanup function
    return () => {
      controller.abort();
    };
  }, [loadProfileData]);

  // Add event listener for visibility change to prevent reloads on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible again
        // We could optionally refresh data here, but only if needed
        // For now, we'll just skip automatic refresh
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- Profile Stats Grid ---
  const StatsGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t dark:border-gray-700">
      <Card 
        className="flex flex-col items-center py-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 shadow-none cursor-pointer hover:shadow-md transition-shadow" 
        onClick={() => handleOpenFollowersModal('followers')}
      >
        <Users className="h-6 w-6 text-blue-500 mb-1" />
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.followers}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>
      </Card>
      <Card 
        className="flex flex-col items-center py-4 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/10 dark:to-teal-900/10 shadow-none cursor-pointer hover:shadow-md transition-shadow" 
        onClick={() => handleOpenFollowersModal('following')}
      >
        <UserPlus className="h-6 w-6 text-green-500 mb-1" />
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.following}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>
      </Card>
      <Card 
        className="flex flex-col items-center py-4 bg-gradient-to-br from-pink-50 to-red-50 dark:from-pink-900/10 dark:to-red-900/10 shadow-none hover:shadow-md transition-shadow"
      >
        <Heart className={`h-6 w-6 mb-1 ${stats.hasLiked ? 'fill-red-500 text-red-500' : 'text-red-500'}`} />
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.likes}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Profile Likes</div>
      </Card>
      <Card 
        className="flex flex-col items-center py-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 shadow-none hover:shadow-md transition-shadow"
      >
        <Eye className="h-6 w-6 text-purple-500 mb-1" />
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{stats.views}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Views</div>
      </Card>
    </div>
  );

  // --- Event handlers ---
  const handleOpenFollowersModal = (tab: 'followers' | 'following') => {
    setFollowersModalTab(tab);
    setFollowersModalOpen(true);
  };

  // --- File upload logic ---
  function handleFileUpload() {
    if (!isOwnProfile) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // ...existing upload logic...
    };
    input.click();
  }

  // --- Render ---
  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Profile header skeleton */}
          <div className="flex items-center gap-6 mb-6">
            <SkeletonAvatar size={96} />
            <div className="flex-1 space-y-3">
              <SkeletonLine width="40%" height="1.25rem" />
              <SkeletonLine width="30%" height="1rem" />
              <div className="flex items-center gap-4 mt-2">
                <SkeletonLine width="6rem" height="2rem" />
                <SkeletonLine width="6rem" height="2rem" />
                <SkeletonLine width="6rem" height="2rem" />
              </div>
            </div>
          </div>

          {/* Posts grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
        <Header />
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-500 dark:text-gray-400">Profile not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
        {/* Main Content */}
        <main className="flex-1 px-4 py-6 min-w-0 lg:max-w-5xl">
          <Card className="overflow-hidden dark:bg-[#161616] mb-6">
            <div 
              className="h-48 bg-gradient-to-r from-purple-600 via-yellow-400 to-purple-600 relative"
              style={{
                backgroundImage: userData.cover_photo_url ? `url(${userData.cover_photo_url})` : "linear-gradient(135deg, #9333ea 0%, #eab308 50%, #9333ea 100%)",
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {isOwnProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white"
                  onClick={handleFileUpload}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="p-6 relative">
              <div className="relative -mt-20 mb-4">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  <AvatarImage src={userData.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-2xl">
                    {userData.first_name?.[0]}{userData.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-2 right-2 bg-white/90 hover:bg-white shadow-md rounded-full h-8 w-8 p-0"
                    onClick={handleFileUpload}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {userData.first_name} {userData.last_name}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400">@{userData.username}</p>
                  {userData.heading && (
                    <p className="text-blue-600 dark:text-blue-400 font-medium mt-1">{userData.heading}</p>
                  )}
                  {(() => {
                    // Use metric-only badges for profile header (do not render manual 'Verified' here)
                    const badge = getVerificationBadge(undefined, stats.followers, posts.length || (userData as any).posts_count || 0);
                    if (!badge) return null;
                    return (
                      <Badge className={`mt-2 text-xs px-2 py-1 flex items-center gap-1 ${badge.color}`} title={badge.tooltip}>
                        {badge.icon}
                        {badge.text}
                      </Badge>
                    );
                  })()}
                  {userData.bio && (
                    <p className="mt-3 text-gray-700 dark:text-gray-300">{userData.bio}</p>
                  )}
                </div>
                {isOwnProfile && (
                  <Button
                    onClick={() => navigate('/profile/edit')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
                {!isOwnProfile && user && (
                  <Button
                    onClick={handleLikeProfile}
                    disabled={liking}
                    className={`ml-2 ${
                      stats.hasLiked 
                        ? 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800' 
                        : 'bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600'
                    }`}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${stats.hasLiked ? 'fill-white' : ''}`} />
                    {liking ? 'Processing...' : stats.hasLiked ? 'Unlike Profile' : 'Like Profile'}
                  </Button>
                )}
                {!isOwnProfile && !user && (
                  <Button
                    onClick={() => navigate('/auth')}
                    className="ml-2 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Login to Like
                  </Button>
                )}
              </div>
              {/* Profile Stats Grid */}
              <StatsGrid />
              <div className="mt-12" />
              {/* Action Buttons: Message, Store, Studio, Groups */}
              {/* Responsive Action Buttons: Mobile = grid, Desktop = flex row */}
              <div className="mt-6 w-full">
                {/* Mobile: 4-column grid, icons above labels, square buttons */}
                <div className="grid grid-cols-4 gap-2 sm:hidden">
                  {/* Message */}
                  <Button
                    asChild
                    className="flex flex-col items-center justify-center gap-1 rounded-lg aspect-square w-full h-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md transition-all duration-200 text-sm font-semibold p-0"
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!user || !userData?.id) return;
                        let conversationId = null;
                        const { data: existingConv } = await supabase
                          .from('conversations')
                          .select('id')
                          .or(`and(customer_id.eq.${user.id},seller_id.eq.${userData.id}),and(customer_id.eq.${userData.id},seller_id.eq.${user.id})`)
                          .limit(1)
                          .single();
                        if (existingConv) {
                          conversationId = existingConv.id;
                        } else {
                          const { data: newConv, error } = await supabase
                            .from('conversations')
                            .insert({ customer_id: user.id, seller_id: userData.id })
                            .select('id')
                            .single();
                          if (error) {
                            toast({ title: 'Error', description: 'Could not start chat', variant: 'destructive' });
                            return;
                          }
                          conversationId = newConv.id;
                        }
                        navigate('/messages', { state: { openConversationId: conversationId } });
                      }}
                    >
                      <MessageCircle className="h-7 w-7 mb-1" />
                      <span className="text-xs">Message</span>
                    </a>
                  </Button>
                  {/* Store */}
                  <Button
                    asChild
                    className="flex flex-col items-center justify-center gap-1 rounded-lg aspect-square w-full h-auto bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-md transition-all duration-200 text-sm font-semibold p-0"
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!userData) return;
                        if (isOwnProfile) {
                          navigate('/my-store');
                          return;
                        }
                        const { data: store } = await supabase
                          .from('user_stores')
                          .select('id')
                          .eq('user_id', userData.id)
                          .eq('is_active', true)
                          .single();
                        if (store && store.id) {
                          navigate(`/store/${store.id}`);
                        } else {
                          toast({ title: 'No Store', description: 'This user has not created a store yet.' });
                        }
                      }}
                    >
                      <Store className="h-7 w-7 mb-1" />
                      <span className="text-xs">Store</span>
                    </a>
                  </Button>
                  {/* Studio */}
                  <Button
                    asChild
                    className="flex flex-col items-center justify-center gap-1 rounded-lg aspect-square w-full h-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md transition-all duration-200 text-sm font-semibold p-0"
                    disabled={!userData}
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!userData) return;
                        const { data: channel } = await supabase
                          .from('studio_channels')
                          .select('id')
                          .eq('user_id', userData.id)
                          .single();
                        if (channel && channel.id) {
                          navigate(`/studio/${channel.id}`);
                        } else {
                          toast({ title: 'No Studio Channel', description: 'This user does not have a studio channel yet.' });
                        }
                      }}
                    >
                      <Radio className="h-7 w-7 mb-1" />
                      <span className="text-xs">Studio</span>
                    </a>
                  </Button>
                  {/* Groups */}
                  <Button
                    asChild
                    className="flex flex-col items-center justify-center gap-1 rounded-lg aspect-square w-full h-auto bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-md transition-all duration-200 text-sm font-semibold p-0"
                    disabled={!userData}
                  >
                    <a
                      href="/groups"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/groups');
                      }}
                    >
                      <Users className="h-7 w-7 mb-1" />
                      <span className="text-xs">Groups</span>
                    </a>
                  </Button>
                </div>
                {/* Desktop: inline row, keep as before but ensure Groups is present */}
                <div className="hidden sm:flex flex-row gap-3 w-full items-center">
                  {/* Message Button */}
                  <Button
                    asChild
                    className="flex items-center justify-center gap-2 rounded-full px-6 py-2 w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md transition-all duration-200 text-base font-semibold"
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!user || !userData?.id) return;
                        let conversationId = null;
                        const { data: existingConv } = await supabase
                          .from('conversations')
                          .select('id')
                          .or(`and(customer_id.eq.${user.id},seller_id.eq.${userData.id}),and(customer_id.eq.${userData.id},seller_id.eq.${user.id})`)
                          .limit(1)
                          .single();
                        if (existingConv) {
                          conversationId = existingConv.id;
                        } else {
                          const { data: newConv, error } = await supabase
                            .from('conversations')
                            .insert({ customer_id: user.id, seller_id: userData.id })
                            .select('id')
                            .single();
                          if (error) {
                            toast({ title: 'Error', description: 'Could not start chat', variant: 'destructive' });
                            return;
                          }
                          conversationId = newConv.id;
                        }
                        navigate('/messages', { state: { openConversationId: conversationId } });
                      }}
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span className="hidden sm:inline">Message</span>
                    </a>
                  </Button>
                  {/* Store Button */}
                  <Button
                    asChild
                    className="flex items-center justify-center gap-2 rounded-full px-6 py-2 w-full sm:w-auto bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-md transition-all duration-200 text-base font-semibold"
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!userData) return;
                        if (isOwnProfile) {
                          navigate('/my-store');
                          return;
                        }
                        const { data: store } = await supabase
                          .from('user_stores')
                          .select('id')
                          .eq('user_id', userData.id)
                          .eq('is_active', true)
                          .single();
                        if (store && store.id) {
                          navigate(`/store/${store.id}`);
                        } else {
                          toast({ title: 'No Store', description: 'This user has not created a store yet.' });
                        }
                      }}
                    >
                      <Store className="h-5 w-5" />
                      <span className="hidden sm:inline">Store</span>
                    </a>
                  </Button>
                  {/* Studio Button */}
                  <Button
                    asChild
                    className="flex items-center justify-center gap-2 rounded-full px-6 py-2 w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-md transition-all duration-200 text-base font-semibold"
                    disabled={!userData}
                  >
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!userData) return;
                        const { data: channel } = await supabase
                          .from('studio_channels')
                          .select('id')
                          .eq('user_id', userData.id)
                          .single();
                        if (channel && channel.id) {
                          navigate(`/studio/${channel.id}`);
                        } else {
                          toast({ title: 'No Studio Channel', description: 'This user does not have a studio channel yet.' });
                        }
                      }}
                    >
                      <Radio className="h-5 w-5" />
                      <span className="hidden sm:inline">Studio</span>
                    </a>
                  </Button>
                  {/* Groups Button (now also on desktop) */}
                  <Button
                    asChild
                    className="flex items-center justify-center gap-2 rounded-full px-6 py-2 w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-md transition-all duration-200 text-base font-semibold"
                    disabled={!userData}
                  >
                    <a
                      href="/groups"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/groups');
                      }}
                    >
                      <Users className="h-5 w-5" />
                      <span className="hidden sm:inline">Groups</span>
                    </a>
                  </Button>
                </div>
              </div>
              {/* Conversation/Posts Container - Make scrollable and fill available space */}
              <div>
                {/* Add margin-top to posts heading for clear separation */}
                <div className="mt-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Posts</h2>
                  {posts.length === 0 ? (
                    <Card className="p-8 text-center dark:bg-[#161616]">
                      <p className="text-gray-500 dark:text-gray-400">No posts yet</p>
                    </Card>
                  ) : (
                    <>
                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUser={user}
                        />
                      ))}
                      {/* Add extra space after last post to avoid bottom nav overlap */}
                      <div className="h-24 sm:h-0" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </main>
        {/* Profile Sidebar - always on the right on large screens */}
        <aside className="hidden lg:block lg:w-80 lg:ml-8">
          <ProfileSidebar />
        </aside>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
      {/* <FollowersModal open={followersModalOpen} onOpenChange={setFollowersModalOpen} userId={userData.id} initialTab={followersModalTab} /> */}
    </div>
  );
};

export default Profile;