import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  UserPlus,
  Heart,
  Eye,
  DollarSign,
  ShoppingBag,
  BadgeCheck,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { FollowersModal } from './FollowersModal';
import {
  CustomersModal,
  ViewsModal,
  LikesModal,
  EarningsModal,
} from './ProfileStatsModals';
import { getMediaUrl } from '@/utils/mediaUtils';
import { getVerificationBadge } from '@/utils/verificationUtils';
import { cn } from '@/lib/utils';
import type { Organization } from '@/types/organization';

// ─── Stat tile ────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export const ProfileSection = () => {
  const { user } = useAuth();
  const { username } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationIndex, setActiveOrganizationIndex] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [modalTab, setModalTab] = useState<'followers' | 'following'>('followers');
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    customers: 0,
    views: 0,
    likes: 0,
    earned: 0,
  });
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);

  useEffect(() => {
    if (!userData?.id) {
      setOrganizations([]);
      return;
    }

    let cancelled = false;
    const loadOrganizations = async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, owner_id, name, slug, logo_url, verified, members_count, followers_count, created_at, updated_at')
        .eq('owner_id', userData.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load profile organizations:', error);
        return;
      }

      if (!cancelled) {
        setOrganizations(data || []);
        setActiveOrganizationIndex(0);
      }
    };

    void loadOrganizations();
    return () => { cancelled = true; };
  }, [userData?.id]);

  useEffect(() => {
    if (username) {
      fetchUserDataByUsername(username);
    } else if (user) {
      fetchUserData();
      fetchUserStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, username]);

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const { data: dbUser, error } = await supabase
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
          username:
            user.user_metadata?.username || user.email?.split('@')[0] || 'user',
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
      setUserData({
        id: user.id,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        username:
          user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || '',
        cover_photo_url: user.user_metadata?.cover_photo_url || '',
        bio: user.user_metadata?.bio || '',
        heading: user.user_metadata?.heading || '',
        verified: user.user_metadata?.verified || false,
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
      const postsCount = Array.isArray(posts) ? posts.length : 0;
      const totalViews = postsCount * 150;

      let profileLikesCount = 0;
      try {
        const { count: pLikesCount, error: pErr } = await supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('liked_profile_id', user.id);
        if (!pErr) profileLikesCount = pLikesCount || 0;
      } catch (e) {}

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
      const totalLikes =
        posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
      const postsCount = Array.isArray(posts) ? posts.length : 0;
      const totalViews = postsCount * 150;

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
      const totalEarned =
        orders?.reduce(
          (sum, order) => sum + (Number(order.total_amount) || 0),
          0,
        ) || 0;

      setStats({
        followers: followersCount || 0,
        following: followingCount || 0,
        customers: customersCount || 0,
        views: totalViews,
        likes: profileLikesCount || totalLikes,
        earned: totalEarned,
      });
    } catch (error) {
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

  const openFollowersModal = (tab: 'followers' | 'following') => {
    setModalTab(tab);
    setShowFollowersModal(true);
  };

  // Live profile likes updates
  useEffect(() => {
    const onProfileLikesUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;
        if (userData && detail.userId === userData.id) {
          setStats((prev) => ({ ...prev, likes: detail.likes || 0 }));
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
  }, [userData]);

  if (!userData) {
    return (
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card">
        <div className="h-32 bg-muted animate-pulse" />
        <div className="p-6">
          <div className="-mt-16 mb-4 h-24 w-24 rounded-full bg-muted ring-4 ring-card animate-pulse" />
          <div className="space-y-3">
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-muted/60 ring-1 ring-border/40 animate-pulse"
              />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const profileUrl = `/profile/${userData.username}`;

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
        {/* ── Cover photo ── */}
        <div
          className="relative h-32 cursor-pointer bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500 transition-opacity hover:opacity-95"
          style={{
            backgroundImage: userData.cover_photo_url
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
          {/* Bottom fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {/* Decorative orb */}
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
        </div>

        <div className="px-5 pb-5">
          {/* ── Avatar ── */}
          <div
            className="relative -mt-14 mb-3 cursor-pointer inline-block"
            onClick={() => navigate(profileUrl)}
            title="View Profile"
            role="button"
            tabIndex={0}
          >
            <Avatar className="h-24 w-24 ring-4 ring-card shadow-lg">
              <AvatarImage
                src={
                  userData.avatar_url
                    ? getMediaUrl(userData.avatar_url, 'posts')
                    : '/placeholder.svg'
                }
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 text-white text-xl font-bold">
                {userData.first_name?.[0]}
                {userData.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* ── Identity ── */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate(profileUrl)}
                    className="text-base font-bold tracking-tight text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                    title="View Profile"
                  >
                    {userData.first_name} {userData.last_name}
                  </button>
                  {(() => {
                    const badge = getVerificationBadge(
                      undefined,
                      stats.followers,
                      userData?.posts_count || 0,
                    );
                    if (!badge) return null;
                    return (
                      <span
                        title={badge.tooltip}
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        )}
                      >
                        <BadgeCheck className="h-3 w-3" />
                        {badge.text}
                      </span>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(profileUrl)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="View Profile"
                >
                  @{userData.username}
                </button>
                {userData.heading && (
                  <p className="mt-1 text-xs font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
                    {userData.heading}
                  </p>
                )}
              </div>

              {organizations.length > 0 && (
                <div className="w-[68px] shrink-0 text-center">
                  {(() => {
                    const organization = organizations[activeOrganizationIndex];
                    if (!organization) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => navigate(`/org/${organization.slug || organization.id}`)}
                        aria-label={`View ${organization.name}`}
                        title={organization.name}
                        className="mx-auto flex w-full flex-col items-center gap-1 rounded-xl p-1 transition-colors hover:bg-muted/60"
                      >
                        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                          {organization.logo_url ? (
                            <img src={organization.logo_url} alt={`${organization.name} logo`} className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          )}
                        </span>
                        <span className="w-full truncate text-[10px] font-semibold leading-tight text-muted-foreground">
                          {organization.name}
                        </span>
                      </button>
                    );
                  })()}
                  {organizations.length > 1 && (
                    <div className="mt-0.5 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        aria-label="Previous organization"
                        title="Previous organization"
                        onClick={() => setActiveOrganizationIndex((index) => (index - 1 + organizations.length) % organizations.length)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        {activeOrganizationIndex + 1}/{organizations.length}
                      </span>
                      <button
                        type="button"
                        aria-label="Next organization"
                        title="Next organization"
                        onClick={() => setActiveOrganizationIndex((index) => (index + 1) % organizations.length)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {userData.bio && (
              <p className="text-xs leading-relaxed text-foreground/75 line-clamp-2">
                {userData.bio}
              </p>
            )}
          </div>

          {/* ── Stats grid ── */}
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

      <FollowersModal
        open={showFollowersModal}
        onOpenChange={setShowFollowersModal}
        userId={userData.id}
        initialTab={modalTab}
      />
      <CustomersModal
        open={showCustomersModal}
        onOpenChange={setShowCustomersModal}
        userId={userData.id}
      />
      <ViewsModal
        open={showViewsModal}
        onOpenChange={setShowViewsModal}
        userId={userData.id}
      />
      <LikesModal
        open={showLikesModal}
        onOpenChange={setShowLikesModal}
        userId={userData.id}
      />
      <EarningsModal
        open={showEarningsModal}
        onOpenChange={setShowEarningsModal}
        userId={userData.id}
      />
    </>
  );
};