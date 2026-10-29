import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  ChevronRight,
  Sparkles,
  Crown,
  LogOut,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileSection } from './ProfileSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import CreateGroupModalFull from './CreateGroupModalFull';
import { cn } from '@/lib/utils';
import { QUICK_LINKS } from '@/lib/quickLinks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

interface MyGroup extends GroupRow {
  isCreator: boolean;
  isNew: boolean;
}

interface SuggestedGroup extends GroupRow {
  members: number;
}

interface GroupSidebarProps {
  group: {
    id: string;
    name: string;
    description?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
  };
  stats?: {
    members?: number;
    posts?: number;
    views?: number;
    likes?: number;
  };
  suggestedGroups?: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
    members_count?: number;
  }>;
}

// ─── Quick link config ────────────────────────────────────────────────────────

// ─── Section primitives ───────────────────────────────────────────────────────

const SideCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <Card
    className={cn(
      'relative overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm',
      className,
    )}
  >
    {children}
  </Card>
);

const SectionHeader = ({
  icon: Icon,
  title,
  action,
  accent = 'blue',
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
    <div className="flex items-center justify-between gap-2 mb-3.5">
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

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const navigate = useNavigate();
  const [savedPostsCount, setSavedPostsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [storeId, setStoreId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMyGroups();
      fetchSuggestedGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      supabase
        .from('user_stores')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .single()
        .then(({ data }) => setStoreId(data?.id || null));
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('saved_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .then(({ count }) => setSavedPostsCount(count || 0));

    supabase
      .from('user_stores')
      .select('id, is_active, user_id')
      .eq('user_id', currentUser.id)
      .eq('is_active', true as any)
      .single()
      .then(({ data }) => {
        if (data && typeof data === 'object' && 'id' in data && data.id) {
          setStoreId(String(data.id));
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', String(data.id))
            .then(({ count }) => setOrdersCount(count || 0));
        }
      });
  }, [currentUser]);

  const fetchMyGroups = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('group_memberships')
      .select(
        `
        groups (
          id,
          name,
          description,
          avatar_url,
          created_by,
          created_at
        )
      `,
      )
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error fetching my groups:', error);
      return;
    }

    // Supabase returns the joined `groups` as an array per row (sometimes)
    // — normalize by taking the first element if it's an array.
    const rows = (data ?? []) as Array<{ groups: GroupRow | GroupRow[] | null }>;
    const groupsWithRole: MyGroup[] = rows
      .map((membership) => {
        const raw = membership.groups;
        const g: GroupRow | null = Array.isArray(raw) ? raw[0] ?? null : raw;
        if (!g) return null;
        return {
          ...g,
          isCreator: g.created_by === currentUser.id,
          isNew: false,
        };
      })
      .filter((g): g is MyGroup => g !== null);

    setMyGroups(groupsWithRole);
  };

  const fetchSuggestedGroups = async () => {
    if (!currentUser) return;

    const { data: membershipData } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', currentUser.id);

    const joinedGroupIds = membershipData?.map((m) => m.group_id) || [];

    let query = supabase
      .from('groups')
      .select('id, name, description, avatar_url, created_at');

    if (joinedGroupIds.length > 0) {
      query = query.not('id', 'in', `(${joinedGroupIds.join(',')})`);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('Error fetching suggested groups:', error);
      return;
    }

    const groupsWithCounts: SuggestedGroup[] = await Promise.all(
      (data ?? []).map(async (group: any) => {
        const { count } = await supabase
          .from('group_memberships')
          .select('*', { count: 'exact' })
          .eq('group_id', group.id);
        return {
          id: String(group.id),
          name: String(group.name ?? ''),
          description: group.description ?? null,
          avatar_url: group.avatar_url ?? null,
          created_by: group.created_by ?? null,
          created_at: group.created_at ?? null,
          members: count || 0,
        };
      }),
    );

    setSuggestedGroups(groupsWithCounts);
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('group_memberships')
        .insert({ group_id: groupId, user_id: currentUser.id, role: 'member' });
      if (error) throw error;
      toast({
        title: 'Joined group successfully!',
        description: 'You are now a member of this group.',
      });
      fetchMyGroups();
      fetchSuggestedGroups();
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: 'Error joining group',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('group_memberships')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      toast({
        title: 'Left group successfully!',
        description: 'You are no longer a member of this group.',
      });
      fetchMyGroups();
      fetchSuggestedGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
      toast({
        title: 'Error leaving group',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleQuickLink = (key: string) => {
    if (key === 'store') navigate('/my-store');
    else if (key === 'orders' && storeId) navigate('/my-store?section=orders');
    else if (key === 'saved') navigate('/saved-posts');
  };

  const getQuickLinkCount = (key: string): number | null => {
    if (key === 'orders') return ordersCount;
    if (key === 'saved') return savedPostsCount;
    return null;
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

  return (
    <aside className="w-72 p-4 space-y-5">
      {/* ═══════════════════════════════════════════════════════════════
          PROFILE
         ═══════════════════════════════════════════════════════════════ */}
      <div className="w-full">
        <ProfileSection />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          QUICK LINKS
         ═══════════════════════════════════════════════════════════════ */}
      <SideCard className="p-4">
        <SectionHeader icon={Sparkles} title="Quick Links" accent="blue" />
        <div className="space-y-1.5">
          {QUICK_LINKS.map(({ key, icon: Icon, label, bg, text, ring }) => {
            const count = getQuickLinkCount(key);
            return (
              <button
                key={key}
                onClick={() => handleQuickLink(key)}
                className={cn(
                  'group flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all',
                  'hover:bg-muted/60 active:scale-[0.98]',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-110',
                      bg,
                      ring,
                    )}
                  >
                    <Icon className={cn('h-4 w-4', text)} />
                  </div>
                  <span className="text-sm font-semibold text-foreground truncate">{label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {count !== null && count > 0 && (
                    <span
                      className={cn(
                        'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1',
                        bg,
                        text,
                        ring,
                      )}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </SideCard>

      {/* ═══════════════════════════════════════════════════════════════
          MY GROUPS
         ═══════════════════════════════════════════════════════════════ */}
      <SideCard className="p-4">
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
            <p className="text-xs font-medium text-muted-foreground">No groups joined yet</p>
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
              <div
                key={group.id}
                className="group flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-muted/60"
              >
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                  <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-[11px] font-bold">
                    {getInitials(group.name)}
                  </AvatarFallback>
                </Avatar>
                <a href={`/groups/${group.id}`} className="min-w-0 flex-1">
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
                </a>
                {!group.isCreator && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLeaveGroup(group.id);
                    }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all',
                      'hover:bg-red-500/10',
                    )}
                    title="Leave group"
                    aria-label="Leave group"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {myGroups.length > 5 && (
              <button
                onClick={() => navigate('/groups')}
                className="w-full rounded-lg py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                View all {myGroups.length} groups
              </button>
            )}
          </div>
        )}
      </SideCard>

      {/* ═══════════════════════════════════════════════════════════════
          DISCOVER GROUPS
         ═══════════════════════════════════════════════════════════════ */}
      <SideCard className="p-4">
        <SectionHeader icon={Compass} title="Discover Groups" accent="emerald" />

        {suggestedGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">You've joined everything!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {suggestedGroups.slice(0, 4).map((group) => (
              <div
                key={group.id}
                className="flex items-center gap-2.5 rounded-xl p-2 transition-all hover:bg-muted/60"
              >
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                  <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-[11px] font-bold">
                    {getInitials(group.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {group.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {group.members?.toLocaleString() ?? 0}{' '}
                    {group.members === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <button
                  onClick={() => handleJoinGroup(group.id)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all',
                    'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/20',
                    'hover:shadow-md hover:shadow-emerald-500/40 hover:scale-105 active:scale-95',
                  )}
                >
                  <Plus className="h-3 w-3" />
                  Join
                </button>
              </div>
            ))}
            {suggestedGroups.length > 4 && (
              <button
                onClick={() => navigate('/groups')}
                className="w-full rounded-lg py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                Explore more groups
              </button>
            )}
          </div>
        )}
      </SideCard>

      {/* Create Group Modal */}
      <CreateGroupModalFull
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onGroupCreated={() => {
          setShowCreateModal(false);
          fetchMyGroups();
          fetchSuggestedGroups();
        }}
      />
    </aside>
  );
};

// ─── GroupSidebar (group page only) ──────────────────────────────────────────

export const GroupSidebar = ({
  group,
  stats,
  suggestedGroups = [],
}: GroupSidebarProps) => {
  return (
    <aside className="w-72 p-4 space-y-5">
      {/* Group Info Card */}
      <SideCard className="overflow-hidden">
        {/* Gradient banner */}
        <div className="relative h-20 bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500">
          <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-fuchsia-500/25 blur-2xl" />
        </div>

        <div className="px-4 pb-4 -mt-10 text-center">
          <Avatar className="mx-auto h-20 w-20 ring-4 ring-card shadow-lg">
            <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-2xl font-bold">
              {group.name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-3 text-base font-bold tracking-tight truncate">{group.name}</h2>
          {group.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {group.description}
            </p>
          )}

          {group.cover_url && (
            <img
              src={group.cover_url}
              alt="Group Cover"
              className="mt-3 w-full h-24 object-cover rounded-xl ring-1 ring-border/60"
            />
          )}

          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-blue-500/[0.06] ring-1 ring-blue-500/15 p-2.5">
              <div className="text-lg font-bold tabular-nums leading-none text-blue-600 dark:text-blue-400">
                {stats?.members?.toLocaleString() ?? 0}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Members
              </div>
            </div>
            <div className="rounded-xl bg-purple-500/[0.06] ring-1 ring-purple-500/15 p-2.5">
              <div className="text-lg font-bold tabular-nums leading-none text-purple-600 dark:text-purple-400">
                {stats?.posts?.toLocaleString() ?? 0}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Posts
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/15 p-2.5">
              <div className="text-lg font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
                {stats?.views?.toLocaleString() ?? 0}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Views
              </div>
            </div>
            <div className="rounded-xl bg-pink-500/[0.06] ring-1 ring-pink-500/15 p-2.5">
              <div className="text-lg font-bold tabular-nums leading-none text-pink-600 dark:text-pink-400">
                {stats?.likes?.toLocaleString() ?? 0}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Likes
              </div>
            </div>
          </div>
        </div>
      </SideCard>

      {/* Suggested Groups */}
      <SideCard className="p-4">
        <SectionHeader icon={Users} title="Suggested Groups" accent="purple" />

        {suggestedGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 py-6 text-center">
            <p className="text-xs text-muted-foreground">No more groups to join</p>
          </div>
        ) : (
          <div className="space-y-1">
            {suggestedGroups.map((sg) => (
              <button
                key={sg.id}
                onClick={() => (window.location.href = `/groups/${sg.id}`)}
                className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-all hover:bg-muted/60"
              >
                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                  <AvatarImage src={sg.avatar_url || '/placeholder.svg'} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white text-[11px] font-bold">
                    {sg.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {sg.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {sg.members_count?.toLocaleString() ?? 0}{' '}
                    {sg.members_count === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </SideCard>
    </aside>
  );
};