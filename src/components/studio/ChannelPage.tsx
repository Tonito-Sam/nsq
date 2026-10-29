import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  UserCheck,
  Eye,
  Video,
  Share2,
  MessageCircle,
  Heart,
  ArrowLeft,
  Calendar,
  Globe,
  Users,
  Grid3x3,
  ListVideo,
  MapPin,
  ExternalLink,
  Play,
  Check,
  CheckCircle2,
  UserPlus,
  ImagePlus,
  Pencil,
  Tv,
  Sparkles,
  TrendingUp,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';

// ─── Stat tile ────────────────────────────────────────────────────────────────

const StatTile = ({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: 'purple' | 'pink' | 'blue' | 'emerald';
}) => {
  const tones = {
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-background/50 p-3 ring-1 ring-border/60 transition-colors hover:bg-muted/40">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', tones[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-lg font-bold tabular-nums leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
};

// ─── Progress row ─────────────────────────────────────────────────────────────

const ProgressRow = ({
  label,
  value,
  percent,
  gradient,
}: {
  label: string;
  value: string;
  percent: number;
  gradient: string;
}) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-xs">
      <span className="font-medium text-foreground/80">{label}</span>
      <span className="font-bold tabular-nums text-muted-foreground">{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', gradient)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const ChannelPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [channel, setChannel] = useState<any>(null);
  const isChannelOwner = Boolean(user?.id && channel?.user_id === user.id);
  const [creator, setCreator] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  const [approvedShow, setApprovedShow] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (!videos || videos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLVideoElement;
          const vid = videoRefs.current.get(el.getAttribute('data-video-id') || '') || el;
          if (!vid) return;
          if (entry.intersectionRatio >= 0.5) {
            try {
              vid.muted = true;
              const p = vid.play();
              if (p && (p as Promise<any>).catch) (p as Promise<any>).catch(() => {});
            } catch (e) {}
          } else {
            try {
              vid.pause();
            } catch (e) {}
          }
        });
      },
      { threshold: [0.5] },
    );
    videoRefs.current.forEach((el) => {
      try {
        observer.observe(el);
      } catch (e) {}
    });
    return () => {
      try {
        observer.disconnect();
      } catch (e) {}
    };
  }, [videos]);

  useEffect(() => {
    fetchChannelData();
    fetchVideos();
    checkSubscription();
    fetchSubscriberCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let current = true;
    const loadApprovedShow = async () => {
      if (!user?.id || !channel?.id || channel.user_id !== user.id) {
        setApprovedShow(null);
        return;
      }
      const { data, error } = await supabase
        .from('studio_show_applications' as any)
        .select(
          'show_title, description, category, format, preferred_days, preferred_time, timezone, approved_show_id',
        )
        .eq('channel_id', channel.id)
        .eq('applicant_id', user.id)
        .eq('status', 'approved')
        .not('approved_show_id', 'is', null)
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!current) return;
      if (error) {
        console.error('Could not load approved TV show:', error);
        setApprovedShow(null);
        return;
      }
      setApprovedShow(data || null);
    };
    void loadApprovedShow();
    return () => {
      current = false;
    };
  }, [channel?.id, channel?.user_id, user?.id]);

  useEffect(() => {
    if (approvedShow && searchParams.get('tab') === 'tv') setActiveTab('tv');
  }, [approvedShow, searchParams]);

  const fetchChannelData = async () => {
    try {
      const { data: channelData, error: channelError } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('id', id)
        .single();
      if (channelError) {
        const { data: userChannel } = await supabase
          .from('studio_channels')
          .select('*')
          .eq('user_id', id)
          .single();
        if (userChannel) {
          setChannel(userChannel);
          fetchCreatorInfo(userChannel.user_id);
        }
      } else {
        setChannel(channelData);
        fetchCreatorInfo(channelData.user_id);
      }
    } catch (error) {
      console.error('Error fetching channel:', error);
    }
  };

  const fetchCreatorInfo = async (userId: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('username, avatar_url, email')
        .eq('id', userId)
        .single();
      setCreator(userData);
    } catch (error) {
      console.error('Error fetching creator info:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data: videosData } = await supabase
        .from('studio_videos')
        .select('*')
        .eq('channel_id', id)
        .order('created_at', { ascending: false });
      if (videosData) {
        setVideos(videosData);
        const views = videosData.reduce((sum, video) => sum + (video.views || 0), 0);
        const likes = videosData.reduce((sum, video) => sum + (video.likes || 0), 0);
        let totalCommentsCount = 0;
        for (const video of videosData) {
          const { count } = await supabase
            .from('studio_video_comments')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', video.id);
          totalCommentsCount += count || 0;
        }
        setTotalViews(views);
        setTotalLikes(likes);
        setTotalComments(totalCommentsCount);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    if (!user) return;
    try {
      const { data: subscription } = await supabase
        .from('studio_channel_subscribers')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_id', id)
        .single();
      setIsSubscribed(!!subscription);
    } catch (error) {
      setIsSubscribed(false);
    }
  };

  const fetchSubscriberCount = async () => {
    try {
      const { count } = await supabase
        .from('studio_channel_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', id);
      setSubscriberCount(count || 0);
    } catch (error) {
      console.error('Error fetching subscriber count:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({ description: 'Please login to subscribe' });
      return;
    }
    try {
      if (isSubscribed) {
        await supabase
          .from('studio_channel_subscribers')
          .delete()
          .eq('user_id', user.id)
          .eq('channel_id', id);
        setIsSubscribed(false);
        setSubscriberCount((prev) => Math.max(0, prev - 1));
        toast({ description: 'Unsubscribed successfully' });
      } else {
        await supabase
          .from('studio_channel_subscribers')
          .insert({ user_id: user.id, channel_id: id });
        setIsSubscribed(true);
        setSubscriberCount((prev) => prev + 1);
        toast({ description: 'Subscribed successfully' });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({ description: 'Failed to update subscription', variant: 'destructive' });
    }
  };

  const handleShareChannel = async () => {
    const url = `${window.location.origin}/studio/channel/${id}`;
    await navigator.clipboard.writeText(url);
    toast({ description: 'Channel link copied to clipboard!' });
  };

  const handlePlayVideo = (videoId: string) => {
    navigate(`/studio?highlight=${videoId}&autoplay=true`);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-0">
        <div className="mx-auto max-w-6xl">
          <div className="p-4">
            <div className="mb-6 h-36 rounded-2xl bg-muted animate-pulse" />
            <div className="flex items-start gap-4 mb-6 -mt-12 px-4">
              <Skeleton className="h-20 w-20 rounded-2xl ring-4 ring-card" />
              <div className="space-y-2 flex-1 pt-14">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 px-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-28 md:pb-0 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Tv className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold tracking-tight mb-1">Channel not found</h2>
          <p className="text-xs text-muted-foreground mb-4">
            The channel you're looking for doesn't exist or has been removed
          </p>
          <Button
            onClick={() => navigate('/studio')}
            className="h-10 gap-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-md shadow-purple-500/25"
          >
            Back to Studio
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-0">
      {/* ═══════════════════════════════════════════════════════════════
          STICKY TOP BAR
         ═══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <h1 className="text-sm font-bold tracking-tight truncate">{channel.name}</h1>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {subscriberCount.toLocaleString()} subscribers
              </p>
            </div>

            <button
              onClick={handleShareChannel}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
              aria-label="Share channel"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl">
        {/* ═══════════════════════════════════════════════════════════════
            COVER BANNER
           ═══════════════════════════════════════════════════════════════ */}
        <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500 md:h-52 md:rounded-b-3xl">
          {channel.cover_url && (
            <img
              src={channel.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" />

          <h2 className="absolute bottom-4 left-4 right-32 line-clamp-2 text-lg font-bold text-white drop-shadow-md md:text-2xl md:bottom-6 md:left-6">
            {channel.name}
          </h2>

          {isChannelOwner && (
            <button
              type="button"
              onClick={() => navigate('/studio/settings#channel-branding')}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black/80 transition-colors ring-1 ring-white/20 md:bottom-5 md:right-5"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Change cover
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            CHANNEL INFO
           ═══════════════════════════════════════════════════════════════ */}
        <div className="px-4 py-5">
          {/* Avatar + identity + subscribe */}
          <div className="flex items-start gap-4 mb-5 -mt-12 md:-mt-14">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-card shadow-xl">
                <AvatarImage src={channel.avatar_url || creator?.avatar_url} alt={channel.name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 text-white text-2xl font-bold">
                  {channel.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isChannelOwner && (
                <button
                  type="button"
                  onClick={() => navigate('/studio/settings#channel-branding')}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white shadow-md ring-2 ring-card hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Change profile"
                  title="Change profile"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Identity + actions */}
            <div className="flex-1 min-w-0 pt-14 md:pt-20">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight truncate">{channel.name}</h2>
                {channel.verified && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-blue-500/20 text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
              {creator?.username && (
                <p className="text-xs text-muted-foreground mt-0.5">@{creator.username}</p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  onClick={handleSubscribe}
                  className={cn(
                    'h-9 gap-1.5 rounded-full px-4 text-xs font-semibold transition-all',
                    isSubscribed
                      ? 'bg-muted text-foreground hover:bg-muted/80 ring-1 ring-border/60'
                      : 'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600 text-white shadow-md shadow-purple-500/25',
                  )}
                >
                  {isSubscribed ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Subscribed
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      Subscribe
                    </>
                  )}
                </Button>
                <button
                  onClick={handleShareChannel}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors ring-1 ring-border/60"
                  aria-label="Share channel"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {channel.description && (
            <p className="mb-5 text-sm leading-relaxed text-foreground/80">
              {channel.description}
            </p>
          )}

          {/* Stats grid — 3 tiles */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatTile icon={Video} value={videos.length} label="Videos" tone="purple" />
            <StatTile
              icon={Users}
              value={subscriberCount}
              label="Subs"
              tone="pink"
            />
            <StatTile icon={Eye} value={totalViews} label="Views" tone="blue" />
          </div>

          {/* Channel details — compact info list */}
          {(channel.website || channel.location || channel.created_at) && (
            <div className="mb-5 rounded-2xl border border-border/60 bg-card/60 p-3.5 space-y-2.5">
              {channel.website && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20">
                    <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <a
                    href={
                      channel.website.startsWith('http')
                        ? channel.website
                        : `https://${channel.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate font-medium text-foreground/80 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    {channel.website.replace(/^https?:\/\//, '')}
                  </a>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              )}
              {channel.location && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                    <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="flex-1 truncate font-medium text-foreground/80">
                    {channel.location}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="flex-1 font-medium text-foreground/80">
                  Joined{' '}
                  {new Date(channel.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TABS
             ═══════════════════════════════════════════════════════════════ */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-2">
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList
                className={cn(
                  'inline-flex gap-1.5 bg-transparent p-0 h-auto min-w-max md:min-w-0 md:w-auto',
                )}
              >
                {[
                  { value: 'videos', label: 'Videos', icon: Grid3x3 },
                  { value: 'about', label: 'About', icon: UserCheck },
                  { value: 'stats', label: 'Stats', icon: ListVideo },
                  ...(approvedShow && isChannelOwner
                    ? [{ value: 'tv', label: 'TV Show', icon: Tv }]
                    : []),
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className={cn(
                      'group flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ring-1',
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
            </div>

            {/* ── Videos tab ── */}
            <TabsContent value="videos" className="mt-4">
              {videos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 py-14 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
                    <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-semibold">No videos yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This channel hasn't uploaded any videos
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-muted cursor-pointer ring-1 ring-border/40 hover:ring-purple-500/40 transition-all"
                      onClick={() => handlePlayVideo(video.id)}
                    >
                      <video
                        data-video-id={video.id}
                        ref={(el) => {
                          if (el) videoRefs.current.set(String(video.id), el);
                          else videoRefs.current.delete(String(video.id));
                        }}
                        src={video.video_url}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        poster={video.thumbnail_url || ''}
                      />

                      {/* View count — bottom-left */}
                      <div className="absolute bottom-1.5 left-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          <Eye className="h-2.5 w-2.5" />
                          {formatNumber(video.views || 0)}
                        </span>
                      </div>

                      {/* Duration badge — top-right */}
                      <div className="absolute top-1.5 right-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          <Clock className="h-2.5 w-2.5" />
                          {video.duration ? formatDuration(video.duration) : '0:00'}
                        </span>
                      </div>

                      {/* Hover play overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                          <Play className="h-5 w-5 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── About tab ── */}
            <TabsContent value="about" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile icon={Video} value={videos.length} label="Videos" tone="purple" />
                <StatTile icon={Eye} value={totalViews} label="Views" tone="pink" />
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h4 className="mb-4 text-sm font-bold tracking-tight">Engagement</h4>
                <div className="space-y-4">
                  <ProgressRow
                    label="Like Rate"
                    value={`${
                      videos.length > 0 && totalViews > 0
                        ? Math.round((totalLikes / totalViews) * 100)
                        : 0
                    }%`}
                    percent={
                      videos.length > 0 && totalViews > 0
                        ? (totalLikes / totalViews) * 100
                        : 0
                    }
                    gradient="from-purple-500 to-fuchsia-500"
                  />
                  <ProgressRow
                    label="Comment Rate"
                    value={`${
                      videos.length > 0 && totalViews > 0
                        ? Math.round((totalComments / totalViews) * 100)
                        : 0
                    }%`}
                    percent={
                      videos.length > 0 && totalViews > 0
                        ? (totalComments / totalViews) * 100
                        : 0
                    }
                    gradient="from-blue-500 to-cyan-500"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Stats tab ── */}
            <TabsContent value="stats" className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/[0.06] to-fuchsia-500/[0.03] p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold tabular-nums leading-none">
                      {subscriberCount.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Subscribers
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums leading-none">
                      {formatNumber(totalViews)}
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Total Views
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h4 className="mb-4 text-sm font-bold tracking-tight">Performance</h4>
                <div className="space-y-4">
                  <ProgressRow
                    label="Avg. Views per Video"
                    value={
                      videos.length > 0
                        ? formatNumber(Math.round(totalViews / videos.length))
                        : '0'
                    }
                    percent={65}
                    gradient="from-emerald-500 to-teal-500"
                  />
                  <ProgressRow
                    label="Watch Time"
                    value={`${Math.round(totalViews * 0.75).toLocaleString()} min`}
                    percent={45}
                    gradient="from-blue-500 to-cyan-500"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── TV Show tab ── */}
            {approvedShow && isChannelOwner && (
              <TabsContent value="tv" className="mt-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold tracking-tight">
                          {approvedShow.show_title}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="h-2.5 w-2.5" />
                          Approved
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {approvedShow.category} · {approvedShow.format}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                        {approvedShow.description}
                      </p>
                      {(approvedShow.preferred_days?.length > 0 ||
                        approvedShow.preferred_time) && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 ring-1 ring-border/60">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Preferred airtime:{' '}
                            {[
                              approvedShow.preferred_days?.join(', '),
                              approvedShow.preferred_time,
                            ]
                              .filter(Boolean)
                              .join(' · ')}{' '}
                            ({approvedShow.timezone})
                          </span>
                        </div>
                      )}
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        The NexSq team will assign the show's airtime.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDuration = (seconds: number) => {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export default ChannelPage;