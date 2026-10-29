import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
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
  Heart,
  Eye,
  DollarSign,
  UserPlus,
  Grid3X3,
  Settings,
  Plus,
  Crown,
  Compass,
  ChevronRight,
  Sparkles,
  BadgeCheck,
  Building2,
} from 'lucide-react';
import CreateGroupModalFull from './CreateGroupModalFull';
import { FollowersModal } from './FollowersModal';
import {
  CustomersModal,
  ViewsModal,
  LikesModal,
  EarningsModal,
} from './ProfileStatsModals';
import { getVerificationBadge } from '@/utils/verificationUtils';
import { cn } from '@/lib/utils';

interface MobileOffcanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Stat tile (matches ProfileSection) ──────────────────────────────────────

const StatTile = ({
  icon: Icon,
  value,
  label,
  tone,
  onClick,
  prefix,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: 'blue' | 'emerald' | 'orange' | 'purple' | 'pink' | 'amber';
  onClick: () => void;
  prefix?: string;
}) => {
  const tones = {
    blue: {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      ring: 'ring-blue-500/15',
      hover: 'hover:ring-blue-500/40 hover:bg-blue-500/[0.06]',
    },
    emerald: {
      icon: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/15',
      hover: 'hover:ring-emerald-500/40 hover:bg-emerald-500/[0.06]',
    },
    orange: {
      icon: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-500/10',
      ring: 'ring-orange-500/15',
      hover: 'hover:ring-orange-500/40 hover:bg-orange-500/[0.06]',
    },
    purple: {
      icon: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-500/10',
      ring: 'ring-purple-500/15',
      hover: 'hover:ring-purple-500/40 hover:bg-purple-500/[0.06]',
    },
    pink: {
      icon: 'text-pink-500 dark:text-pink-400',
      bg: 'bg-pink-500/10',
      ring: 'ring-pink-500/15',
      hover: 'hover:ring-pink-500/40 hover:bg-pink-500/[0.06]',
    },
    amber: {
      icon: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/15',
      hover: 'hover:ring-amber-500/40 hover:bg-amber-500/[0.06]',
    },
  };
  const t = tones[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-1 rounded-xl p-2.5 ring-1 transition-all duration-200',
        'bg-card/60 backdrop-blur-sm',
        t.ring,
        t.hover,
        'hover:shadow-sm active:scale-[0.97]',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
          t.bg,
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', t.icon)} />
      </div>
      <div className="text-[13px] font-bold tabular-nums leading-none text-foreground">
        {prefix}
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </button>
  );
};

// ─── Quick link config ────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { icon: User, label: 'Profile', route: '/profile', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/20' },
  { icon: Wallet, label: 'Wallet', route: '/wallet', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20' },
  { icon: Megaphone, label: 'Ad Center', route: '/campaigns', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/20' },
  { icon: Store, label: 'My Store', route: '/my-store', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  { icon: Grid3X3, label: 'Square', route: '/square', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-500/20' },
  { icon: MessageCircle, label: 'Messages', route: '/messages', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20' },
  { icon: Calendar, label: 'Events', route: '/events', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/20' },
  { icon: Settings, label: 'Settings', route: '/settings', bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-500/20' },
] as const;

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({
  icon: Icon,
  title,
  action,
  accent = 'purple',
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
  accent?: 'blue' | 'purple' | 'emerald' | 'amber';
}) => {
  const accents = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  };
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg ring-1',
            accents[accent],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-bold tracking-tight truncate">{title}</h3>
      </div>
      {action}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const MobileOffcanvas: React.FC<MobileOffcanvasProps> = ({ open, onOpenChange }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    customers: 0,
    views: 0,
    likes: 0,
    earned: 0,
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
      fetchOrganization();
      fetchUserStats();
      fetchGroups();
    } else {
      setOrganization(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const fetchMobileEvents = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(
          'id, content, event_date, event_location, event_banner, event_description, user_id, user:users!posts_user_id_fkey(id)',
        )
        .eq('post_type', 'event')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(3);
      if (!error) setMobileEvents(data || []);
    };
    fetchMobileEvents();
  }, []);

  useEffect(() => {
    if (mobileEvents.length > 1) {
      const interval = setInterval(() => {
        setCurrentEventIndex((prev: number) =>
          prev >= mobileEvents.length - 1 ? 0 : prev + 1,
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
          verified: user.user_metadata?.verified || false,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchOrganization = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setOrganization(data || null);
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

      const totalLikes =
        posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
      const totalViews = (posts?.length ?? 0) * 150;

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('store_id', user.id)
        .eq('status', 'completed');

      const totalEarned =
        orders?.reduce(
          (sum, order) => sum + (Number(order.total_amount) || 0),
          0,
        ) || 0;

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
        earned: totalEarned,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setStats({
        followers: 234,
        following: 189,
        customers: 45,
        views: 15420,
        likes: 1250,
        earned: 2450,
      });
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id);
    const groupIds = memberships?.map((m: any) => m.group_id) || [];

    const { data: groups } = await supabase
      .from('groups')
      .select('*')
      .or(`id.in.(${groupIds.join(',')}),created_by.eq.${user.id}`);
    const myGroupsData = (groups || []).map((g) => ({
      ...g,
      isCreator: g.created_by === user.id,
    }));
    setMyGroups(myGroupsData);

    const { data: allGroups } = await supabase.from('groups').select('*');
    const suggested = (allGroups || []).filter(
      (g: any) => !myGroupsData.some((mg: any) => mg.id === g.id),
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
          setStats((prev) => ({ ...prev, likes }));
        }
      } catch (err) {}
    };

    window.addEventListener(
      'profile-likes-updated',
      onProfileLikesUpdated as EventListener,
    );
    return () =>
      window.removeEventListener(
        'profile-likes-updated',
        onProfileLikesUpdated as EventListener,
      );
  }, [userData, user]);

  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent('mobile-offcanvas-opened', { detail: { open } }),
      );
    } catch (e) {}
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    try {
      window.dispatchEvent(
        new CustomEvent('mobile-offcanvas-changing', {
          detail: { willBeOpen: newOpen },
        }),
      );
    } catch (e) {}
    onOpenChange(newOpen);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // ─── Not authenticated state ──────────────────────────────────────────────

  if (!user) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="left"
          className="w-80 border-r border-border/60 bg-card p-0 z-[60]"
        >
          <SheetHeader className="border-b border-border/60 p-4">
            <SheetTitle className="text-base font-bold tracking-tight">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
              <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sign in required</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Access your menu by logging in
              </p>
            </div>
            <Button
              onClick={() => navigate('/auth')}
              className={cn(
                'mt-2 h-10 gap-2 rounded-xl px-6 font-semibold',
                'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                'shadow-md shadow-purple-500/25',
              )}
            >
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const profileUrl = `/profile/${userData?.username || user.user_metadata?.username || ''}`;

  // ─── Main authenticated state ─────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="left"
          className="w-80 max-h-screen overflow-y-auto border-r border-border/60 bg-card p-0 z-[60] flex flex-col"
        >
          <div className="p-4 space-y-5 flex-1">
            {/* ═══════════════════════════════════════════════════════════
                PROFILE CARD (matches ProfileSection)
               ═══════════════════════════════════════════════════════════ */}
            <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
              {/* Cover photo */}
              <div
                className="relative h-28 cursor-pointer bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500"
                style={{
                  backgroundImage: userData?.cover_photo_url
                    ? `url(${getMediaUrl(userData.cover_photo_url, 'posts')})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => navigate(profileUrl)}
                title="View Profile"
                role="button"
                tabIndex={0}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
              </div>

              <div className="px-5 pb-5">
                {/* Avatar */}
                <div className="relative -mt-12 mb-3 flex items-end justify-between gap-3">
                  <div
                    className="inline-block cursor-pointer"
                    onClick={() => navigate(profileUrl)}
                    title="View Profile"
                    role="button"
                    tabIndex={0}
                  >
                    <Avatar className="h-20 w-20 ring-4 ring-card shadow-lg">
                      <AvatarImage
                        src={
                          userData?.avatar_url
                            ? getMediaUrl(userData.avatar_url, 'posts')
                            : '/placeholder.svg'
                        }
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 text-white text-lg font-bold">
                        {userData?.first_name?.[0] ||
                          user?.user_metadata?.first_name?.[0] ||
                          user?.email?.[0]?.toUpperCase()}
                        {userData?.last_name?.[0] ||
                          user?.user_metadata?.last_name?.[0] ||
                          userData?.username?.[0] ||
                          user?.user_metadata?.username?.[0] ||
                          user?.email?.split('@')[0]?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {organization && (
                    <button
                      type="button"
                      onClick={() => navigate(`/org/${organization.slug || organization.id}`)}
                      className="flex min-w-0 max-w-[55%] flex-col items-center gap-1 pb-1 text-center"
                      title={organization.name}
                    >
                      <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage src={organization.logo_url || undefined} alt={`${organization.name} logo`} />
                        <AvatarFallback className="rounded-md bg-muted">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="w-full truncate text-[10px] font-semibold text-foreground">
                        {organization.name}
                      </span>
                    </button>
                  )}
                </div>

                {/* Identity */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate(profileUrl)}
                      className="text-base font-bold tracking-tight text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                      title="View Profile"
                    >
                      {userData?.first_name} {userData?.last_name}
                    </button>
                    {(() => {
                      const badge = getVerificationBadge(
                        userData?.verification_level,
                        stats.followers,
                        userData?.posts_count || 0,
                      );
                      if (badge) {
                        return (
                          <span
                            title={badge.tooltip}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          >
                            <BadgeCheck className="h-3 w-3" />
                            {badge.text}
                          </span>
                        );
                      }
                      if (userData?.verified) {
                        const b = getVerificationBadge(
                          'verified',
                          stats.followers,
                          userData?.posts_count || 0,
                        );
                        return b ? (
                          <span
                            title={b.tooltip}
                            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          >
                            <BadgeCheck className="h-3 w-3" />
                            {b.text}
                          </span>
                        ) : null;
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(profileUrl)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="View Profile"
                  >
                    @{userData?.username || 'user'}
                  </button>
                  {userData?.heading && (
                    <p className="text-xs font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
                      {userData.heading}
                    </p>
                  )}
                  {userData?.bio && (
                    <p className="text-xs leading-relaxed text-foreground/75 line-clamp-2 whitespace-pre-line">
                      {userData.bio}
                    </p>
                  )}
                </div>

                {/* Stats grid */}
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  <StatTile
                    icon={Users}
                    value={stats.followers}
                    label="Followers"
                    tone="blue"
                    onClick={() => openFollowersModal('followers')}
                  />
                  <StatTile
                    icon={UserPlus}
                    value={stats.following}
                    label="Following"
                    tone="emerald"
                    onClick={() => openFollowersModal('following')}
                  />
                  <StatTile
                    icon={ShoppingBag}
                    value={stats.customers}
                    label="Customers"
                    tone="orange"
                    onClick={() => setShowCustomersModal(true)}
                  />
                  <StatTile
                    icon={Eye}
                    value={stats.views}
                    label="Views"
                    tone="purple"
                    onClick={() => setShowViewsModal(true)}
                  />
                  <StatTile
                    icon={Heart}
                    value={stats.likes}
                    label="Likes"
                    tone="pink"
                    onClick={() => setShowLikesModal(true)}
                  />
                  <StatTile
                    icon={DollarSign}
                    value={stats.earned}
                    label="Earned"
                    tone="amber"
                    prefix="$"
                    onClick={() => setShowEarningsModal(true)}
                  />
                </div>
              </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                SEARCH
               ═══════════════════════════════════════════════════════════ */}
            <div className="w-full">
              <SearchDropdown />
            </div>

            {/* ═══════════════════════════════════════════════════════════
                QUICK LINKS
               ═══════════════════════════════════════════════════════════ */}
            <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
              <SectionHeader icon={Sparkles} title="Quick Links" accent="purple" />
              <div className="space-y-1">
                {QUICK_LINKS.map(({ icon: Icon, label, route, bg, text, ring }) => (
                  <button
                    key={route}
                    onClick={() => handleNavigation(route)}
                    className={cn(
                      'group flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-all',
                      'hover:bg-muted/60 active:scale-[0.98]',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-110',
                          bg,
                          ring,
                        )}
                      >
                        <Icon className={cn('h-4 w-4', text)} />
                      </div>
                      <span className="text-[13px] font-semibold text-foreground truncate">
                        {label}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </button>
                ))}
              </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                TRENDING
               ═══════════════════════════════════════════════════════════ */}
            <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
              <TrendingCard useRouterNavigate />
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                SUGGESTED FRIENDS
               ═══════════════════════════════════════════════════════════ */}
            <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
              <SectionHeader icon={UserPlus} title="Suggested Friends" accent="blue" />
              <SuggestedFriends mobileView={true} />
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                MY GROUPS
               ═══════════════════════════════════════════════════════════ */}
            <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
              <SectionHeader
                icon={Users}
                title="My Groups"
                accent="purple"
                action={
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className={cn(
                      'group flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                      'bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white shadow-sm shadow-purple-500/25',
                      'hover:shadow-md hover:shadow-purple-500/40 hover:scale-105 active:scale-95',
                    )}
                    title="Create Group"
                    aria-label="Create Group"
                  >
                    <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
                  </button>
                }
              />

              {myGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    No groups joined yet
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Create your first group →
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {myGroups.slice(0, 5).map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all hover:bg-muted/60"
                    >
                      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                        <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-[11px] font-bold">
                          {getInitials(group.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[13px] font-semibold text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {group.name}
                          </span>
                          {group.isCreator && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 shrink-0">
                              <Crown className="h-2.5 w-2.5" />
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {group.description || 'No description'}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </button>
                  ))}
                  {myGroups.length > 5 && (
                    <button
                      onClick={() => handleNavigation('/groups')}
                      className="w-full rounded-lg py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      View all {myGroups.length} groups
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* ═══════════════════════════════════════════════════════════
                DISCOVER GROUPS
               ═══════════════════════════════════════════════════════════ */}
            <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
              <SectionHeader icon={Compass} title="Discover Groups" accent="emerald" />

              {suggestedGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    You've joined everything!
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {suggestedGroups.slice(0, 4).map((group) => (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all hover:bg-muted/60"
                    >
                      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                        <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[11px] font-bold">
                          {getInitials(group.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {group.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {group.members?.toLocaleString() ?? 0}{' '}
                          {group.members === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FOOTER — theme toggle + sign out
             ═══════════════════════════════════════════════════════════════ */}
          <div className="sticky bottom-0 z-10 border-t border-border/60 bg-card/95 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Appearance
                </span>
              </div>
              <ModeToggle />
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className={cn(
                'w-full h-10 gap-2 rounded-xl font-semibold transition-colors',
                'hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400',
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modals */}
      <FollowersModal
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        userId={userData?.id}
        initialTab={modalTab}
      />
      <CustomersModal
        open={showCustomersModal}
        onOpenChange={setShowCustomersModal}
        userId={userData?.id}
      />
      <ViewsModal
        open={showViewsModal}
        onOpenChange={setShowViewsModal}
        userId={userData?.id}
      />
      <LikesModal
        open={showLikesModal}
        onOpenChange={setShowLikesModal}
        userId={userData?.id}
      />
      <EarningsModal
        open={showEarningsModal}
        onOpenChange={setShowEarningsModal}
        userId={userData?.id}
      />
      <CreateGroupModalFull
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onGroupCreated={() => {
          setShowCreateModal(false);
          fetchGroups();
        }}
      />
    </>
  );
};