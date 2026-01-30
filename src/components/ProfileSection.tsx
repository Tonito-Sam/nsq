import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Heart, Eye, DollarSign, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { FollowersModal } from './FollowersModal';
import { CustomersModal, ViewsModal, LikesModal, EarningsModal } from './ProfileStatsModals';
import { getMediaUrl } from '@/utils/mediaUtils';
import { getVerificationBadge } from '@/utils/verificationUtils';

export const ProfileSection = () => {
  const { user } = useAuth();
  const { username } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [modalTab, setModalTab] = useState<'followers' | 'following'>('followers');
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    customers: 0,
    views: 0,
    likes: 0,
    earned: 0
  });
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);

  useEffect(() => {
    if (username) {
      fetchUserDataByUsername(username);
    } else if (user) {
      fetchUserData();
      fetchUserStats();
    }
  }, [user, username]);

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      // First try to get data from users table
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (dbUser) {
        setUserData(dbUser);
      } else {
        // Fallback to auth metadata
        setUserData({
          id: user.id,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || '',
          cover_photo_url: user.user_metadata?.cover_photo_url || '',
          bio: user.user_metadata?.bio || '',
          heading: user.user_metadata?.heading || '',
          verified: user.user_metadata?.verified || false
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fallback to auth metadata
      setUserData({
        id: user.id,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || '',
        cover_photo_url: user.user_metadata?.cover_photo_url || '',
        bio: user.user_metadata?.bio || '',
        heading: user.user_metadata?.heading || '',
        verified: user.user_metadata?.verified || false
      });
    }
  };

  const fetchUserDataByUsername = async (username: string) => {
    try {
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      if (dbUser) {
        setUserData(dbUser);
        fetchUserStatsById(dbUser.id);
      } else {
        setUserData(null);
      }
    } catch (error) {
      setUserData(null);
    }
  };

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      // Fetch followers count
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // Fetch following count
      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      // Fetch customers count from orders
      const { count: customersCount } = await supabase
        .from('orders')
        .select('user_id', { count: 'exact', head: true })
        .eq('store_id', user.id);

      // Fetch posts and calculate likes/views
      const { data: posts } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('user_id', user.id);

      const totalLikes = posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
      const postsCount = Array.isArray(posts) ? posts.length : 0;
      const totalViews = postsCount * 150; // Mock calculation
      
      // Fetch canonical profile likes count from profile_likes table
      let profileLikesCount = 0;
      try {
        const { count: pLikesCount, error: pErr } = await supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('liked_profile_id', user.id);
        if (!pErr) profileLikesCount = pLikesCount || 0;
      } catch (e) {
        // ignore
      }

      // Fetch total earnings from orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('store_id', user.id)
        .eq('status', 'completed');

      const totalEarned = orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;

      setStats({
        followers: followersCount || 0,
        following: followingCount || 0,
        customers: customersCount || 0,
        views: totalViews,
        likes: profileLikesCount || totalLikes,
        earned: totalEarned
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set mock stats for demo
      setStats({
        followers: 234,
        following: 189,
        customers: 45,
        views: 15420,
        likes: 1250,
        earned: 2450
      });
    }
  };

  const fetchUserStatsById = async (userId: string) => {
    try {
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      const { count: customersCount } = await supabase
        .from('orders')
        .select('user_id', { count: 'exact', head: true })
        .eq('store_id', userId);
      const { data: posts } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('user_id', userId);
      const totalLikes = posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
      const postsCount = Array.isArray(posts) ? posts.length : 0;
      const totalViews = postsCount * 150;
      // canonical profile likes for another user
      let profileLikesCount = 0;
      try {
        const { count: pLikesCount, error: pErr } = await supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('liked_profile_id', userId);
        if (!pErr) profileLikesCount = pLikesCount || 0;
      } catch (e) {}

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('store_id', userId)
        .eq('status', 'completed');
      const totalEarned = orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;
      setStats({
        followers: followersCount || 0,
        following: followingCount || 0,
        customers: customersCount || 0,
        views: totalViews,
        likes: profileLikesCount || totalLikes,
        earned: totalEarned
      });
    } catch (error) {
      setStats({
        followers: 234,
        following: 189,
        customers: 45,
        views: 15420,
        likes: 1250,
        earned: 2450
      });
    }
  };

  const openFollowersModal = (tab: 'followers' | 'following') => {
    setModalTab(tab);
    setShowFollowersModal(true);
  };

  // Listen for live profile likes updates dispatched from Profile page
  useEffect(() => {
    const onProfileLikesUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;
        // If the updated profile is the one currently shown, update likes stat
        if (userData && detail.userId === userData.id) {
          setStats(prev => ({ ...prev, likes: detail.likes || 0 }));
        }
      } catch (err) {
        // ignore malformed events
      }
    };

    window.addEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
    return () => window.removeEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
  }, [userData]);

  if (!userData) {
    return (
      <Card className="p-6 dark:bg-[#161616] bg-white dark:border-gray-700 shadow-md dark:shadow-none">
        <div className="animate-pulse">
          <div className="h-20 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden dark:bg-[#161616] bg-white dark:border-gray-700 shadow-md dark:shadow-none">
        {/* Cover Photo (Clickable) */}
        <div
          className="h-32 bg-gradient-to-r from-purple-600 via-yellow-400 to-purple-600 relative cursor-pointer"
          style={{
            backgroundImage: userData.cover_photo_url ? `url(${getMediaUrl(userData.cover_photo_url, 'posts')})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
          onClick={() => navigate(`/profile/${userData.username}`)}
          title="View Profile"
        />
        
        <div className="p-6 relative">
          {/* Profile Picture (Clickable) */}
          <div className="relative -mt-16 mb-4 cursor-pointer" onClick={() => navigate(`/profile/${userData.username}`)} title="View Profile">
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage 
                src={userData.avatar_url ? getMediaUrl(userData.avatar_url, 'posts') : "/placeholder.svg"} 
              />
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl">
                {userData.first_name?.[0]}{userData.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {/* User Info (Full Name & Username Clickable) */}
          <div className="space-y-3">
            <div>
              <h2
                className="text-xl font-bold text-foreground cursor-pointer inline-block"
                onClick={() => navigate(`/profile/${userData.username}`)}
                title="View Profile"
                tabIndex={0}
                role="button"
              >
                {userData.first_name} {userData.last_name}
              </h2>
              <br />
              <p
                className="text-muted-foreground text-sm cursor-pointer inline-block"
                onClick={() => navigate(`/profile/${userData.username}`)}
                title="View Profile"
                tabIndex={0}
                role="button"
              >
                @{userData.username}
              </p>
              {userData.heading && (
                <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mt-1">
                  {userData.heading}
                </p>
              )}
              {(() => {
                const badge = getVerificationBadge(undefined, stats.followers, (userData?.posts_count || 0));
                if (badge) {
                  return (
                    <Badge variant="outline" className={`mt-2 text-xs px-1.5 py-0.5 ${badge.color.includes('blue') ? 'border-blue-200 text-blue-700 dark:text-blue-300 dark:border-blue-800' : ''}`} title={badge.tooltip}>
                      {badge.icon}
                      <span className="ml-1 font-medium">{badge.text}</span>
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            
            {userData.bio && (
              <p className="text-muted-foreground text-sm">
                {userData.bio}
              </p>
            )}
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => openFollowersModal('followers')}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-4 w-4 text-blue-400 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">{stats.followers}</div>
                <div className="text-xs text-muted-foreground">Followers</div>
              </button>
              <button
                type="button"
                onClick={() => openFollowersModal('following')}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <UserPlus className="h-4 w-4 text-green-400 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">{stats.following}</div>
                <div className="text-xs text-muted-foreground">Following</div>
              </button>
              <button
                type="button"
                onClick={() => setShowCustomersModal(true)}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <ShoppingBag className="h-4 w-4 text-orange-400 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">{stats.customers}</div>
                <div className="text-xs text-muted-foreground">Customers</div>
              </button>
              <button
                type="button"
                onClick={() => setShowViewsModal(true)}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Eye className="h-4 w-4 text-purple-400 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">{stats.views}</div>
                <div className="text-xs text-muted-foreground">Views</div>
              </button>
              <button
                type="button"
                onClick={() => { console.log('Likes button clicked'); setShowLikesModal(true); }}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <Heart className="h-4 w-4 text-red-400 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">{stats.likes}</div>
                <div className="text-xs text-muted-foreground">Likes</div>
              </button>
              <button
                type="button"
                onClick={() => setShowEarningsModal(true)}
                className="text-center p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="flex items-center justify-center mb-1">
                  <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                </div>
                <div className="font-semibold text-sm text-foreground">${stats.earned}</div>
                <div className="text-xs text-muted-foreground">Earned</div>
              </button>
            </div>
          </div>
        </div>
      </Card>

      <FollowersModal
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        userId={userData.id}
        initialTab={modalTab}
      />
      <CustomersModal open={showCustomersModal} onOpenChange={setShowCustomersModal} userId={userData.id} />
      <ViewsModal open={showViewsModal} onOpenChange={setShowViewsModal} userId={userData.id} />
      <LikesModal open={showLikesModal} onOpenChange={setShowLikesModal} userId={userData.id} />
      <EarningsModal open={showEarningsModal} onOpenChange={setShowEarningsModal} userId={userData.id} />
    </>
  );
};
