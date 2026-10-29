import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  UserPlus,
  UserCheck,
  ArrowLeft,
  Eye,
  Heart,
  Play,
  TrendingUp,
  DollarSign,
  Calendar,
  CreditCard,
  Menu,
  Tv,
  Film,
  Radio,
  Sparkles,
  MoreHorizontal,
  Pencil,
  Trash2,
  EyeOff,
  Globe,
  Clock,
  Wallet,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonLine from '@/components/skeletons/SkeletonLine';
import { VideoEngagementSidebar } from '@/components/VideoEngagementSidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Stat tile ────────────────────────────────────────────────────────────────

const InsightTile = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: 'purple' | 'pink' | 'emerald' | 'red' | 'blue' | 'amber';
}) => {
  const tones = {
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2.5 ring-1 ring-border/60">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
            tones[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-sm font-bold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
};

const HeaderStat = ({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: 'purple' | 'blue' | 'pink' | 'amber';
}) => {
  const tones = {
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  };
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl ring-1', tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-lg font-bold tabular-nums leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
};

// ─── Video card (shared across tabs) ─────────────────────────────────────────

const VideoCard = ({
  video,
  variant = 'reels',
  isOwner,
  isLiked,
  onLike,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  video: any;
  variant?: 'reels' | 'series' | 'streams';
  isOwner: boolean;
  isLiked: boolean;
  onLike: (id: string) => void;
  onEdit: (video: any) => void;
  onToggleVisibility: (id: string, current: string) => void;
  onDelete: (id: string) => void;
}) => {
  const title =
    variant === 'series' ? video.series_title || video.caption : video.caption;
  const subtitle =
    variant === 'series'
      ? video.series_description
      : new Date(video.created_at).toLocaleString();
  const isPrivate = video.visibility === 'private';

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-purple-500/30">
      {/* Video */}
      <div className="relative bg-black">
        <video
          src={video.video_url}
          controls
          className="w-full aspect-video bg-black object-contain"
          poster={video.thumbnail_url || undefined}
          preload="metadata"
        />
        {/* Engagement sidebar overlay */}
        <VideoEngagementSidebar
          video={video}
          isLiked={isLiked}
          onLike={onLike}
        />

        {/* Owner action buttons — overlay top-right */}
        {isOwner && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(video)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
              title="Edit"
              aria-label="Edit video"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onToggleVisibility(video.id, video.visibility)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
              title={isPrivate ? 'Publish' : 'Unpublish'}
              aria-label={isPrivate ? 'Publish video' : 'Unpublish video'}
            >
              {isPrivate ? <Globe className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onDelete(video.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/90 backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
              title="Delete"
              aria-label="Delete video"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Visibility pill — bottom-right */}
        {isOwner && (
          <div className="absolute bottom-2 right-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm',
                isPrivate ? 'bg-slate-600/90 text-white' : 'bg-emerald-500/90 text-white',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', isPrivate ? 'bg-white/60' : 'bg-white')} />
              {isPrivate ? 'Private' : 'Public'}
            </span>
          </div>
        )}

        {/* Variant badge — bottom-left */}
        {variant === 'streams' && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
              <Radio className="h-2.5 w-2.5" />
              Stream
            </span>
          </div>
        )}
        {variant === 'series' && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-600/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
              <Film className="h-2.5 w-2.5" />
              Series
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="text-sm font-bold tracking-tight line-clamp-1">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {subtitle}
          </p>
        )}
        {variant === 'series' && video.subscription_amount && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold ring-1 ring-purple-500/20 text-purple-600 dark:text-purple-400">
            <Wallet className="h-2.5 w-2.5" />
            ${video.subscription_amount} / {video.subscription_cycle}
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyVideos = ({
  icon: Icon,
  message,
  accent = 'purple',
}: {
  icon: React.ElementType;
  message: string;
  accent?: 'purple' | 'blue' | 'red';
}) => {
  const accents = {
    purple: 'from-purple-500/15 to-fuchsia-500/10 ring-purple-500/20 text-purple-600 dark:text-purple-400',
    blue: 'from-blue-500/15 to-cyan-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400',
    red: 'from-red-500/15 to-rose-500/10 ring-red-500/20 text-red-600 dark:text-red-400',
  };
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-border/60 bg-card/40 py-12 text-center">
      <div
        className={cn(
          'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ring-1',
          accents[accent],
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Content will appear here once published
      </p>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editVideo, setEditVideo] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ caption: string; description: string }>({
    caption: '',
    description: '',
  });
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const [videos, setVideos] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  const [insights, setInsights] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [revenue, setRevenue] = useState({ total: 0, donations: 0, subscriptions: 0 });

  useEffect(() => {
    const fetchInsights = async () => {
      if (!channelId) return;
      const [{ data: allVideos }, { data: allStreams }] = await Promise.all([
        supabase.from('studio_videos').select('*').eq('channel_id', channelId),
        supabase.from('studio_streams').select('*').eq('channel_id', channelId),
      ]);
      const totalViews = (allVideos || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = (allVideos || []).reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalUploads = (allVideos || []).length;
      const totalStreams = (allStreams || []).length;
      setInsights({ totalViews, totalLikes, totalUploads, totalStreams });
    };
    fetchInsights();
  }, [channelId]);

  const openEditModal = (video: any) => {
    setEditVideo(video);
    setEditForm({ caption: video.caption || '', description: video.series_description || '' });
  };

  useEffect(() => {
    const fetchMonetizationData = async () => {
      if (!channelId) return;
      const { data: donationsData } = await supabase
        .from('studio_donations')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      const { data: subscriptionsData } = await supabase
        .from('studio_subscriptions')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      setDonations(donationsData || []);
      setSubscriptions(subscriptionsData || []);

      const donationTotal = (donationsData || []).reduce(
        (sum, d) => sum + (d.amount || 0),
        0,
      );
      const subscriptionTotal = (subscriptionsData || []).reduce(
        (sum, s) => sum + (s.amount || 0),
        0,
      );
      setRevenue({
        total: donationTotal + subscriptionTotal,
        donations: donationTotal,
        subscriptions: subscriptionTotal,
      });
    };
    fetchMonetizationData();
  }, [channelId]);

  const isOwner = currentUserId && channel && channel.owner_id === currentUserId;

  useEffect(() => {
    const fetchChannel = async () => {
      setLoading(true);
      const { data: channelData } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('id', channelId)
        .single();
      setChannel(channelData);
      const { data: videoData } = await supabase
        .from('studio_videos')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      const { data: streamData } = await supabase
        .from('studio_streams')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      const visibleVideos = isOwner
        ? videoData || []
        : (videoData || []).filter((v: any) => v.visibility === 'public');
      setVideos(visibleVideos);
      setStreamVideos(streamData || []);
      const { count } = await supabase
        .from('studio_channel_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId);
      setSubscriberCount(count || 0);
      const { data: likesData } = await supabase
        .from('studio_video_likes')
        .select('video_id')
        .in(
          'video_id',
          (videoData || []).map((v: any) => v.id),
        );
      setUserLikes(new Set((likesData || []).map((l: any) => l.video_id)));
      setLoading(false);
    };
    if (channelId) fetchChannel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isOwner]);

  const handleToggleVisibility = async (videoId: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
    const { error } = await supabase
      .from('studio_videos')
      .update({ visibility: newVisibility })
      .eq('id', videoId);
    if (error) {
      console.error('Error updating visibility:', error);
      return;
    }
    const { data: updatedVideos, error: fetchError } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });
    if (fetchError) return;
    const visibleVideos = isOwner
      ? updatedVideos || []
      : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
  };

  const closeEditModal = () => setEditVideo(null);

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVideo) return;
    await supabase
      .from('studio_videos')
      .update({ caption: editForm.caption, series_description: editForm.description })
      .eq('id', editVideo.id);
    const { data: updatedVideos } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });
    const visibleVideos = isOwner
      ? updatedVideos || []
      : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
    closeEditModal();
  };

  const confirmDeleteVideo = (videoId: string) => setDeletingVideoId(videoId);
  const cancelDelete = () => setDeletingVideoId(null);

  const handleDelete = async () => {
    if (!deletingVideoId) return;
    await supabase.from('studio_videos').delete().eq('id', deletingVideoId);
    const { data: updatedVideos } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });
    const visibleVideos = isOwner
      ? updatedVideos || []
      : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
    setDeletingVideoId(null);
  };

  const handleSubscribe = async () => {
    if (!subscribed) {
      const { error } = await supabase
        .from('studio_channel_subscribers')
        .insert({ channel_id: channelId });
      if (!error) {
        setSubscribed(true);
        setSubscriberCount((c) => c + 1);
        try {
          const actorId = currentUserId || null;
          const recipientId = channel?.owner_id || null;
          if (actorId && recipientId && String(actorId) !== String(recipientId)) {
            fetch('/api/notifications/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: recipientId,
                actor_id: actorId,
                type: 'subscribe',
                title: 'New subscriber',
                message: 'Someone subscribed to your channel',
                target_table: 'studio_channel_subscribers',
                data: { channel_id: channelId },
              }),
            }).catch((e) => console.warn('subscribe notification failed', e));
          }
        } catch (e) {
          console.warn('failed to call subscribe notification', e);
        }
      }
    } else {
      await supabase
        .from('studio_channel_subscribers')
        .delete()
        .eq('channel_id', channelId);
      setSubscribed(false);
      setSubscriberCount((c) => Math.max(0, c - 1));
    }
  };

  const handleLike = async (videoId: string) => {
    const isLiked = userLikes.has(videoId);
    let newLikes = new Set(userLikes);
    if (isLiked) {
      await supabase.from('studio_video_likes').delete().eq('video_id', videoId);
      newLikes.delete(videoId);
    } else {
      await supabase.from('studio_video_likes').insert({ video_id: videoId });
      newLikes.add(videoId);
      try {
        const actorId = currentUserId || null;
        const { data: videoRow } = await supabase
          .from('studio_videos')
          .select('id, user_id, channel_id')
          .eq('id', videoId)
          .single();
        const recipientId = videoRow?.user_id || channel?.owner_id || null;
        if (actorId && recipientId && String(actorId) !== String(recipientId)) {
          fetch('/api/notifications/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: recipientId,
              actor_id: actorId,
              type: 'like',
              title: 'New like',
              message: 'Someone liked your video',
              target_table: 'studio_video_likes',
              data: { video_id: videoId },
            }),
          }).catch((e) => console.warn('like notification failed', e));
        }
      } catch (nErr) {
        console.warn('failed to create like notification', nErr);
      }
    }
    setUserLikes(newLikes);
    const { data: updatedVideos } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });
    const visibleVideos = isOwner
      ? updatedVideos || []
      : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
  };

  const reelsVideos = videos.filter((v) => !v.is_series && !v.is_stream);
  const seriesVideos = videos.filter((v) => v.is_series);
  const [streamVideos, setStreamVideos] = useState<any[]>([]);

  const isMobile = useIsMobile();
  const isDesktop = !isMobile;

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-6 pb-32 lg:pb-8">
          <div className="mb-6 h-40 rounded-3xl bg-muted animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-6xl flex h-64 items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Tv className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Channel not found</p>
          </div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  // ─── Sidebar content ──────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="space-y-5">
      {/* Channel Insights */}
      <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Channel Insights</h3>
        </div>
        <div className="space-y-1.5">
          <InsightTile
            icon={Eye}
            label="Total Views"
            value={insights?.totalViews || 0}
            tone="purple"
          />
          <InsightTile
            icon={Heart}
            label="Total Likes"
            value={insights?.totalLikes || 0}
            tone="pink"
          />
          <InsightTile
            icon={Play}
            label="Uploads"
            value={insights?.totalUploads || 0}
            tone="emerald"
          />
          <InsightTile
            icon={Calendar}
            label="Streams"
            value={insights?.totalStreams || 0}
            tone="red"
          />
        </div>
      </Card>

      {/* Revenue */}
      <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Revenue</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 ring-1 ring-emerald-500/20 px-3 py-3">
            <span className="text-xs font-semibold text-muted-foreground">Total</span>
            <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              ${revenue.total.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors">
            <span className="text-xs text-muted-foreground">Donations</span>
            <span className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
              ${revenue.donations.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors">
            <span className="text-xs text-muted-foreground">Subscriptions</span>
            <span className="text-sm font-bold tabular-nums text-purple-600 dark:text-purple-400">
              ${revenue.subscriptions.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      {/* Recent Donations */}
      <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
            <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Recent Donations</h3>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto custom-scrollbar">
          {donations.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">
              No donations yet
            </p>
          ) : (
            donations.slice(0, 5).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    ${d.amount}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                  {d.donor_name || 'Anonymous'}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Recent Subscriptions */}
      <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Recent Subscriptions</h3>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto custom-scrollbar">
          {subscriptions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">
              No subscriptions yet
            </p>
          ) : (
            subscriptions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    ${s.amount}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                  {s.subscriber_name || 'User'}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-6 pb-32 lg:pb-8 relative flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {/* Mobile header */}
          <div className="mb-4 flex items-center justify-between md:hidden">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
              onClick={() => navigate('/studio')}
              aria-label="Back to Studio"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
                  aria-label="Open Menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full p-6 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-base font-bold tracking-tight">
                    Channel Analytics
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <SidebarContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* ── Channel header card ── */}
          <Card className="mb-6 overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
            {/* Gradient banner */}
            <div className="relative h-24 bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500">
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-fuchsia-500/25 blur-2xl" />
            </div>

            <div className="px-5 pb-5">
              {/* Avatar + action row */}
              <div className="flex items-end justify-between gap-3 -mt-10 mb-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card ring-4 ring-card shadow-lg">
                  <span className="text-2xl font-bold bg-gradient-to-br from-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
                    {channel.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pb-1">
                  <Button
                    onClick={handleSubscribe}
                    variant={subscribed ? 'outline' : 'default'}
                    className={cn(
                      'h-10 gap-2 rounded-full px-5 text-sm font-semibold transition-all',
                      subscribed
                        ? 'bg-muted text-foreground hover:bg-muted/80 ring-1 ring-border/60'
                        : 'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600 text-white shadow-md shadow-purple-500/25',
                    )}
                  >
                    {subscribed ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        Subscribed
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Channel identity */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">{channel.name}</h1>
                {channel.description && (
                  <p className="text-sm leading-relaxed text-foreground/75 max-w-2xl">
                    {channel.description}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-purple-500/20 text-purple-600 dark:text-purple-400">
                    {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'Subscriber' : 'Subscribers'}
                  </span>
                  {insights?.totalViews ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-blue-500/20 text-blue-600 dark:text-blue-400">
                      <Eye className="h-3 w-3" />
                      {insights.totalViews.toLocaleString()} views
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          {/* ── Tabs ── */}
          <div className="w-full">
            {isDesktop ? (
              <Tabs defaultValue="reels" className="w-full">
                <TabsList className="mb-4 flex w-full justify-start gap-1.5 bg-transparent p-0 h-auto">
                  {[
                    { value: 'reels', label: 'Reels & Videos', icon: Play },
                    { value: 'series', label: 'Series', icon: Film },
                    { value: 'streams', label: 'Streams', icon: Radio },
                  ].map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className={cn(
                        'group relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ring-1 h-auto',
                        'data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-fuchsia-500',
                        'data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/25 data-[state=active]:ring-transparent',
                        'data-[state=inactive]:bg-card/60 data-[state=inactive]:text-muted-foreground data-[state=inactive]:ring-border/60',
                        'data-[state=inactive]:hover:bg-muted/60 data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:ring-border',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="reels">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {reelsVideos.length === 0 ? (
                      <EmptyVideos icon={Play} message="No videos yet" accent="purple" />
                    ) : (
                      reelsVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          variant="reels"
                          isOwner={isOwner}
                          isLiked={userLikes.has(video.id)}
                          onLike={handleLike}
                          onEdit={openEditModal}
                          onToggleVisibility={handleToggleVisibility}
                          onDelete={confirmDeleteVideo}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="series">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {seriesVideos.length === 0 ? (
                      <EmptyVideos icon={Film} message="No series yet" accent="purple" />
                    ) : (
                      seriesVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          variant="series"
                          isOwner={isOwner}
                          isLiked={userLikes.has(video.id)}
                          onLike={handleLike}
                          onEdit={openEditModal}
                          onToggleVisibility={handleToggleVisibility}
                          onDelete={confirmDeleteVideo}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="streams">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {streamVideos.length === 0 ? (
                      <EmptyVideos icon={Radio} message="No streams yet" accent="red" />
                    ) : (
                      streamVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          variant="streams"
                          isOwner={isOwner}
                          isLiked={userLikes.has(video.id)}
                          onLike={handleLike}
                          onEdit={openEditModal}
                          onToggleVisibility={handleToggleVisibility}
                          onDelete={confirmDeleteVideo}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-8">
                {[
                  { key: 'reels', label: 'Reels & Videos', list: reelsVideos, icon: Play, variant: 'reels' as const },
                  { key: 'series', label: 'Series', list: seriesVideos, icon: Film, variant: 'series' as const },
                  { key: 'streams', label: 'Streams', list: streamVideos, icon: Radio, variant: 'streams' as const },
                ].map(({ key, label, list, icon: Icon, variant }) => (
                  <div key={key}>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20">
                        <Icon className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">{label}</h4>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-none">
                      {list.length === 0 ? (
                        <div className="w-full rounded-xl border border-dashed border-border/60 py-8 text-center">
                          <p className="text-xs text-muted-foreground">Nothing here yet</p>
                        </div>
                      ) : (
                        list.map((video) => (
                          <div key={video.id} className="min-w-[240px] max-w-[280px] snap-center shrink-0">
                            <VideoCard
                              video={video}
                              variant={variant}
                              isOwner={isOwner}
                              isLiked={userLikes.has(video.id)}
                              onLike={handleLike}
                              onEdit={openEditModal}
                              onToggleVisibility={handleToggleVisibility}
                              onDelete={confirmDeleteVideo}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop sidebar ── */}
        {insights && (
          <aside className="hidden md:block w-80 h-fit sticky top-24">
            <SidebarContent />
          </aside>
        )}

        {/* ── Edit Video Modal ── */}
        {editVideo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={closeEditModal}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                    <Pencil className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Edit Video</h2>
                    <p className="text-[11px] text-muted-foreground">
                      Update caption and description
                    </p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Caption
                  </label>
                  <input
                    type="text"
                    name="caption"
                    value={editForm.caption}
                    onChange={handleEditChange}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-shadow"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={editForm.description}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-shadow resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEditModal}
                    className="h-10 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={cn(
                      'h-10 gap-2 rounded-xl font-semibold',
                      'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                      'shadow-md shadow-purple-500/25',
                    )}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ── */}
        {deletingVideoId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={cancelDelete}
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Delete Video</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete this video? This action cannot be undone.
                </p>
                <div className="mt-5 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelDelete}
                    className="flex-1 h-10 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDelete}
                    className={cn(
                      'flex-1 h-10 gap-2 rounded-xl font-semibold',
                      'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/25',
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default ChannelPage;