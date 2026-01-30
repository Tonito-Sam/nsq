import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SearchDropdown } from './SearchDropdown';
import { ModeToggle } from './ModeToggle';
import { SuggestedFriends } from './SuggestedFriends';
import { TrendingCard } from './TrendingCard';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getMediaUrl } from '@/utils/mediaUtils';
import {
  User,
  Wallet,
  Store,
  Megaphone,
  Users,
  LogOut,
  ShoppingBag,
  MessageCircle,
  Calendar,
  Bookmark,
  Heart,
  Eye,
  DollarSign,
  UserPlus,
  Grid3X3,
  Shield,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CreateGroupModalFull from './CreateGroupModalFull';
import { FollowersModal } from './FollowersModal';
import { CustomersModal, ViewsModal, LikesModal, EarningsModal } from './ProfileStatsModals';
import { getVerificationBadge } from '@/utils/verificationUtils';

interface MobileOffcanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileOffcanvas: React.FC<MobileOffcanvasProps> = ({ open, onOpenChange }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    customers: 0,
    views: 0,
    likes: 0,
    earned: 0
  });
  const [mobileEvents, setMobileEvents] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [modalTab, setModalTab] = useState<'followers' | 'following'>('followers');
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchUserStats();
      fetchGroups();
    }
  }, [user]);

  useEffect(() => {
    const fetchMobileEvents = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, event_date, event_location, event_banner, event_description, user_id, user:users!posts_user_id_fkey(id)')
        .eq('post_type', 'event')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(3);
      if (!error) setMobileEvents(data || []);
    };
    fetchMobileEvents();
  }, []);

  // Slider logic for mobile events
  useEffect(() => {
    if (mobileEvents.length > 1) {
      const interval = setInterval(() => {
        setCurrentEventIndex((prev: number) =>
          prev >= mobileEvents.length - 1 ? 0 : prev + 1
        );
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [mobileEvents.length]);

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (dbUser) {
        setUserData(dbUser);
      } else {
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
    }
  };

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      const { count: customersCount } = await supabase
        .from('orders')
        .select('user_id', { count: 'exact', head: true })
        .eq('store_id', user.id);

      const { data: posts } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('user_id', user.id);

      const totalLikes = posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
      const totalViews = (posts?.length ?? 0) * 150;

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('store_id', user.id)
        .eq('status', 'completed');

      const totalEarned = orders?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;

      // Fetch profile likes count from profile_likes table
      let profileLikesCount = 0;
      try {
        const { count: pLikesCount, error: pErr } = await supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('liked_profile_id', user.id);
        if (!pErr) profileLikesCount = pLikesCount || 0;
      } catch (e) {
        console.warn('Error fetching profile likes for offcanvas:', e);
      }

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

  const fetchGroups = async () => {
    if (!user) return;
    // Fetch group IDs where user is a member
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id);
    const groupIds = memberships?.map((m: any) => m.group_id) || [];

    // Fetch groups where user is a member or creator
    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .or(`id.in.(${groupIds.join(',')}),created_by.eq.${user.id}`);
    // Mark isCreator for each group
    const myGroupsData = (groups || []).map(g => ({
      ...g,
      isCreator: g.created_by === user.id
    }));
    setMyGroups(myGroupsData);

    // Fetch suggested groups (not a member or creator)
    const { data: allGroups } = await supabase
      .from('groups')
      .select('*');
    const suggested = (allGroups || []).filter(
      (g: any) => !myGroupsData.some((mg: any) => mg.id === g.id)
    );
    setSuggestedGroups(suggested);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    onOpenChange(false);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const openFollowersModal = (tab: 'followers' | 'following') => {
    setModalTab(tab);
    setShowFollowersModal(true);
  };

  useEffect(() => {
    const onProfileLikesUpdated = (e: any) => {
      try {
        if (!e || !e.detail) return;
        const { userId, likes } = e.detail;
        if (userId === user?.id || userId === userData?.id) {
          setStats(prev => ({ ...prev, likes: likes }));
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
    return () => window.removeEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
  }, [userData, user]);

  // Notify other parts of the app when the mobile offcanvas is opened/closed
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('mobile-offcanvas-opened', { detail: { open } }));
    } catch (e) {
      // ignore
    }
  }, [open]);

  // Also notify when the offcanvas is about to open/close
  const handleOpenChange = (newOpen: boolean) => {
    // Notify before the actual change for smoother transitions
    try {
      window.dispatchEvent(new CustomEvent('mobile-offcanvas-changing', { 
        detail: { willBeOpen: newOpen } 
      }));
    } catch (e) {
      // ignore
    }
    
    onOpenChange(newOpen);
  };

  if (!user) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="left" className="w-80 bg-white dark:bg-[#1a1a1a] p-0 z-[60]">
          <SheetHeader className="p-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400">Please sign in to access menu</p>
            <Button onClick={() => navigate('/auth')} className="mt-4">
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent 
          side="left" 
          className="w-80 bg-white dark:bg-[#1a1a1a] p-0 overflow-y-auto max-h-screen flex flex-col z-[60]"
        >
          <div className="p-4 space-y-6 flex-1">
            {/* Profile Section */}
            <div className="w-full">
              <div className="overflow-hidden dark:bg-[#161616] dark:border-gray-700 bg-white border border-gray-200 rounded-lg">
                {/* Cover Photo */}
                <div
                  className="h-32 bg-gradient-to-r from-purple-600 via-yellow-400 to-purple-600 relative cursor-pointer"
                  style={{
                    backgroundImage: userData?.cover_photo_url ? `url(${getMediaUrl(userData.cover_photo_url, 'posts')})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                  onClick={() => navigate(`/profile/${userData?.username}`)}
                  title="View Profile"
                />
                <div className="p-6 text-center relative">
                  {/* Profile Picture */}
                  <div className="relative -mt-12 mb-2 cursor-pointer" onClick={() => navigate(`/profile/${userData?.username}`)} title="View Profile">
                    <Avatar className="h-20 w-20 mx-auto border-4 border-white shadow-lg">
                      <AvatarImage 
                        src={userData?.avatar_url ? getMediaUrl(userData.avatar_url, 'posts') : ''} 
                      />
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg">
                        {userData?.first_name?.[0] || user?.user_metadata?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                        {userData?.last_name?.[0] || user?.user_metadata?.last_name?.[0] || userData?.username?.[0] || user?.user_metadata?.username?.[0] || user?.email?.split('@')[0]?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Full Name & Username */}
                  <h3
                    className="font-semibold text-lg mt-3 text-gray-900 dark:text-gray-100 cursor-pointer"
                    onClick={() => navigate(`/profile/${userData?.username}`)}
                    title="View Profile"
                    tabIndex={0}
                    role="button"
                  >
                    {userData?.first_name} {userData?.last_name}
                  </h3>
                  <p
                    className="text-gray-500 dark:text-gray-400 text-sm cursor-pointer"
                    onClick={() => navigate(`/profile/${userData?.username}`)}
                    title="View Profile"
                    tabIndex={0}
                    role="button"
                  >
                    @{userData?.username || 'user'}
                  </p>
                  {/* Verification badge */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    {(() => {
                      const badge = getVerificationBadge(userData?.verification_level, stats.followers, (userData?.posts_count || 0));
                      if (badge) {
                        return (
                          <div className={`text-xs px-2 py-1 rounded-full ${badge.color} flex items-center gap-1`} title={badge.tooltip}>
                            {badge.icon}
                            <span className="font-medium">{badge.text}</span>
                          </div>
                        );
                      }
                      if (userData?.verified) {
                        const b = getVerificationBadge('verified', stats.followers, (userData?.posts_count || 0));
                        return (
                          <div className={`text-xs px-2 py-1 rounded-full ${b?.color}`} title={b?.tooltip}>
                            {b?.icon}
                            <span className="font-medium">{b?.text}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Profile Likes */}
                    <div className="text-xs px-2 py-1 rounded-full bg-pink-50 text-pink-700 dark:bg-pink-900/10 dark:text-pink-300 flex items-center gap-1">
                      <Heart className="h-3 w-3 text-pink-600" />
                      <span className="font-medium">{stats.likes}</span>
                    </div>
                  </div>
                  {userData?.heading && (
                    <div className="text-blue-600 dark:text-blue-400 font-medium text-sm mb-1 text-center w-full">{userData.heading}</div>
                  )}
                  {userData?.bio && (
                    <div className="text-gray-500 dark:text-gray-300 text-sm mb-2 text-center w-full whitespace-pre-line">{userData.bio}</div>
                  )}
                  {/* Stats Buttons with Modals */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <button type="button" className="text-center" onClick={() => openFollowersModal('following')}>
                      <div className="flex justify-center mb-2">
                        <UserPlus className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{stats.following}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>
                    </button>
                    <button type="button" className="text-center" onClick={() => openFollowersModal('followers')}>
                      <div className="flex justify-center mb-2">
                        <Users className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{stats.followers}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>
                    </button>
                    <button type="button" className="text-center" onClick={() => setShowCustomersModal(true)}>
                      <div className="flex justify-center mb-2">
                        <ShoppingBag className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{stats.customers}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Customers</div>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <button type="button" className="text-center" onClick={() => setShowViewsModal(true)}>
                      <div className="flex justify-center mb-2">
                        <Eye className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{stats.views}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Views</div>
                    </button>
                    <button type="button" className="text-center" onClick={() => setShowLikesModal(true)}>
                      <div className="flex justify-center mb-2">
                        <Heart className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{stats.likes}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Likes</div>
                    </button>
                    <button type="button" className="text-center" onClick={() => setShowEarningsModal(true)}>
                      <div className="flex justify-center mb-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">${stats.earned}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Earned</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="w-full mt-4">
              <SearchDropdown />
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-[#161616] rounded-lg p-4 shadow-sm border dark:border-gray-700">
              <h3 className="font-semibold mb-4 text-purple-600 dark:text-purple-400">Quick Links</h3>
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/profile')}
                >
                  <User className="h-5 w-5 mr-3 text-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300">Profile</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/wallet')}
                >
                  <Wallet className="h-5 w-5 mr-3 text-yellow-600" />
                  <span className="text-gray-700 dark:text-gray-300">Wallet</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/campaigns')}
                >
                  <Megaphone className="h-5 w-5 mr-3 text-pink-600" />
                  <span className="text-gray-700 dark:text-gray-300">Ad Center</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/my-store')}
                >
                  <Store className="h-5 w-5 mr-3 text-green-600" />
                  <span className="text-gray-700 dark:text-gray-300">My Store</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/square')}
                >
                  <Grid3X3 className="h-5 w-5 mr-3 text-purple-600" />
                  <span className="text-gray-700 dark:text-gray-300">Square</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/messages')}
                >
                  <MessageCircle className="h-5 w-5 mr-3 text-blue-500" />
                  <span className="text-gray-700 dark:text-gray-300">Messages</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/events')}
                >
                  <Calendar className="h-5 w-5 mr-3 text-red-600" />
                  <span className="text-gray-700 dark:text-gray-300">Events</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => handleNavigation('/settings')}
                >
                  <Settings className="h-5 w-5 mr-3 text-gray-700 dark:text-gray-300" />
                  <span className="text-gray-700 dark:text-gray-300">Settings</span>
                </Button>
              </div>
            </div>

            {/* Trending Card */}
            <div className="bg-white dark:bg-[#161616] rounded-lg p-4 shadow-sm border dark:border-gray-700 mt-4">
              <TrendingCard useRouterNavigate />
            </div>

            {/* Suggested Friends */}
            <div className="bg-white dark:bg-[#161616] rounded-lg p-4 shadow-sm border dark:border-gray-700">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-purple-600 dark:text-purple-400">
                  Suggested Friends
                </h3>
              </div>
              <SuggestedFriends mobileView={true} />
            </div>

            {/* Groups Section */}
            <div>
              <div className="flex items-center justify-between mb-2 mt-6">
                <h3 className="font-semibold text-lg">Groups</h3>
                <Button size="icon" variant="outline" onClick={() => setShowCreateModal(true)} title="Create Group">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              {/* My Groups or Empty State */}
              <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 mb-2">
                {myGroups.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">
                    You haven't joined any groups yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg group"
                        onClick={() => navigate(`/groups/${group.id}`)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                          <AvatarFallback className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm">
                            {group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {group.name}
                            </span>
                            {group.isNew && (
                              <Badge className="bg-green-500 text-white text-xs">New</Badge>
                            )}
                            {group.isCreator && (
                              <Badge className="bg-blue-500 text-white text-xs">Creator</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {group.description || 'No description'}
                          </p>
                        </div>
                        {!group.isCreator && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="opacity-0 group-hover:opacity-100 text-xs h-6 px-2"
                            onClick={e => { e.stopPropagation(); }}
                          >
                            Leave
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Discover Groups */}
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-md mb-2 mt-4">Discover Groups</div>
              <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
                {suggestedGroups.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-4">
                    No more groups to discover.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suggestedGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between cursor-pointer" onClick={() => navigate(`/groups/${group.id}`)}>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                            <AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs">
                              {group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {group.name}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {group.members || 0} members
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs"
                          onClick={e => { e.stopPropagation(); }}
                        >
                          Join
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
          {/* Footer with theme toggle and sign out */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <ModeToggle />
            </div>
            <Button variant="outline" className="w-full flex items-center gap-2 justify-center" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Profile Stats Modals */}
      <FollowersModal open={showFollowersModal} onOpenChange={setShowFollowersModal} userId={userData?.id} initialTab={modalTab} />
      <CustomersModal open={showCustomersModal} onOpenChange={setShowCustomersModal} userId={userData?.id} />
      <ViewsModal open={showViewsModal} onOpenChange={setShowViewsModal} userId={userData?.id} />
      <LikesModal open={showLikesModal} onOpenChange={setShowLikesModal} userId={userData?.id} />
      <EarningsModal open={showEarningsModal} onOpenChange={setShowEarningsModal} userId={userData?.id} />
      {/* Create Group Modal */}
      <CreateGroupModalFull open={showCreateModal} onOpenChange={setShowCreateModal} onGroupCreated={() => { setShowCreateModal(false); fetchGroups(); }} />
    </>
  );
};