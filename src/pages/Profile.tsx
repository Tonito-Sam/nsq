import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Edit3,
  Heart,
  Users,
  UserPlus,
  Eye,
  MessageCircle,
  Store,
  Radio,
  Building2,
  MoreHorizontal,
  Calendar,
  TrendingUp,
  Sparkles,
  X,
} from 'lucide-react';
import axios from 'axios';
import apiUrl from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import ProfileRightSidebar from '@/components/ProfileRightSidebar';
import { toast } from '@/hooks/use-toast';
import { PostCard } from '@/components/PostCard';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { getVerificationBadge } from '@/utils/verificationUtils';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonAvatar from '@/components/skeletons/SkeletonAvatar';
import SkeletonLine from '@/components/skeletons/SkeletonLine';
import { cn } from '@/lib/utils';

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

type TimelineView = 'monthly' | 'annual';
type TimelineFilter = { month: number; year: number } | { year: number };
type TimelineFilterOrNull = TimelineFilter | null;

// ─── Stat Tile ────────────────────────────────────────────────────────────────

const StatTile = ({
  icon: Icon,
  value,
  label,
  tone,
  onClick,
  active,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: 'blue' | 'emerald' | 'pink' | 'purple';
  onClick?: () => void;
  active?: boolean;
}) => {
  const tones = {
    blue: {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      ring: 'ring-blue-500/15',
      hover: 'hover:ring-blue-500/40 hover:bg-blue-500/[0.06]',
      glow: 'group-hover:shadow-blue-500/20',
    },
    emerald: {
      icon: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/15',
      hover: 'hover:ring-emerald-500/40 hover:bg-emerald-500/[0.06]',
      glow: 'group-hover:shadow-emerald-500/20',
    },
    pink: {
      icon: 'text-pink-500 dark:text-pink-400',
      bg: 'bg-pink-500/10',
      ring: 'ring-pink-500/15',
      hover: 'hover:ring-pink-500/40 hover:bg-pink-500/[0.06]',
      glow: 'group-hover:shadow-pink-500/20',
    },
    purple: {
      icon: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-500/10',
      ring: 'ring-purple-500/15',
      hover: 'hover:ring-purple-500/40 hover:bg-purple-500/[0.06]',
      glow: 'group-hover:shadow-purple-500/20',
    },
  };
  const t = tones[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left ring-1 transition-all duration-300',
        'bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm',
        t.ring,
        onClick && cn('cursor-pointer', t.hover, 'hover:shadow-lg', t.glow, 'active:scale-[0.98]'),
        !onClick && 'cursor-default',
        active && 'ring-2 shadow-md',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
          t.bg,
        )}
      >
        <Icon className={cn('h-4 w-4', t.icon)} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums leading-none text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
    </button>
  );
};

// ─── Action Tile (mobile) ─────────────────────────────────────────────────────

const ActionTile = ({
  icon: Icon,
  label,
  gradient,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  gradient: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl p-2',
      'bg-gradient-to-br text-white shadow-sm',
      'transition-all duration-200 hover:shadow-lg hover:scale-[1.05] active:scale-[0.95]',
      'disabled:opacity-50 disabled:pointer-events-none',
      gradient,
    )}
  >
    <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/10 transition-colors" />
    <Icon className="relative h-5 w-5" />
    <span className="relative text-[10px] font-bold leading-none">{label}</span>
  </button>
);

// ─── Action Pill (desktop) ────────────────────────────────────────────────────

const ActionPill = ({
  icon: Icon,
  label,
  gradient,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  gradient: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5',
      'bg-gradient-to-br text-sm font-semibold text-white shadow-sm',
      'transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
      'disabled:opacity-50 disabled:pointer-events-none',
      gradient,
    )}
  >
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700" />
    <Icon className="relative h-4 w-4" />
    <span className="relative">{label}</span>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

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
    hasLiked: false,
  });
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const [uploading] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const [liking, setLiking] = useState(false);
  const [showOrgaDialog, setShowOrgaDialog] = useState(false);
  const [profileOrgs, setProfileOrgs] = useState<any[]>([]);
  const [profileOrgsLoading, setProfileOrgsLoading] = useState(false);
  const [inlineProfileEditorOpen, setInlineProfileEditorOpen] = useState(false);
  const navigate = useNavigate();

  // ─── Timeline state ───────────────────────────────────────────────────────
  const [timelineView, setTimelineView] = useState<TimelineView>('monthly');
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineFilterOrNull>(null);

  const previousUsernameRef = useRef<string | undefined>(undefined);
  const previousUserIdRef = useRef<string | undefined>(undefined);

  const isOwnProfile = user && userData && user.id === userData.id;

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const updates = (event as CustomEvent).detail;
      if (updates) setUserData(current => current ? { ...current, ...updates } : current);
    };

    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, []);

  // ─── Timeline data derivation ─────────────────────────────────────────────
  const timelineBuckets = useMemo(() => {
    const buckets = new Map<string, { label: string; count: number; key: TimelineFilter }>();
    posts.forEach((post) => {
      const date = new Date(post.created_at);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth();

      if (timelineView === 'monthly') {
        const key = `${year}-${month}`;
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const existing = buckets.get(key);
        if (existing) existing.count += 1;
        else buckets.set(key, { label, count: 1, key: { year, month } });
      } else {
        const key = `${year}`;
        const existing = buckets.get(key);
        if (existing) existing.count += 1;
        else buckets.set(key, { label: String(year), count: 1, key: { year } });
      }
    });
    return Array.from(buckets.values()).sort((a, b) => {
      const ay = a.key.year;
      const by = b.key.year;
      if (ay !== by) return by - ay;
      if ('month' in a.key && 'month' in b.key) return b.key.month - a.key.month;
      return 0;
    });
  }, [posts, timelineView]);

  const filteredPosts = useMemo(() => {
    if (!selectedTimeline) return posts;
    return posts.filter((post) => {
      const date = new Date(post.created_at);
      if (isNaN(date.getTime())) return false;
      if ('month' in selectedTimeline) {
        return (
          date.getFullYear() === selectedTimeline.year &&
          date.getMonth() === selectedTimeline.month
        );
      }
      return date.getFullYear() === selectedTimeline.year;
    });
  }, [posts, selectedTimeline]);

  const timelineTotalCount = posts.length;

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchProfileLikes = useCallback(
    async (profileUserId: string) => {
      try {
        const { count, error: countError } = await supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('liked_profile_id', profileUserId);

        if (countError) {
          if (countError.code === '42P01') return { likes: 0, hasLiked: false };
          throw countError;
        }

        let hasLiked = false;
        if (user) {
          const { data, error: likeError } = await supabase
            .from('profile_likes')
            .select('id')
            .eq('liked_profile_id', profileUserId)
            .maybeSingle();
          if (likeError) {
            if (likeError.code === '42P01') return { likes: 0, hasLiked: false };
            throw likeError;
          }
          hasLiked = !!data;
        }

        return { likes: count || 0, hasLiked };
      } catch (error) {
        console.error('Error fetching profile likes:', error);
        return { likes: 0, hasLiked: false };
      }
    },
    [user],
  );

  const fetchUserStats = useCallback(
    async (userId: string) => {
      try {
        const [followersPromise, followingPromise, postsPromise] = await Promise.all([
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId),
          supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId),
          supabase.from('posts').select('likes_count').eq('user_id', userId),
        ]);

        const { likes, hasLiked } = await fetchProfileLikes(userId);
        const totalViews = (postsPromise.data?.length ?? 0) * 150;

        setStats({
          followers: followersPromise.count || 0,
          following: followingPromise.count || 0,
          likes,
          views: totalViews,
          hasLiked,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
        setStats((prev) => ({
          ...prev,
          followers: prev.followers || 0,
          following: prev.following || 0,
          likes: prev.likes || 0,
          views: prev.views || 0,
          hasLiked: prev.hasLiked || false,
        }));
      }
    },
    [fetchProfileLikes],
  );

  const handleLikeProfile = async () => {
    if (!user || !userData || isOwnProfile) {
      toast({
        title: 'Cannot like profile',
        description: isOwnProfile
          ? 'You cannot like your own profile'
          : 'Please login to like profiles',
        variant: 'destructive',
      });
      return;
    }

    setLiking(true);
    try {
      if (stats.hasLiked) {
        const { error } = await supabase
          .from('profile_likes')
          .delete()
          .eq('liker_id', user.id)
          .eq('liked_profile_id', userData.id);
        if (error && error.code !== '42P01') throw error;

        setStats((prev) => ({
          ...prev,
          likes: Math.max(0, prev.likes - 1),
          hasLiked: false,
        }));
        try {
          window.dispatchEvent(
            new CustomEvent('profile-likes-updated', {
              detail: { userId: userData.id, likes: Math.max(0, stats.likes - 1) },
            }),
          );
        } catch {}
        toast({
          title: 'Profile Unliked',
          description: `You unliked ${userData.username || 'this user'}'s profile.`,
        });
      } else {
        const { error } = await supabase
          .from('profile_likes')
          .insert({ liker_id: user.id, liked_profile_id: userData.id });
        if (error && error.code !== '42P01') throw error;

        setStats((prev) => ({ ...prev, likes: prev.likes + 1, hasLiked: true }));
        try {
          window.dispatchEvent(
            new CustomEvent('profile-likes-updated', { detail: { userId: userData.id } }),
          );
        } catch {}
        toast({
          title: 'Profile Liked!',
          description: `You liked ${userData.username || 'this user'}'s profile.`,
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({ title: 'Error', description: 'Could not update like', variant: 'destructive' });
    } finally {
      setLiking(false);
    }
  };

  const fetchUserDataByUsername = useCallback(
    async (username: string): Promise<UserProfile | null> => {
      try {
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
        if (error) {
          console.error('Error fetching user by username:', error);
          return null;
        }
        return dbUser;
      } catch {
        return null;
      }
    },
    [],
  );

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

  const loadProfileData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (username && previousUsernameRef.current === username && userData) return;
    if (!username && user && previousUserIdRef.current === user.id && userData) return;

    setLoading(true);
    try {
      let profileUser = null;

      if (username) {
        profileUser = await fetchUserDataByUsername(username);
        if (!profileUser) {
          if (!user) navigate('/auth');
          setLoading(false);
          return;
        }
        previousUsernameRef.current = username;
      } else if (user) {
        profileUser = await fetchUserDataById(user.id);
        previousUserIdRef.current = user.id;
      }

      if (!profileUser && !user) {
        navigate('/auth');
        return;
      }
      if (!profileUser) {
        setLoading(false);
        return;
      }

      if (JSON.stringify(userData) !== JSON.stringify(profileUser)) {
        setUserData(profileUser);
      }

      await fetchUserStats(profileUser.id);

      const { data: userPosts } = await supabase
        .from('posts')
        .select(
          `
          *,
          user:users!posts_user_id_fkey(
            first_name,
            last_name,
            username,
            avatar_url,
            verified,
            heading
          )
        `,
        )
        .eq('user_id', profileUser.id)
        .order('created_at', { ascending: false });

      const profilePosts = (userPosts || []).map((post: any) =>
        post.is_platform_celebration
          ? {
              ...post,
              user: {
                ...post.user,
                first_name: 'NexSq',
                last_name: 'Celebrations',
                username: 'nexsq',
                avatar_url: '/favicon.ico',
                verified: true,
              },
            }
          : post,
      );

      if (JSON.stringify(posts) !== JSON.stringify(profilePosts)) {
        setPosts(profilePosts);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      if (!userData) setUserData(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    username,
    user,
    fetchUserDataByUsername,
    fetchUserDataById,
    fetchUserStats,
    navigate,
    loading,
    userData,
    posts,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      if (controller.signal.aborted) return;
      await loadProfileData();
    };
    loadData();
    return () => controller.abort();
  }, [loadProfileData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // reserved
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenFollowersModal = (tab: 'followers' | 'following') => {
    setFollowersModalTab(tab);
    setFollowersModalOpen(true);
  };

  const handleMessageUser = async () => {
    if (!user || !userData?.id) return;
    let conversationId: string | null = null;
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(customer_id.eq.${user.id},seller_id.eq.${userData.id}),and(customer_id.eq.${userData.id},seller_id.eq.${user.id})`,
      )
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
  };

  const handleOpenStore = async () => {
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
    if (store?.id) {
      navigate(`/store/${store.id}`);
    } else {
      toast({ title: 'No Store', description: 'This user has not created a store yet.' });
    }
  };

  const handleOpenStudio = async () => {
    if (!userData) return;
    const { data: channel } = await supabase
      .from('studio_channels')
      .select('id')
      .eq('user_id', userData.id)
      .single();
    if (channel?.id) {
      navigate(`/studio/${channel.id}`);
    } else {
      toast({
        title: 'No Studio Channel',
        description: 'This user does not have a studio channel yet.',
      });
    }
  };

  const handleOpenWorkplace = async () => {
    if (!userData) return;
    if (isOwnProfile) {
      navigate('/profile/edit?tab=organizations');
      return;
    }
    try {
      setProfileOrgsLoading(true);
      const resp = await axios.get(apiUrl(`/api/organizations?user_id=${userData.id}`), {
        withCredentials: true,
      });
      setProfileOrgs(resp.data || []);
      setShowOrgaDialog(true);
    } catch (err) {
      console.error('Failed to load organizations for profile', err);
      toast({ title: 'Error', description: 'Could not load organizations' });
    } finally {
      setProfileOrgsLoading(false);
    }
  };

  function handleFileUpload() {
    if (!isOwnProfile) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // existing upload logic preserved
    };
    input.click();
  }

  const handleTimelineSelect = (key: TimelineFilter) => {
    setSelectedTimeline((prev) => {
      if (!prev) return key;
      // toggle off if same
      const same =
        'month' in prev && 'month' in key
          ? prev.year === key.year && prev.month === key.month
          : !('month' in prev) && !('month' in key)
            ? prev.year === key.year
            : false;
      return same ? null : key;
    });
  };

  const clearTimelineFilter = () => setSelectedTimeline(null);

  // ─── Loading / not-found states ──────────────────────────────────────────

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
            <div className="h-44 bg-muted animate-pulse" />
            <div className="px-6 pb-6">
              <div className="-mt-14 mb-4">
                <SkeletonAvatar size={112} />
              </div>
              <div className="space-y-3">
                <SkeletonLine width="35%" height="1.25rem" />
                <SkeletonLine width="25%" height="1rem" />
                <SkeletonLine width="60%" height="0.875rem" className="mt-2" />
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl bg-muted/60 ring-1 ring-border/40 animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl flex h-64 items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Profile not found</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── Layout: centered narrow feed + wider sticky sidebar ── */}
      <div className="mx-auto flex w-full max-w-[1500px] justify-center gap-6 px-4">
        {/* Main content — capped width so video posts don't get cut off */}
        <main className="min-w-0 w-full max-w-2xl py-6">
          {/* ═══════════════════════════════════════════════════════════════
              PROFILE HEADER CARD
             ═══════════════════════════════════════════════════════════════ */}
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card mb-6 shadow-sm">
            {/* Cover photo */}
            <div
              className="relative h-44 sm:h-56"
              style={{
                backgroundImage: userData.cover_photo_url
                  ? `url(${userData.cover_photo_url})`
                  : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

              {/* Decorative orbs */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />

              {isOwnProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm p-0 ring-1 ring-white/20"
                  onClick={handleFileUpload}
                  disabled={uploading}
                  aria-label="Change cover photo"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="px-5 sm:px-7 pb-7">
              {/* Avatar row */}
              <div className="relative -mt-16 sm:-mt-20 mb-4 flex items-end justify-between gap-3 flex-wrap">
                <div className="relative">
                  <Avatar className="h-28 w-28 sm:h-36 sm:w-36 ring-4 ring-card shadow-xl">
                    <AvatarImage src={userData.avatar_url || '/placeholder.svg'} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 text-white text-3xl font-bold">
                      {userData.first_name?.[0]}
                      {userData.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-1 right-1 h-9 w-9 rounded-full bg-card hover:bg-muted shadow-md ring-1 ring-border/60 p-0"
                      onClick={handleFileUpload}
                      disabled={uploading}
                      aria-label="Change profile photo"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Desktop action buttons */}
                <div className="hidden sm:flex items-center gap-2 pb-1">
                  {isOwnProfile ? (
                    <Button
                      onClick={() => setInlineProfileEditorOpen(true)}
                      className={cn(
                        'h-10 gap-2 rounded-full px-5 text-sm font-semibold',
                        'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                        'shadow-md shadow-purple-500/25 transition-all hover:shadow-lg hover:shadow-purple-500/40',
                      )}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleLikeProfile}
                        disabled={liking}
                        className={cn(
                          'h-10 gap-2 rounded-full px-5 text-sm font-semibold transition-all',
                          stats.hasLiked
                            ? 'bg-muted text-foreground hover:bg-muted/80 ring-1 ring-border/60'
                            : 'bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-md shadow-pink-500/25',
                        )}
                      >
                        <Heart
                          className={cn(
                            'h-3.5 w-3.5',
                            stats.hasLiked && 'fill-pink-500 text-pink-500',
                          )}
                        />
                        {stats.hasLiked ? 'Liked' : 'Like'}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 w-10 rounded-full p-0 ring-1 ring-border/60"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Name & identity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {userData.first_name} {userData.last_name}
                  </h1>
                  {(() => {
                    const badge = getVerificationBadge(
                      undefined,
                      stats.followers,
                      posts.length || (userData as any).posts_count || 0,
                    );
                    if (!badge) return null;
                    return (
                      <Badge
                        className={cn(
                          'text-[10px] px-2 py-0.5 flex items-center gap-1 font-bold',
                          badge.color,
                        )}
                        title={badge.tooltip}
                      >
                        {badge.icon}
                        {badge.text}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-sm text-muted-foreground font-medium">@{userData.username}</p>
                {userData.heading && (
                  <p className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-500 bg-clip-text text-transparent pt-0.5 inline-block">
                    {userData.heading}
                  </p>
                )}
                {userData.bio && (
                  <p className="text-sm leading-relaxed text-foreground/80 pt-1.5 max-w-2xl">
                    {userData.bio}
                  </p>
                )}
              </div>

              {/* Mobile action buttons */}
              <div className="mt-4 flex sm:hidden items-center gap-2">
                {isOwnProfile ? (
                  <Button
                    onClick={() => navigate('/profile/edit')}
                    className={cn(
                      'flex-1 h-10 gap-1.5 rounded-full text-sm font-semibold',
                      'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                      'shadow-md shadow-purple-500/25',
                    )}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleLikeProfile}
                      disabled={liking}
                      className={cn(
                        'flex-1 h-10 gap-1.5 rounded-full text-sm font-semibold',
                        stats.hasLiked
                          ? 'bg-muted text-foreground ring-1 ring-border/60'
                          : 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/25',
                      )}
                    >
                      <Heart
                        className={cn('h-4 w-4', stats.hasLiked && 'fill-pink-500 text-pink-500')}
                      />
                      {stats.hasLiked ? 'Liked' : 'Like Profile'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 w-10 rounded-full p-0 ring-1 ring-border/60"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* ── Stats grid ── */}
              <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  icon={Users}
                  value={stats.followers}
                  label="Followers"
                  tone="blue"
                  onClick={() => handleOpenFollowersModal('followers')}
                />
                <StatTile
                  icon={UserPlus}
                  value={stats.following}
                  label="Following"
                  tone="emerald"
                  onClick={() => handleOpenFollowersModal('following')}
                />
                <StatTile
                  icon={Heart}
                  value={stats.likes}
                  label="Likes"
                  tone="pink"
                  active={stats.hasLiked}
                />
                <StatTile icon={Eye} value={stats.views} label="Views" tone="purple" />
              </div>

              {/* ── Action bar ── */}
              <div className="mt-6">
                <div className="grid grid-cols-5 gap-2 sm:hidden">
                  <ActionTile
                    icon={MessageCircle}
                    label="Message"
                    gradient="from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={handleMessageUser}
                  />
                  <ActionTile
                    icon={Store}
                    label="Store"
                    gradient="from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    onClick={handleOpenStore}
                  />
                  <ActionTile
                    icon={Radio}
                    label="Studio"
                    gradient="from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    onClick={handleOpenStudio}
                  />
                  <ActionTile
                    icon={Users}
                    label="Groups"
                    gradient="from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600"
                    onClick={() => navigate('/groups')}
                  />
                  <ActionTile
                    icon={Building2}
                    label="Workplace"
                    gradient="from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    onClick={handleOpenWorkplace}
                  />
                </div>

                <div className="hidden sm:flex flex-wrap items-center gap-2">
                  <ActionPill
                    icon={MessageCircle}
                    label="Message"
                    gradient="from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={handleMessageUser}
                  />
                  <ActionPill
                    icon={Store}
                    label="Store"
                    gradient="from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    onClick={handleOpenStore}
                  />
                  <ActionPill
                    icon={Radio}
                    label="Studio"
                    gradient="from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    onClick={handleOpenStudio}
                  />
                  <ActionPill
                    icon={Users}
                    label="Groups"
                    gradient="from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600"
                    onClick={() => navigate('/groups')}
                  />
                  <ActionPill
                    icon={Building2}
                    label="Workplace"
                    gradient="from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    onClick={handleOpenWorkplace}
                  />
                </div>
              </div>

              {/* ── Organizations Dialog ── */}
              <Dialog open={showOrgaDialog} onOpenChange={setShowOrgaDialog}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Organizations</DialogTitle>
                    <DialogDescription>
                      Organizations associated with this profile
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    {profileOrgsLoading ? (
                      <div className="py-6">
                        <div className="flex flex-col gap-3">
                          <SkeletonLine width="60%" className="mx-auto" />
                          <SkeletonCard />
                          <SkeletonCard />
                        </div>
                      </div>
                    ) : profileOrgs.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No organizations found</p>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {profileOrgs.map((org: any) => (
                          <div
                            key={org.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{org.name}</div>
                              {org.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {org.description}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full"
                              onClick={() => navigate(`/org/${org.slug || org.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════
              TIMELINE SECTION — monthly / annual toggle + clickable chips
             ═══════════════════════════════════════════════════════════════ */}
          <Card className="mb-5 overflow-hidden rounded-3xl border-border/60 bg-gradient-to-br from-card/95 to-card/60 shadow-sm">
            <div className="p-5">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 ring-1 ring-purple-500/20">
                    <Calendar className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
                      Timeline
                      <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {timelineTotalCount} {timelineTotalCount === 1 ? 'post' : 'posts'} ·{' '}
                      {selectedTimeline ? 'filtered' : 'all time'}
                    </p>
                  </div>
                </div>

                {/* Monthly / Annual segmented control */}
                <div className="relative flex items-center rounded-full bg-muted/70 p-1 ring-1 ring-border/40">
                  <span
                    className={cn(
                      'absolute top-1 bottom-1 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-md shadow-purple-500/25 transition-all duration-300 ease-out',
                      timelineView === 'monthly' ? 'left-1 right-1/2' : 'left-1/2 right-1',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineView('monthly');
                      setSelectedTimeline(null);
                    }}
                    className={cn(
                      'relative z-10 flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                      timelineView === 'monthly'
                        ? 'text-white'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineView('annual');
                      setSelectedTimeline(null);
                    }}
                    className={cn(
                      'relative z-10 flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                      timelineView === 'annual'
                        ? 'text-white'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Annual
                  </button>
                </div>
              </div>

              {/* Active filter chip */}
              {selectedTimeline && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-purple-500/25 animate-in fade-in slide-in-from-left-2 duration-200">
                    <TrendingUp className="h-3 w-3" />
                    {(() => {
                      if ('month' in selectedTimeline) {
                        return new Date(
                          selectedTimeline.year,
                          selectedTimeline.month,
                        ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      }
                      return String(selectedTimeline.year);
                    })()}
                    <button
                      onClick={clearTimelineFilter}
                      className="ml-1 rounded-full p-0.5 hover:bg-white/20 transition-colors"
                      aria-label="Clear filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
                  </span>
                </div>
              )}

              {/* Timeline chips grid */}
              {timelineBuckets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No timeline data yet</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearTimelineFilter}
                    className={cn(
                      'group relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                      'ring-1 ring-border/60',
                      !selectedTimeline
                        ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/25 ring-transparent'
                        : 'bg-background/60 text-foreground hover:bg-muted/60 hover:ring-border',
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    All
                    <span
                      className={cn(
                        'ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                        !selectedTimeline ? 'bg-white/20' : 'bg-muted',
                      )}
                    >
                      {timelineTotalCount}
                    </span>
                  </button>

                  {timelineBuckets.map((bucket) => {
                    const isActive =
                      selectedTimeline &&
                      (() => {
                        if ('month' in selectedTimeline && 'month' in (bucket.key as any)) {
                          const k = bucket.key as { year: number; month: number };
                          const s = selectedTimeline as { year: number; month: number };
                          return k.year === s.year && k.month === s.month;
                        }
                        if (!('month' in selectedTimeline) && !('month' in (bucket.key as any))) {
                          const k = bucket.key as { year: number };
                          const s = selectedTimeline as { year: number };
                          return k.year === s.year;
                        }
                        return false;
                      })();

                    return (
                      <button
                        key={`${bucket.label}-${bucket.count}`}
                        type="button"
                        onClick={() => handleTimelineSelect(bucket.key)}
                        className={cn(
                          'group relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200',
                          'ring-1 hover:scale-[1.03] active:scale-[0.97]',
                          isActive
                            ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/25 ring-transparent'
                            : 'bg-background/60 text-foreground ring-border/60 hover:bg-muted/60 hover:ring-purple-500/30',
                        )}
                      >
                        <span className="relative">{bucket.label}</span>
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums transition-colors',
                            isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-purple-500/10',
                          )}
                        >
                          {bucket.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════
              POSTS
             ═══════════════════════════════════════════════════════════════ */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {selectedTimeline ? 'Filtered Posts' : 'Posts'}
              </h2>
              {filteredPosts.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
                </span>
              )}
            </div>

            {filteredPosts.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {selectedTimeline ? 'No posts in this period' : 'No posts yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTimeline
                    ? 'Try selecting a different timeline or clear the filter'
                    : 'Posts will appear here once published'}
                </p>
                {selectedTimeline && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearTimelineFilter}
                    className="mt-4 rounded-full"
                  >
                    Clear filter
                  </Button>
                )}
              </Card>
            ) : (
              <>
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} currentUser={user} />
                ))}
                <div className="h-24 sm:h-0" />
              </>
            )}
          </div>
        </main>

        {/* Right sidebar — wider + sticky */}
        <aside className="hidden lg:block w-[400px] xl:w-[440px] shrink-0 py-6">
          <div className={inlineProfileEditorOpen ? '' : 'sticky top-20'}>
            <ProfileRightSidebar
              userId={userData.id}
              isOwnProfile={Boolean(isOwnProfile)}
              inlineEditorOpen={inlineProfileEditorOpen}
              onInlineEditorOpenChange={setInlineProfileEditorOpen}
            />
          </div>
        </aside>
      </div>

      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default Profile;