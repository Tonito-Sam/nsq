import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Eye,
  UserCheck,
  Edit3,
  Tag,
  Link2,
  Copy,
  Check,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
  Music2,
  Sparkles,
  TrendingUp,
  Users,
  Save,
  X,
  ImagePlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import apiUrl from '@/lib/api';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import SkeletonCard from '@/components/skeletons/SkeletonCard';
import SkeletonAvatar from '@/components/skeletons/SkeletonAvatar';
import SkeletonLine from '@/components/skeletons/SkeletonLine';
import { cn } from '@/lib/utils';
import { ShowSlotApplication } from '@/components/studio/ShowSlotApplication';

// ─── Social platform config ───────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourprofile', color: 'from-pink-500 to-purple-500' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/yourpage', color: 'from-blue-600 to-blue-500' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/yourprofile', color: 'from-sky-600 to-blue-500' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: 'https://tiktok.com/@yourprofile', color: 'from-gray-800 to-gray-600' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@yourchannel', color: 'from-red-600 to-red-500' },
  { key: 'x', label: 'X', icon: Twitter, placeholder: 'https://x.com/yourprofile', color: 'from-gray-900 to-gray-700' },
] as const;

const CATEGORIES = [
  'News', 'Religion', 'Sports', 'Music', 'Comedy', 'Education', 'Business',
  'Technology', 'Health', 'Society', 'Kids', 'True Crime', 'History', 'Science',
  'Fiction', 'TV & Film', 'Kickstart', 'Arts', 'Leisure', 'Government',
  'Spirituality', 'Personal Journals', 'Documentary', 'Other',
];

const MIN_VIEWS = 10000;
const MIN_SUBSCRIBERS = 2000;

// ─── Reusable UI primitives ───────────────────────────────────────────────────

const SectionCard = ({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => (
  <div
    id={id}
    className={cn(
      'rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm',
      'shadow-sm hover:shadow-md transition-shadow duration-300',
      className,
    )}
  >
    {children}
  </div>
);

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 ring-1 ring-purple-500/20">
      <Icon className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
    </div>
    <div>
      <h3 className="font-semibold text-base leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const StatTile = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className="flex-1 rounded-xl border border-border/50 bg-background/50 p-3.5">
    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-2', accent)}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="text-xl font-bold tabular-nums tracking-tight">{value.toLocaleString?.() ?? value}</div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">{label}</div>
  </div>
);

const FieldLabel = ({
  icon: Icon,
  children,
  htmlFor,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium mb-1.5">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    {children}
  </label>
);

// ─── Monetization Card ────────────────────────────────────────────────────────

const MonetizationCard = ({
  channel,
  totalChannelViews,
  subscriberCounts,
  handleToggleMonetization,
}: any) => {
  const viewsOk = totalChannelViews >= MIN_VIEWS;
  const subsOk = (subscriberCounts[channel.id] ?? 0) >= MIN_SUBSCRIBERS;
  const monetizationEnabled = viewsOk && subsOk;

  const progress = Math.min(
    100,
    Math.round(
      ((Math.min(totalChannelViews, MIN_VIEWS) / MIN_VIEWS) * 0.5 +
        (Math.min(subscriberCounts[channel.id] ?? 0, MIN_SUBSCRIBERS) / MIN_SUBSCRIBERS) * 0.5) *
        100,
    ),
  );

  const toggles = [
    { key: 'donation', label: 'Enable Donations', hint: 'Accept tips during live streams', checked: channel?.donation_enabled },
    { key: 'subscription', label: 'Enable Subscriptions', hint: 'Monetize your series content', checked: channel?.subscription_enabled },
  ];

  return (
    <SectionCard className="p-5">
      <SectionHeader
        icon={Sparkles}
        title="Monetization"
        subtitle={monetizationEnabled ? 'Your channel is eligible' : 'Unlock earning features'}
      />

      {/* Progress bar when not yet eligible */}
      {!monetizationEnabled && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span className="text-amber-700 dark:text-amber-400">Progress to eligibility</span>
            <span className="text-amber-700 dark:text-amber-400 tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className={cn('h-1.5 w-1.5 rounded-full', viewsOk ? 'bg-emerald-500' : 'bg-amber-500')} />
              {totalChannelViews.toLocaleString()} / {MIN_VIEWS.toLocaleString()} views
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className={cn('h-1.5 w-1.5 rounded-full', subsOk ? 'bg-emerald-500' : 'bg-amber-500')} />
              {(subscriberCounts[channel.id] ?? 0).toLocaleString()} / {MIN_SUBSCRIBERS.toLocaleString()} subs
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {toggles.map((t) => (
          <div
            key={t.key}
            className={cn(
              'flex items-center justify-between rounded-xl p-3 transition-colors',
              monetizationEnabled ? 'hover:bg-accent/50' : 'opacity-50',
            )}
          >
            <div>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.hint}</div>
            </div>
            <Switch
              checked={t.checked || false}
              onCheckedChange={(checked) => handleToggleMonetization(t.key, checked)}
              disabled={!monetizationEnabled}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const StudioSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [ownerAvatar, setOwnerAvatar] = useState('');
  const [uploadingBranding, setUploadingBranding] = useState<'avatar' | 'cover' | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const totalChannelViews = videos
    .filter((v) => v.channel_id === channel?.id)
    .reduce((sum, v) => sum + (v.views || 0), 0);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleToggleMonetization = async (type: 'donation' | 'subscription', enabled: boolean) => {
    if (!channel) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to update Studio settings.');
      const response = await fetch(apiUrl(`/api/studio-settings/${channel.id}/settings`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [`${type}_enabled`]: enabled }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not update Studio settings');
      if (result.channel) setChannel(result.channel);
      toast({ description: 'Monetization setting updated!' });
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : 'Failed to update monetization',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!channel) return;
    setSettingsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to update Studio settings.');
      const response = await fetch(apiUrl(`/api/studio-settings/${channel.id}/settings`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          category: editCategory,
          social_links: socialLinks,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save Studio settings');
      if (result.channel) setChannel(result.channel);
      toast({ description: 'Studio settings saved.' });
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : 'Could not save Studio settings',
        variant: 'destructive',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleBrandingUpload = async (type: 'avatar' | 'cover', file?: File) => {
    if (!channel || !user || !file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      toast({ description: 'Choose an image file smaller than 8 MB.', variant: 'destructive' });
      return;
    }

    setUploadingBranding(type);
    let uploadedPath = '';
    try {
      const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      uploadedPath = `${channel.id}/${type}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('studio-videos')
        .upload(uploadedPath, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('studio-videos').getPublicUrl(uploadedPath);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to update your Studio branding.');

      const field = type === 'avatar' ? 'avatar_url' : 'cover_url';
      const response = await fetch(apiUrl(`/api/studio-settings/${channel.id}/settings`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [field]: publicUrl }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save Studio image');
      if (result.channel) setChannel(result.channel);
      toast({ description: `Studio ${type} updated.` });
    } catch (error) {
      if (uploadedPath) await supabase.storage.from('studio-videos').remove([uploadedPath]);
      toast({
        description: error instanceof Error ? error.message : 'Could not upload Studio image',
        variant: 'destructive',
      });
    } finally {
      setUploadingBranding(null);
    }
  };

  const handleCopyLink = async () => {
    if (!channel) return;
    await navigator.clipboard.writeText(`https://nexsq.com/studio/${channel.id}`);
    setCopied(true);
    toast({ description: 'Link copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchChannel = async () => {
      if (!user) return;
      setLoading(true);
      const { data: channelData } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (channelData) {
        setChannel(channelData);
        setEditName(channelData.name || '');
        setEditDescription(channelData.description || '');
        setEditCategory(channelData.category || '');
        const { data: ownerData } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        setOwnerAvatar(ownerData?.avatar_url || '');
        const storedLinks = (channelData as unknown as { social_links?: Record<string, string | null> }).social_links;
        setSocialLinks(
          Object.fromEntries(
            SOCIAL_PLATFORMS.map(({ key }) => [key, storedLinks?.[key] || '']),
          ),
        );
        const { data: vids } = await supabase
          .from('studio_videos')
          .select('*')
          .eq('channel_id', channelData.id);
        setVideos(vids || []);
        const { count } = await supabase
          .from('studio_channel_subscribers')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelData.id);
        setSubscriberCounts({ [channelData.id]: count || 0 });
      }
      setLoading(false);
    };
    fetchChannel();
  }, [user]);

  useEffect(() => {
    if (loading || window.location.hash !== '#channel-branding') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('channel-branding')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          <div className="flex items-center gap-4">
            <SkeletonAvatar size={72} />
            <div className="flex-1">
              <SkeletonLine width="50%" />
              <SkeletonLine width="30%" className="mt-2" />
            </div>
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const channelUrl = channel ? `https://nexsq.com/studio/${channel.id}` : '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-2xl mx-auto px-4 pb-24 md:pb-12">
        {/* Sticky back bar */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-lg border-b border-border/40 mb-6">
          <button
            className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
        </div>

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Channel Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your channel identity, links, and monetization.
          </p>
        </div>

        {channel && (
          <SectionCard id="channel-branding" className="mb-5 p-5 scroll-mt-24">
            <SectionHeader
              icon={ImagePlus}
              title="Channel Branding"
              subtitle="Use your own channel artwork or keep your profile avatar as the default"
            />
            <div className="space-y-4">
              <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-500">
                {channel.cover_url && <img src={channel.cover_url} alt="Studio cover preview" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <h2 className="absolute bottom-3 left-4 right-36 truncate text-lg font-bold text-white drop-shadow-md">
                  {channel.name}
                </h2>
                <label htmlFor="studio-cover-upload" className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-black/65 px-3 py-2 text-xs font-semibold text-white hover:bg-black/80">
                  <ImagePlus className="h-4 w-4" />
                  {uploadingBranding === 'cover' ? 'Uploading…' : 'Change cover'}
                </label>
                <input
                  id="studio-cover-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!!uploadingBranding}
                  onChange={event => {
                    void handleBrandingUpload('cover', event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-border bg-muted">
                  {(channel.avatar_url || ownerAvatar) ? (
                    <img src={channel.avatar_url || ownerAvatar} alt="Studio avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                      {channel.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Studio avatar</p>
                  <p className="text-xs text-muted-foreground">Defaults to your account photo until you upload one.</p>
                </div>
                <label htmlFor="studio-avatar-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent">
                  <ImagePlus className="h-4 w-4" />
                  {uploadingBranding === 'avatar' ? 'Uploading…' : 'Change'}
                </label>
                <input
                  id="studio-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!!uploadingBranding}
                  onChange={event => {
                    void handleBrandingUpload('avatar', event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
          </SectionCard>
        )}

        {channel && (
          <div className="space-y-5 mb-8">
            {/* ── Channel overview ── */}
            <SectionCard className="p-5">
              <div className="mb-4">
                <h2 className="text-lg font-bold truncate">{channel.name}</h2>
                {channel.category && (
                  <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                    <Tag className="h-3 w-3" />
                    {channel.category}
                  </span>
                )}
                {channel.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                    {channel.description}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                  <StatTile
                    icon={Eye}
                    label="Total Views"
                    value={totalChannelViews}
                    accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />
                  <StatTile
                    icon={Users}
                    label="Subscribers"
                    value={subscriberCounts[channel.id] ?? 0}
                    accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  />
                  <StatTile
                    icon={TrendingUp}
                    label="Videos"
                    value={videos.filter((v) => v.channel_id === channel.id).length}
                    accent="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  />
              </div>
            </SectionCard>

            {/* ── Invite friends ── */}
            <SectionCard className="p-5">
              <SectionHeader
                icon={Link2}
                title="Invite Friends"
                subtitle="Share your channel link to grow your audience"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                    Channel URL
                  </div>
                  <div className="text-xs font-mono text-foreground/80 truncate">{channelUrl}</div>
                </div>
                <Button
                  size="sm"
                  variant={copied ? 'secondary' : 'default'}
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </SectionCard>

            <ShowSlotApplication />

            {/* ── Monetization ── */}
            <MonetizationCard
              channel={channel}
              totalChannelViews={totalChannelViews}
              subscriberCounts={subscriberCounts}
              handleToggleMonetization={handleToggleMonetization}
            />
          </div>
        )}

        {/* ── Settings form ── */}
        <form className="space-y-5" onSubmit={handleSaveSettings}>
          {/* Basic info */}
          <SectionCard className="p-5">
            <SectionHeader
              icon={Edit3}
              title="Channel Details"
              subtitle="Public information shown on your channel"
            />
            <div className="space-y-4">
              <div>
                <FieldLabel icon={Edit3}>Channel Name</FieldLabel>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={80}
                  className="font-semibold text-base h-11 rounded-xl"
                  required
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {editName.length}/80
                  </span>
                </div>
              </div>
              <div>
                <FieldLabel icon={Edit3}>Description</FieldLabel>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="Tell listeners what your channel is about"
                />
              </div>
              <div>
                <FieldLabel icon={Tag}>Category</FieldLabel>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-shadow"
                  required
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* Social links */}
          <SectionCard className="p-5">
            <SectionHeader
              icon={Link2}
              title="Social Profile Links"
              subtitle="Add your public pages to help listeners find you"
            />
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              These links don't authorize NexSq to publish on your behalf. Automatic cross-posting
              requires a secure connection to each platform.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder, color }) => (
                <div key={key}>
                  <label
                    htmlFor={`social-${key}`}
                    className="flex items-center gap-2 text-xs font-medium mb-1.5"
                  >
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br text-white', color)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    {label}
                  </label>
                  <Input
                    id={`social-${key}`}
                    type="url"
                    value={socialLinks[key] || ''}
                    onChange={(e) =>
                      setSocialLinks((cur) => ({ ...cur, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="h-10 rounded-xl text-sm"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 h-11 rounded-xl gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={settingsLoading}
              className="flex-1 h-11 rounded-xl gap-2 bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600 shadow-lg shadow-purple-500/20"
            >
              {settingsLoading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default StudioSettings;