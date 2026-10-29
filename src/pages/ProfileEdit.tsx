import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OrganizationsTab } from '@/components/OrganizationsTab';
import { useOrganizations } from '@/hooks/useOrganizations';
import {
  User as UserIcon,
  Cake,
  CalendarHeart,
  ShieldCheck,
  Building2,
  Landmark,
  Plus,
  X,
  Check,
  AlertCircle,
  Save,
  ArrowLeft,
  Sparkles,
  Clock,
  Flag,
  Trash2,
  Info,
  CreditCard,
  Globe,
  MapPin,
  UserCircle2,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabKey = 'profile' | 'birthdays' | 'pgp' | 'organizations';

const TABS: { key: TabKey; label: string; icon: React.ElementType; gradient: string }[] = [
  { key: 'profile', label: 'Profile', icon: UserIcon, gradient: 'from-blue-600 to-cyan-500' },
  { key: 'birthdays', label: 'Celebrations', icon: Cake, gradient: 'from-emerald-600 to-teal-500' },
  { key: 'pgp', label: 'PGP', icon: ShieldCheck, gradient: 'from-orange-600 to-amber-500' },
  { key: 'organizations', label: 'Organizations', icon: Building2, gradient: 'from-purple-600 to-fuchsia-500' },
];

// ─── Section Card (clean modern surface) ──────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  subtitle,
  accent,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accent: 'blue' | 'emerald' | 'orange' | 'purple' | 'cyan';
  children: React.ReactNode;
  className?: string;
}) => {
  const accents = {
    blue: { tile: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20' },
    emerald: { tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20' },
    orange: { tile: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20' },
    purple: { tile: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20' },
    cyan: { tile: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20' },
  };
  const a = accents[accent];

  return (
    <Card className={cn('overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm', className)}>
      <div className="p-6">
        <div className="mb-6 flex items-start gap-3.5">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', a.tile)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-base font-bold tracking-tight leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
};

// ─── Field Label ──────────────────────────────────────────────────────────────

const FieldLabel = ({
  icon: Icon,
  children,
  hint,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </label>
    {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
  </div>
);

// ─── Info Callout ─────────────────────────────────────────────────────────────

const InfoCallout = ({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: 'blue' | 'orange' | 'purple' | 'emerald';
}) => {
  const tones = {
    blue: 'bg-blue-500/[0.06] text-blue-700 dark:text-blue-300 ring-blue-500/15',
    orange: 'bg-orange-500/[0.06] text-orange-700 dark:text-orange-300 ring-orange-500/15',
    purple: 'bg-purple-500/[0.06] text-purple-700 dark:text-purple-300 ring-purple-500/15',
    emerald: 'bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300 ring-emerald-500/15',
  };
  return (
    <div className={cn('flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1', tones[tone])}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({
  icon: Icon,
  title,
  description,
  accent = 'blue',
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  accent?: 'blue' | 'orange' | 'purple' | 'emerald';
}) => {
  const accents = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
  };
  return (
    <div className="rounded-2xl border border-dashed border-border/60 py-10 text-center">
      <div className={cn('mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ring-1', accents[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground max-w-xs mx-auto">{description}</p>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProfileEdit: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [birthday, setBirthday] = useState('');
  const [anniversaries, setAnniversaries] = useState([
    { date: '', label: '' },
    { date: '', label: '' },
    { date: '', label: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select(
          'birthday, anniversary1_date, anniversary1_label, anniversary2_date, anniversary2_label, anniversary3_date, anniversary3_label',
        )
        .eq('id', user.id)
        .single();
      if (error) {
        setError(error.message || 'Failed to load profile');
        setLoading(false);
        return;
      }
      if (data) {
        setBirthday(data.birthday || '');
        setAnniversaries([
          { date: data.anniversary1_date || '', label: data.anniversary1_label || '' },
          { date: data.anniversary2_date || '', label: data.anniversary2_label || '' },
          { date: data.anniversary3_date || '', label: data.anniversary3_label || '' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    try {
      const qp = new URLSearchParams(location.search).get('tab');
      if (qp === 'organizations' || qp === 'birthdays' || qp === 'pgp' || qp === 'profile') {
        setActiveTab(qp as TabKey);
      }
    } catch {}
  }, [location.search]);

  const handleAnniversaryChange = (idx: number, field: 'date' | 'label', value: string) => {
    setAnniversaries((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updates: any = {
        birthday: birthday || null,
        anniversary1_date: anniversaries[0].date || null,
        anniversary1_label: anniversaries[0].label || null,
        anniversary2_date: anniversaries[1].date || null,
        anniversary2_label: anniversaries[1].label || null,
        anniversary3_date: anniversaries[2].date || null,
        anniversary3_label: anniversaries[2].label || null,
      };
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const { organizations, loading: orgsLoading, fetchOrganizations } = useOrganizations();

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Birthdays state
  const [extraBirthdays, setExtraBirthdays] = useState<{ name: string; date: string }[]>([]);
  const handleAddBirthday = () => setExtraBirthdays([...extraBirthdays, { name: '', date: '' }]);
  const handleBirthdayChange = (idx: number, field: 'name' | 'date', value: string) => {
    setExtraBirthdays((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };
  const handleRemoveBirthday = (idx: number) =>
    setExtraBirthdays((prev) => prev.filter((_, i) => i !== idx));

  // PGP state
  const [minors, setMinors] = useState<
    { username: string; timeSpent: number; timeLimit: number; flagged: boolean }[]
  >([]);
  const [newMinor, setNewMinor] = useState('');
  const handleAddMinor = () => {
    if (newMinor.trim()) {
      setMinors([...minors, { username: newMinor.trim(), timeSpent: 0, timeLimit: 60, flagged: false }]);
      setNewMinor('');
    }
  };
  const handleRemoveMinor = (idx: number) => setMinors((prev) => prev.filter((_, i) => i !== idx));
  const handleTimeLimitChange = (idx: number, value: number) => {
    setMinors((prev) => prev.map((m, i) => (i === idx ? { ...m, timeLimit: value } : m)));
  };

  return (
    <Layout hideRightSidebar>
      <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-10 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            HEADER
           ═══════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="group flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Edit Profile</h1>
            <p className="text-xs text-muted-foreground">
              Manage your personal details and preferences
            </p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB NAVIGATION — animated pill tabs
           ═══════════════════════════════════════════════════════════════ */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-lg">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {TABS.map(({ key, label, icon: Icon, gradient }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'group relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ring-1',
                    isActive
                      ? cn('bg-gradient-to-br text-white shadow-md ring-transparent', gradient)
                      : 'bg-card/60 text-muted-foreground ring-border/60 hover:bg-muted/60 hover:text-foreground hover:ring-border',
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

        {/* ═══════════════════════════════════════════════════════════════
            PROFILE TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Personal Info */}
            <SectionCard
              icon={UserIcon}
              title="Personal Info"
              subtitle="Birthday and anniversaries shown on your profile"
              accent="blue"
            >
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-11 rounded-xl bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-600 dark:text-red-400 ring-1 ring-red-500/20">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Birthday */}
                  <div className="mb-6">
                    <FieldLabel icon={Cake}>Birthday</FieldLabel>
                    <Input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {/* Anniversaries */}
                  <div className="mb-6">
                    <FieldLabel icon={CalendarHeart} hint="max 3">
                      Anniversaries
                    </FieldLabel>
                    <div className="space-y-2">
                      {anniversaries.map((a, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/50 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[11px] font-bold text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                              {i + 1}
                            </span>
                            <Input
                              type="date"
                              value={a.date}
                              onChange={(e) => handleAnniversaryChange(i, 'date', e.target.value)}
                              className="h-10 rounded-xl"
                            />
                          </div>
                          <Input
                            type="text"
                            value={a.label}
                            onChange={(e) => handleAnniversaryChange(i, 'label', e.target.value)}
                            placeholder="Label (e.g., Wedding)"
                            maxLength={32}
                            className="h-10 rounded-xl"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5">
                      <InfoCallout>You can add up to 3 anniversaries.</InfoCallout>
                    </div>
                  </div>

                  {/* Success */}
                  {success && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/[0.08] px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                      Changes saved successfully
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-border/60">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(-1)}
                      className="flex-1 h-11 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className={cn(
                        'flex-1 h-11 rounded-xl gap-2 font-semibold',
                        'bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600',
                        'shadow-md shadow-blue-500/25 transition-all',
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
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </SectionCard>

            {/* PGP */}
            <SectionCard
              icon={ShieldCheck}
              title="Parental Guidance Portal"
              subtitle="Monitor and manage minor accounts (ages 13–18)"
              accent="orange"
            >
              <div className="mb-5">
                <InfoCallout tone="orange">
                  Add minors to supervise their activity, set time limits, and receive alerts for
                  flagged conversations.
                </InfoCallout>
              </div>

              <div className="mb-5">
                <FieldLabel icon={UserCircle2}>Add Minor's Account</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newMinor}
                    onChange={(e) => setNewMinor(e.target.value)}
                    placeholder="Minor's username"
                    className="flex-1 h-11 rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMinor();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddMinor}
                    className={cn(
                      'h-11 gap-1.5 rounded-xl px-4 font-semibold',
                      'bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600',
                      'shadow-md shadow-orange-500/25',
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {minors.length === 0 ? (
                <EmptyState
                  icon={UserCircle2}
                  title="No minors added yet"
                  description="Add a minor account to start monitoring their activity"
                  accent="orange"
                />
              ) : (
                <div className="space-y-3">
                  {minors.map((m, i) => (
                    <div
                      key={i}
                      className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-orange-500/[0.04] to-amber-500/[0.03] p-4"
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-500 to-amber-500" />
                      <div className="flex items-start justify-between gap-3 pl-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold text-white shadow-sm">
                            {m.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{m.username}</div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {m.timeSpent} min spent today
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMinor(i)}
                          className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                          aria-label="Remove minor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Daily limit
                          </span>
                          <Input
                            type="number"
                            min={10}
                            max={240}
                            value={m.timeLimit}
                            onChange={(e) => handleTimeLimitChange(i, Number(e.target.value))}
                            className="h-8 w-20 rounded-lg text-xs tabular-nums"
                          />
                          <span className="text-[11px] text-muted-foreground">min</span>
                        </div>
                        <div
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            m.flagged
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                          )}
                        >
                          <Flag className="h-2.5 w-2.5" />
                          {m.flagged ? 'Flagged' : 'Clear'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Organizations Preview */}
            <SectionCard
              icon={Building2}
              title="Organizations"
              subtitle="Your associated organizations"
              accent="purple"
            >
              {orgsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-2xl bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : organizations && organizations.length > 0 ? (
                <div className="space-y-2.5">
                  {organizations.slice(0, 3).map((o) => (
                    <div
                      key={o.id}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5 transition-all hover:border-purple-500/30 hover:bg-purple-500/[0.03]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                          <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{o.name}</div>
                          {o.description && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {o.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/org/${o.slug || o.id}`)}
                        className="shrink-0 h-8 rounded-full text-xs"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                  {organizations.length > 3 && (
                    <div className="pt-1 text-center">
                      <span className="text-[11px] text-muted-foreground">
                        +{organizations.length - 3} more organization
                        {organizations.length - 3 !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-border/60">
                    <Button
                      onClick={() => setActiveTab('organizations')}
                      className={cn(
                        'w-full h-10 gap-2 rounded-xl font-semibold',
                        'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                        'shadow-md shadow-purple-500/25',
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                      Manage Organizations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/[0.03] p-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20">
                    <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium">No organizations yet</p>
                  <p className="mt-1 mb-4 text-[11px] text-muted-foreground">
                    Create your first organization to get started
                  </p>
                  <Button
                    onClick={() => setActiveTab('organizations')}
                    className={cn(
                      'gap-2 rounded-xl font-semibold',
                      'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                      'shadow-md shadow-purple-500/25',
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Create Organization
                  </Button>
                </div>
              )}
            </SectionCard>

            {/* Bank Account */}
            <SectionCard
              icon={Landmark}
              title="Bank Account Details"
              subtitle="Used for payouts and earnings withdrawal"
              accent="cyan"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel icon={Globe}>Country</FieldLabel>
                    <select className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-shadow">
                      <option>South Africa</option>
                      <option>United States</option>
                      <option>United Kingdom</option>
                      <option>Canada</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel icon={MapPin}>State / Province</FieldLabel>
                    <select className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-shadow">
                      <option>Gauteng</option>
                      <option>Western Cape</option>
                      <option>KwaZulu-Natal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel icon={Landmark}>Bank</FieldLabel>
                  <select className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/60 transition-shadow">
                    <option>First National Bank</option>
                    <option>Standard Bank</option>
                    <option>ABSA</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel icon={CreditCard}>Account Number</FieldLabel>
                    <Input
                      type="text"
                      placeholder="Enter account number"
                      className="h-11 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <FieldLabel icon={UserCircle2}>Account Holder Name</FieldLabel>
                    <Input
                      type="text"
                      placeholder="Enter account holder name"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    className={cn(
                      'w-full h-11 gap-2 rounded-xl font-semibold',
                      'bg-gradient-to-br from-cyan-600 to-sky-500 hover:from-cyan-700 hover:to-sky-600',
                      'shadow-md shadow-cyan-500/25',
                    )}
                  >
                    <Save className="h-4 w-4" />
                    Save Bank Details
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            BIRTHDAYS TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'birthdays' && (
          <SectionCard
            icon={CalendarHeart}
            title="Loved Ones' Birthdays"
            subtitle="Never miss a special day again"
            accent="emerald"
          >
            {extraBirthdays.length === 0 ? (
              <div className="mb-4">
                <EmptyState
                  icon={Cake}
                  title="No birthdays added"
                  description="Add friends and family to get reminders on their special days"
                  accent="emerald"
                />
              </div>
            ) : (
              <div className="space-y-2.5 mb-4">
                {extraBirthdays.map((b, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_auto] gap-2 rounded-2xl border border-border/60 bg-background/50 p-3"
                  >
                    <Input
                      type="text"
                      value={b.name}
                      onChange={(e) => handleBirthdayChange(i, 'name', e.target.value)}
                      placeholder="Name (e.g., Mom)"
                      className="h-10 rounded-xl"
                    />
                    <Input
                      type="date"
                      value={b.date}
                      onChange={(e) => handleBirthdayChange(i, 'date', e.target.value)}
                      className="h-10 rounded-xl"
                    />
                    <button
                      onClick={() => handleRemoveBirthday(i)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                      aria-label="Remove birthday"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddBirthday}
              className={cn(
                'w-full h-11 gap-2 rounded-xl font-semibold',
                'bg-gradient-to-br from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600',
                'shadow-md shadow-emerald-500/25',
              )}
            >
              <Plus className="h-4 w-4" />
              Add Birthday
            </Button>
          </SectionCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PGP TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'pgp' && (
          <SectionCard
            icon={ShieldCheck}
            title="Parental Guidance Portal"
            subtitle="Monitor and manage minor accounts (ages 13–18)"
            accent="orange"
          >
            <div className="mb-5">
              <InfoCallout tone="orange">
                Add minors to supervise their activity, set time limits, and receive alerts for
                flagged conversations.
              </InfoCallout>
            </div>

            <div className="mb-5">
              <FieldLabel icon={UserCircle2}>Add Minor's Account</FieldLabel>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newMinor}
                  onChange={(e) => setNewMinor(e.target.value)}
                  placeholder="Minor's username"
                  className="flex-1 h-11 rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMinor();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddMinor}
                  className={cn(
                    'h-11 gap-1.5 rounded-xl px-4 font-semibold',
                    'bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600',
                    'shadow-md shadow-orange-500/25',
                  )}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {minors.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No minors added yet"
                description="Add a minor account to start monitoring their activity"
                accent="orange"
              />
            ) : (
              <div className="space-y-3">
                {minors.map((m, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-orange-500/[0.04] to-amber-500/[0.03] p-4"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-500 to-amber-500" />
                    <div className="flex items-start justify-between gap-3 pl-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold text-white shadow-sm">
                          {m.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{m.username}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {m.timeSpent} min spent today
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMinor(i)}
                        className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                        aria-label="Remove minor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Daily limit
                        </span>
                        <Input
                          type="number"
                          min={10}
                          max={240}
                          value={m.timeLimit}
                          onChange={(e) => handleTimeLimitChange(i, Number(e.target.value))}
                          className="h-8 w-20 rounded-lg text-xs tabular-nums"
                        />
                        <span className="text-[11px] text-muted-foreground">min</span>
                      </div>
                      <div
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          m.flagged
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        <Flag className="h-2.5 w-2.5" />
                        {m.flagged ? 'Flagged' : 'Clear'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ORGANIZATIONS TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'organizations' && <OrganizationsTab />}
      </div>
    </Layout>
  );
};

export default ProfileEdit;