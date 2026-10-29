import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Tv,
  Sparkles,
  Calendar,
  Clock,
  Radio,
  Video,
  Layers,
  Building2,
  Wand2,
  PartyPopper,
  LayoutDashboard,
  Upload,
  Palette,
  Users,
  Info,
  Save,
  Plus,
  Image as ImageIcon,
  ChevronRight,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import StudioShowManagementWorkspace from '@/components/studio/StudioShowManagement';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovedShowApplication {
  applicant_id: string;
  show_title: string;
  description: string;
  category: string;
  format: 'recorded' | 'live' | 'mixed';
  preferred_days: string[];
  preferred_time: string | null;
  approved_show_id: string;
}

interface StudioShowRecord {
  title: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  brand_color: string | null;
  approved_days?: string[] | null;
}

interface CreatorIdentity {
  username: string | null;
  channelId: string | null;
  channelName: string | null;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const SectionCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <Card
    className={cn(
      'overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm',
      className,
    )}
  >
    {children}
  </Card>
);

const FieldLabel = ({
  icon: Icon,
  children,
  hint,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div className="mb-1.5 flex items-center justify-between gap-2">
    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </label>
    {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
  </div>
);

const EmptyState = ({
  icon: Icon,
  title,
  description,
  accent = 'purple',
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent?: 'purple' | 'blue' | 'emerald' | 'amber';
}) => {
  const accents = {
    purple:
      'from-purple-500/15 to-fuchsia-500/10 ring-purple-500/20 text-purple-600 dark:text-purple-400',
    blue: 'from-blue-500/15 to-cyan-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400',
    emerald:
      'from-emerald-500/15 to-teal-500/10 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber:
      'from-amber-500/15 to-orange-500/10 ring-amber-500/20 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="rounded-2xl border border-dashed border-border/60 py-10 text-center">
      <div
        className={cn(
          'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1',
          accents[accent],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs mx-auto text-[11px] text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
};

// ─── Format config ────────────────────────────────────────────────────────────

const FORMAT_META: Record<
  string,
  { icon: React.ElementType; label: string; gradient: string }
> = {
  live: { icon: Radio, label: 'Live', gradient: 'from-red-500 to-rose-500' },
  recorded: {
    icon: Video,
    label: 'Recorded',
    gradient: 'from-blue-500 to-cyan-500',
  },
  mixed: {
    icon: Layers,
    label: 'Mixed',
    gradient: 'from-purple-500 to-fuchsia-500',
  },
};

// ─── Info chip ────────────────────────────────────────────────────────────────

const InfoChip = ({
  icon: Icon,
  label,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  tone?: 'default' | 'emerald' | 'purple' | 'blue';
}) => {
  const tones = {
    default: 'bg-muted/60 text-foreground/80 ring-border/60',
    emerald:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    purple:
      'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1',
        tones[tone],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const LoadingState = () => (
  <div className="space-y-6">
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
      <div className="h-40 bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-pink-500/20 animate-pulse" />
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-2xl bg-muted animate-pulse" />
          <div className="flex-1 space-y-2 pt-14">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-6 w-64 rounded bg-muted animate-pulse" />
            <div className="h-3 w-48 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-16 rounded-2xl bg-muted/60 animate-pulse" />
      </div>
    </div>
  </div>
);

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    gradient: 'from-purple-600 to-fuchsia-500',
  },
  {
    key: 'episodes',
    label: 'Episodes',
    icon: Upload,
    gradient: 'from-blue-600 to-cyan-500',
  },
  {
    key: 'branding',
    label: 'Branding',
    icon: Palette,
    gradient: 'from-pink-600 to-rose-500',
  },
  {
    key: 'managers',
    label: 'Managers',
    icon: Users,
    gradient: 'from-emerald-600 to-teal-500',
  },
  {
    key: 'details',
    label: 'Details',
    icon: Info,
    gradient: 'from-amber-600 to-orange-500',
  },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ─── StudioShowManagement (fallback when no workspace) ───────────────────────

const StudioShowManagement = ({
  showId,
  isOwner,
  onShowUpdated,
}: {
  showId: string;
  isOwner: boolean;
  onShowUpdated: (show: StudioShowRecord) => void;
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [title, setTitle] = useState('Football Clinic');
  const [synopsis, setSynopsis] = useState(
    'Diagnosis and Diagnostics of the game we love.',
  );
  const [category, setCategory] = useState('Sports');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 700);
  };

  const activeMeta = TABS.find((t) => t.key === activeTab)!;

  if (showId) {
    return (
      <StudioShowManagementWorkspace
        showId={showId}
        isOwner={isOwner}
        onShowUpdated={onShowUpdated}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-2 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-fuchsia-500/[0.03]" />
        <div className="relative -mx-1 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 min-w-max px-1">
            {TABS.map(({ key, label, icon: Icon, gradient }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'group flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200',
                    isActive
                      ? cn('bg-gradient-to-br text-white shadow-md ring-0', gradient)
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      isActive && 'scale-110',
                      !isActive && 'group-hover:scale-110',
                    )}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <SectionCard>
        <div className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md',
                activeMeta.gradient,
              )}
            >
              <activeMeta.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-sm font-bold tracking-tight leading-tight">
                {activeMeta.label}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {activeTab === 'overview' && 'Snapshot of your show at a glance'}
                {activeTab === 'episodes' && 'Upload and manage your episodes'}
                {activeTab === 'branding' && 'Cover images, logos, visual identity'}
                {activeTab === 'managers' && 'People who can help run this show'}
                {activeTab === 'details' && 'Public-facing show information'}
              </p>
            </div>
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {(
                  [
                    { icon: Upload, label: 'Episodes', value: '0', tone: 'blue' },
                    { icon: Users, label: 'Managers', value: '1', tone: 'emerald' },
                    { icon: Sparkles, label: 'Status', value: 'Approved', tone: 'purple' },
                    { icon: Info, label: 'Category', value: category, tone: 'amber' },
                  ] as const
                ).map(({ icon: Icon, label, value, tone }) => {
                  const tones = {
                    blue: 'from-blue-500/15 to-cyan-500/10 ring-blue-500/20 text-blue-600 dark:text-blue-400',
                    emerald:
                      'from-emerald-500/15 to-teal-500/10 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                    purple:
                      'from-purple-500/15 to-fuchsia-500/10 ring-purple-500/20 text-purple-600 dark:text-purple-400',
                    amber:
                      'from-amber-500/15 to-orange-500/10 ring-amber-500/20 text-amber-600 dark:text-amber-400',
                  };
                  return (
                    <div
                      key={label}
                      className="rounded-2xl border border-border/60 bg-background/40 p-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          'mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1',
                          tones[tone],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-base font-bold tabular-nums leading-none truncate">
                        {value}
                      </div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
              <EmptyState
                icon={Upload}
                title="No episodes published yet"
                description="Upload your first episode to start broadcasting on NexSq TV"
                accent="blue"
              />
            </>
          )}

          {activeTab === 'episodes' && (
            <>
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  className={cn(
                    'h-9 gap-2 rounded-xl font-semibold',
                    'bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600',
                    'shadow-md shadow-blue-500/25',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Episode
                </Button>
              </div>
              <EmptyState
                icon={Upload}
                title="No episodes yet"
                description="Your episodes will appear here once uploaded. Click 'New Episode' to get started."
                accent="blue"
              />
            </>
          )}

          {activeTab === 'branding' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Show cover', hint: 'Recommended 1920×1080 · JPG or PNG' },
                { title: 'Show logo', hint: 'Transparent PNG · 512×512' },
              ].map(({ title: label, hint }) => (
                <button
                  key={label}
                  type="button"
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-background/40 p-8 transition-colors hover:border-pink-500/40 hover:bg-pink-500/[0.03]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/15 to-rose-500/10 ring-1 ring-pink-500/20 transition-transform group-hover:scale-110">
                    <ImageIcon className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {hint}
                    </div>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400">
                    Upload
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'managers' && (
            <>
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  className={cn(
                    'h-9 gap-2 rounded-xl font-semibold',
                    'bg-gradient-to-br from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600',
                    'shadow-md shadow-emerald-500/25',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Invite
                </Button>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/40 p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-bold shadow-sm">
                    Y
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">You</div>
                    <div className="text-[11px] text-muted-foreground">
                      Owner · Full access
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                    Owner
                  </span>
                </div>
              </div>
              <EmptyState
                icon={Users}
                title="No additional managers"
                description="Invite teammates to help manage episodes, schedules, and analytics"
                accent="emerald"
              />
            </>
          )}

          {activeTab === 'details' && (
            <>
              {!isOwner && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-500/[0.06] px-3 py-2.5 text-xs ring-1 ring-amber-500/20">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-300">
                    Only the show owner can edit these details.
                  </span>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <FieldLabel icon={Info} hint="max 80">
                    Show title
                  </FieldLabel>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    disabled={!isOwner}
                    className="h-11 rounded-xl"
                  />
                  <div className="mt-1 flex justify-end">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {title.length}/80
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel icon={Info}>Synopsis</FieldLabel>
                  <textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    rows={3}
                    maxLength={500}
                    disabled={!isOwner}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-shadow resize-none disabled:opacity-60"
                  />
                  <div className="mt-1 flex justify-end">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {synopsis.length}/500
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel icon={Info}>Category</FieldLabel>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={!isOwner}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-shadow disabled:opacity-60"
                  >
                    <option value="Sports">Sports</option>
                    <option value="News">News</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Education">Education</option>
                    <option value="Business">Business</option>
                    <option value="Culture">Culture</option>
                    <option value="Music">Music</option>
                    <option value="Comedy">Comedy</option>
                  </select>
                </div>

                {isOwner && (
                  <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/60">
                    <div className="flex items-center gap-2 min-w-0">
                      {saved && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-left-2 duration-200">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                          Saved
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className={cn(
                        'h-10 gap-2 rounded-xl font-semibold shrink-0',
                        'bg-gradient-to-br from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600',
                        'shadow-md shadow-amber-500/25',
                      )}
                    >
                      {saving ? (
                        <>
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save details
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const StudioShowPage = () => {
  const { showId } = useParams<{ showId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApprovedShowApplication | null>(null);
  const [showDetails, setShowDetails] = useState<StudioShowRecord | null>(null);
  const [creatorIdentity, setCreatorIdentity] = useState<CreatorIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;

    const loadApprovedShow = async () => {
      if (!user?.id || !showId) {
        if (current) setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('studio_show_applications' as any)
        .select(
          'applicant_id, show_title, description, category, format, preferred_days, preferred_time, approved_show_id',
        )
        .eq('approved_show_id', showId)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (!current) return;
      if (error) {
        console.error('Could not load approved TV show:', error);
        setApplication(null);
        setShowDetails(null);
        setCreatorIdentity(null);
      } else if (data) {
        const approvedApplication = data as ApprovedShowApplication;
        setApplication(approvedApplication);

        const [showResult, channelResult, creatorResult] = await Promise.all([
          supabase
            .from('studio_shows')
            .select(
              'title, description, category, thumbnail_url, logo_url, banner_url, brand_color, approved_days',
            )
            .eq('id', approvedApplication.approved_show_id)
            .maybeSingle(),
          supabase
            .from('studio_channels')
            .select('id, name')
            .eq('user_id', approvedApplication.applicant_id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('users')
            .select('username')
            .eq('id', approvedApplication.applicant_id)
            .maybeSingle(),
        ]);

        if (!current) return;
        if (showResult.error)
          console.error('Could not load TV show branding:', showResult.error);
        setShowDetails((showResult.data as StudioShowRecord | null) || null);
        setCreatorIdentity({
          username: creatorResult.data?.username || null,
          channelId: channelResult.data?.id || null,
          channelName: channelResult.data?.name || null,
        });
      } else {
        setApplication(null);
        setShowDetails(null);
        setCreatorIdentity(null);
      }
      setLoading(false);
    };

    void loadApprovedShow();
    return () => {
      current = false;
    };
  }, [showId, user?.id]);

  const isOwner = application?.applicant_id === user?.id;
  const formatMeta = application
    ? FORMAT_META[application.format] || FORMAT_META.recorded
    : FORMAT_META.recorded;
  const FormatIcon = formatMeta.icon;
  const showBrandColor = showDetails?.brand_color || '#7c3aed';
  const broadcastDays = showDetails?.approved_days?.length
    ? showDetails.approved_days
    : application?.preferred_days || [];
  const hasApprovedDays = Boolean(showDetails?.approved_days?.length);

  const handleShowUpdated = (updatedShow: StudioShowRecord) => {
    setShowDetails(updatedShow);
    setApplication((current) =>
      current
        ? {
            ...current,
            show_title: updatedShow.title,
            description: updatedShow.description,
            category: updatedShow.category,
          }
        : current,
    );
  };

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="mx-auto max-w-5xl space-y-5 pb-16">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="group -ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Studio
        </button>

        {loading ? (
          <LoadingState />
        ) : !application ? (
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card">
            <div className="relative h-32 bg-gradient-to-br from-slate-500/20 via-slate-400/10 to-slate-500/5">
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-slate-500/15 blur-3xl" />
            </div>
            <CardContent className="relative p-8 text-center -mt-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted ring-4 ring-card shadow-lg">
                <Tv className="h-7 w-7 text-muted-foreground" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">
                TV show unavailable
              </h1>
              <p className="mt-1.5 max-w-md mx-auto text-xs leading-relaxed text-muted-foreground">
                This show isn't approved for your account, or it may have been
                removed. Double-check your applications or contact the NexSq team.
              </p>
              <Button
                onClick={() => navigate('/studio')}
                className={cn(
                  'mt-5 h-10 gap-2 rounded-xl font-semibold',
                  'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                  'shadow-md shadow-purple-500/25',
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Studio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════
                HERO SHOW CARD
               ═══════════════════════════════════════════════════════ */}
            <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
              {/* ── Banner ───────────────────────────────────────────
                  Fixed height, object-cover center, dark gradient from
                  bottom-left for text readability. No more stretched FC. */}
              <div
                className="relative h-44 sm:h-56 overflow-hidden"
                style={{
                  backgroundColor: showBrandColor,
                  backgroundImage: !showDetails?.banner_url
                    ? `linear-gradient(135deg, ${showBrandColor} 0%, #ec4899 50%, #f59e0b 100%)`
                    : undefined,
                }}
              >
                {showDetails?.banner_url && (
                  <img
                    src={showDetails.banner_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                )}

                {/* Legibility overlay — subtle, only where text sits */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                {/* Corner glow */}
                <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

                {/* Floating badges */}
                <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/20">
                    <Tv className="h-3 w-3" />
                    NexSq TV
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/95 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md shadow-emerald-500/30">
                    <BadgeCheck className="h-3 w-3" />
                    Approved
                  </span>
                </div>

                <Sparkles className="absolute top-4 right-4 z-10 h-5 w-5 text-white/70" />
              </div>

              {/* ── Content ──────────────────────────────────────── */}
              <div className="px-5 sm:px-7 pb-7">
                {/* Avatar / logo row — overlaps banner */}
                <div className="flex items-start gap-4 -mt-12 sm:-mt-14 mb-5">
                  <div
                    className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl ring-4 ring-card shadow-xl"
                    style={{
                      backgroundColor: showDetails?.logo_url ? '#ffffff' : showBrandColor,
                    }}
                  >
                    {showDetails?.logo_url ? (
                      <img
                        src={showDetails.logo_url}
                        alt={`${showDetails.title} logo`}
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <FormatIcon className="h-10 w-10 text-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pt-14 sm:pt-16">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                      {showDetails?.title || application.show_title}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {creatorIdentity?.username && (
                        <Link
                          to={`/profile/${encodeURIComponent(creatorIdentity.username)}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          @{creatorIdentity.username}
                        </Link>
                      )}
                      {creatorIdentity?.channelId && (
                        <Link
                          to={`/studio/channel/${creatorIdentity.channelId}`}
                          className="text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {creatorIdentity.channelName || 'Creator channel'}
                        </Link>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <InfoChip
                        icon={FormatIcon}
                        label={formatMeta.label}
                        tone="purple"
                      />
                      {application.category && (
                        <InfoChip
                          icon={Building2}
                          label={showDetails?.category || application.category}
                          tone="blue"
                        />
                      )}
                      {application.preferred_time && (
                        <InfoChip
                          icon={Clock}
                          label={application.preferred_time}
                          tone="emerald"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {(showDetails?.description || application.description) && (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 mb-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        About this show
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                      {showDetails?.description || application.description}
                    </p>
                  </div>
                )}

                {(broadcastDays.length > 0 ||
                  application.preferred_time) && (
                  <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/[0.04] to-fuchsia-500/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {hasApprovedDays ? 'Approved broadcast days' : 'Preferred airtime'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {broadcastDays.map((d) => (
                        <span                          key={d}
                          className="inline-flex items-center rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                        >
                          {d.slice(0, 3).toUpperCase()}
                        </span>
                      ))}
                      {application.preferred_time && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1 text-[11px] font-bold tabular-nums text-foreground ring-1 ring-border/60">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {application.preferred_time}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      {hasApprovedDays
                        ? 'These are the broadcast days approved by the NexSq team.'
                        : 'The NexSq team will confirm the final broadcast days and slot.'}
                    </p>
                  </div>
                )}

                {isOwner && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                    <PartyPopper className="h-3 w-3" />
                    You own this show
                  </div>
                )}
              </div>
            </Card>

            {/* ═══════════════════════════════════════════════════════
                MANAGEMENT
               ═══════════════════════════════════════════════════════ */}
            <StudioShowManagement
              showId={application.approved_show_id || ''}
              isOwner={isOwner}
              onShowUpdated={handleShowUpdated}
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default StudioShowPage;