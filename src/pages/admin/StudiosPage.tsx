import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import SkeletonLine from '../../components/skeletons/SkeletonLine';
import SkeletonCard from '../../components/skeletons/SkeletonCard';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '../../integrations/supabase/client';
import apiUrl from '@/lib/api';
import EpisodeCalendar from '../../components/EpisodeCalendar';
import EpisodeDragDropList from '../../components/EpisodeDragDropList';
import { Input } from '../../components/ui/input';
import type { ProgramSchedule } from '../../components/ScheduleGridView';
import generateEpisodesForShow from '../../lib/scheduleGenerator';
import { getCategoryColor } from '../../lib/scheduleUtils';
import DailyPodcastNewsroom from '@/components/DailyPodcastNewsroom';
import { CreatorShowPublicationReview, ShowApplicationReview } from '@/components/studio/ShowApplicationReview';
import {
  Tv,
  Calendar,
  BarChart3,
  ClipboardList,
  Newspaper,
  Plus,
  Users,
  Activity,
  Radio,
  ChevronRight,
  ChevronLeft,
  Clock,
  TrendingUp,
  Building2,
  Play,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Extended ProgramSchedule (adds thumbnail + episode info) ────────────────

interface ExtendedProgramSchedule extends ProgramSchedule {
  thumbnail_url?: string | null;
  current_episode_title?: string | null;
  current_episode_description?: string | null;
  current_episode_thumbnail?: string | null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultShow = {
  title: '',
  description: '',
  video_type: 'url',
  video_url: '',
  video_file: null,
  live_url: '',
  show_type: 'show',
  category: '',
  thumbnail_type: 'url',
  thumbnail_url: '',
  thumbnail_file: null,
  duration: '',
  scheduled_time: '',
  end_time: '',
  is_live: false,
  is_active: true,
  is_ad: false,
  ad_interval_minutes: 30,
  ad_duration_seconds: 60,
  ad_start_at: null,
  ad_end_at: null,
  ad_placement: 'between_shows',
  created_by: '',
  auto_generate_days: 7,
};

const defaultEpisode = {
  title: '',
  description: '',
  video_type: 'url',
  video_url: '',
  video_file: null,
  thumbnail_type: 'url',
  thumbnail_url: '',
  thumbnail_file: null,
  duration: '',
  scheduled_time: '',
  end_time: '',
  is_active: true,
  show_id: null,
};

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabKey = 'studio' | 'creator-shows' | 'schedule' | 'ai-presenter' | 'insights' | 'applications';

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  gradient: string;
  description: string;
}[] = [
  {
    key: 'studio',
    label: 'Platform Shows',
    icon: Tv,
    gradient: 'from-purple-600 to-fuchsia-500',
    description: 'Manage NexSq-owned shows and episodes',
  },
  {
    key: 'creator-shows',
    label: 'Creators Shows',
    icon: Tv,
    gradient: 'from-emerald-600 to-teal-500',
    description: 'Browse creator-owned shows already published on NexSq TV',
  },
  {
    key: 'schedule',
    label: 'Schedule Guide',
    icon: Calendar,
    gradient: 'from-blue-600 to-cyan-500',
    description: 'View the broadcast grid and calendar',
  },
  {
    key: 'ai-presenter',
    label: 'Daily Newsroom',
    icon: Newspaper,
    gradient: 'from-emerald-600 to-teal-500',
    description: 'Produce a sourced daily podcast rundown',
  },
  {
    key: 'insights',
    label: 'Show Insights',
    icon: BarChart3,
    gradient: 'from-emerald-600 to-teal-500',
    description: 'Metrics and performance overview',
  },
  {
    key: 'applications',
    label: 'Creator Applications',
    icon: ClipboardList,
    gradient: 'from-amber-600 to-orange-500',
    description: 'Review creator applications and publication submissions',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map((s) => parseInt(s, 10) || 0);
  return h * 60 + m;
};

const formatTime12h = (time: string): string => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
};

const formatDuration = (startMin: number, endMin: number): string => {
  const mins = Math.max(0, endMin - startMin);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const getCurrentTimeHHMM = (): string => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
};

const getNowPosition = (startMin = 0, endMin = 24 * 60): number => {
  const now = timeToMinutes(getCurrentTimeHHMM());
  if (now < startMin) return 0;
  if (now > endMin) return 1;
  return (now - startMin) / (endMin - startMin);
};

// ─── Header stat ──────────────────────────────────────────────────────────────

const HeaderStat = ({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tone: 'purple' | 'emerald' | 'amber' | 'blue';
}) => {
  const tones = {
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
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
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
};

// ─── TV Schedule Guide ────────────────────────────────────────────────────────

const TVScheduleGuide = ({
  programs,
  selectedDate,
  onDateChange,
  nowPlaying,
  onWatch,
  onProgramClick,
}: {
  programs: ExtendedProgramSchedule[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  nowPlaying: ExtendedProgramSchedule | null;
  onWatch: (p: ExtendedProgramSchedule) => void;
  onProgramClick: (p: ExtendedProgramSchedule) => void;
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [now, setNow] = useState(getCurrentTimeHHMM());

  useEffect(() => {
    const t = setInterval(() => setNow(getCurrentTimeHHMM()), 30_000);
    return () => clearInterval(t);
  }, []);

  const categories: string[] = [
    'all',
    ...new Set(
      programs
        .map((program) => program.category)
        .filter((category): category is string => typeof category === 'string' && category.length > 0),
    ),
  ];
  const filteredPrograms = programs.filter(
    (p) => filterCategory === 'all' || p.category === filterCategory,
  );

  const sorted = [...filteredPrograms].sort(
    (a, b) => timeToMinutes(a.time_slot_start) - timeToMinutes(b.time_slot_start),
  );

  const dayparts = [
    { key: 'morning', label: 'Morning', range: '06:00 – 12:00', startMin: 6 * 60, endMin: 12 * 60, icon: '🌅' },
    { key: 'afternoon', label: 'Afternoon', range: '12:00 – 18:00', startMin: 12 * 60, endMin: 18 * 60, icon: '☀️' },
    { key: 'evening', label: 'Evening', range: '18:00 – 00:00', startMin: 18 * 60, endMin: 24 * 60, icon: '🌆' },
    { key: 'overnight', label: 'Overnight', range: '00:00 – 06:00', startMin: 0, endMin: 6 * 60, icon: '🌙' },
  ];

  const getNextProgram = (idx: number): ExtendedProgramSchedule | null => {
    return sorted[idx + 1] || null;
  };

  const nowPlayingIdx = nowPlaying
    ? sorted.findIndex((p) => p.id === nowPlaying.id)
    : -1;
  const upNext = nowPlayingIdx >= 0 ? sorted[nowPlayingIdx + 1] : sorted[0] || null;

  const nowMinutes = timeToMinutes(now);

  const isNow = (p: ExtendedProgramSchedule): boolean => {
    const start = timeToMinutes(p.time_slot_start);
    const end = timeToMinutes(p.time_slot_end);
    return nowMinutes >= start && nowMinutes < end;
  };

  const isPast = (p: ExtendedProgramSchedule): boolean => {
    const end = timeToMinutes(p.time_slot_end);
    return nowMinutes >= end;
  };

  const isUpcoming = (p: ExtendedProgramSchedule): boolean => {
    const start = timeToMinutes(p.time_slot_start);
    return nowMinutes < start;
  };

  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  const isTomorrow =
    selectedDate.toDateString() ===
    new Date(today.getTime() + 86400000).toDateString();
  const isYesterday =
    selectedDate.toDateString() ===
    new Date(today.getTime() - 86400000).toDateString();

  const dateLabel = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : isYesterday
        ? 'Yesterday'
        : selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    onDateChange(d);
  };

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════════
          LIVE NOW — Hero banner with current episode
         ═══════════════════════════════════════════════════════════════ */}
      {nowPlaying && (
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.08] via-fuchsia-500/[0.05] to-purple-500/[0.08]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />

          <div className="relative p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row gap-5">
              {/* Thumbnail / Episode preview */}
              <div className="relative aspect-video w-full lg:w-56 shrink-0 overflow-hidden rounded-2xl bg-black shadow-lg">
                {nowPlaying.current_episode_thumbnail || nowPlaying.thumbnail_url ? (
                  <img
                    src={nowPlaying.current_episode_thumbnail || nowPlaying.thumbnail_url || ''}
                    alt={nowPlaying.current_episode_title || nowPlaying.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-fuchsia-500">
                    <Tv className="h-10 w-10 text-white/70" />
                  </div>
                )}
                {/* Live pill */}
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/40">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    LIVE NOW
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Radio className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
                    On Air
                  </span>
                  {nowPlaying.category && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: nowPlaying.color_code || '#7c3aed' }}
                    >
                      {nowPlaying.category}
                    </span>
                  )}
                </div>

                {nowPlaying.current_episode_title ? (
                  <>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                      {nowPlaying.current_episode_title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      from <span className="text-foreground/80">{nowPlaying.title}</span>
                    </p>
                  </>
                ) : (
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                    {nowPlaying.title}
                  </h2>
                )}

                {(nowPlaying.current_episode_description || nowPlaying.description) && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {nowPlaying.current_episode_description || nowPlaying.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-[11px] font-semibold tabular-nums ring-1 ring-border/60">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {formatTime12h(nowPlaying.time_slot_start)} – {formatTime12h(nowPlaying.time_slot_end)}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    {formatDuration(
                      timeToMinutes(nowPlaying.time_slot_start),
                      timeToMinutes(nowPlaying.time_slot_end),
                    )}{' '}
                    long
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => onWatch(nowPlaying)}
                    className="h-10 gap-2 rounded-xl bg-gradient-to-br from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 shadow-md shadow-red-500/25 font-semibold"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    Watch Live
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onProgramClick(nowPlaying)}
                    className="h-10 gap-2 rounded-xl"
                  >
                    View Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Up Next */}
              {upNext && (
                <div className="lg:w-56 shrink-0 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3.5">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <ChevronRight className="h-3 w-3 text-purple-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Up Next
                    </span>
                  </div>
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted/60 mb-2">
                    {upNext.current_episode_thumbnail || upNext.thumbnail_url ? (
                      <img
                        src={upNext.current_episode_thumbnail || upNext.thumbnail_url || ''}
                        alt={upNext.current_episode_title || upNext.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Tv className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold leading-tight line-clamp-2">
                    {upNext.current_episode_title || upNext.title}
                  </p>
                  {upNext.current_episode_title && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                      from {upNext.title}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {formatTime12h(upNext.time_slot_start)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TIMELINE + DAYPART BREAKDOWN
         ═══════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
        {/* Date navigator */}
        <div className="border-b border-border/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftDate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-[140px] text-center">
                <div className="text-sm font-bold tracking-tight">{dateLabel}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <button
                onClick={() => shiftDate(1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {!isToday && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDateChange(new Date())}
                className="h-9 gap-1.5 rounded-full text-xs"
              >
                <CircleDot className="h-3 w-3" />
                Jump to Today
              </Button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-none">
              <div className="flex gap-1.5 min-w-max">
                {categories.map((cat) => {
                  const isActive = filterCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        if (cat) setFilterCategory(cat);
                      }}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all',
                        isActive
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="relative px-4 py-5">
          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-blue-500/20">
                <Tv className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-semibold">No programs scheduled</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isToday ? 'Nothing airing today' : 'Nothing scheduled for this date'}
              </p>
            </div>
          ) : (
            <>
              {/* Hour markers */}
              <div className="relative h-6 mb-2">
                {[0, 6, 12, 18, 24].map((hour) => {
                  const position = (hour / 24) * 100;
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 text-[10px] font-bold tabular-nums text-muted-foreground"
                      style={{ left: `calc(${position}% - 8px)` }}
                    >
                      {hour.toString().padStart(2, '0')}
                    </div>
                  );
                })}
              </div>

              {/* Timeline bar */}
              <div className="relative h-14 rounded-2xl bg-muted/40 ring-1 ring-border/40 overflow-hidden">
                {[6, 12, 18].map((hour) => {
                  const position = (hour / 24) * 100;
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 w-px bg-border/60"
                      style={{ left: `${position}%` }}
                    />
                  );
                })}

                {isToday && (
                  <div
                    className="absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
                    style={{ left: `${getNowPosition() * 100}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-red-500 shadow-md shadow-red-500/50" />
                  </div>
                )}

                {sorted.map((p) => {
                  const startMin = timeToMinutes(p.time_slot_start);
                  const endMin = timeToMinutes(p.time_slot_end);
                  const left = (startMin / (24 * 60)) * 100;
                  const width = Math.max(0.8, ((endMin - startMin) / (24 * 60)) * 100);
                  const currently = isNow(p);
                  const past = isPast(p);

                  return (
                    <button
                      key={`block-${p.id}`}
                      onClick={() => onProgramClick(p)}
                      title={`${p.current_episode_title || p.title} · ${formatTime12h(p.time_slot_start)} – ${formatTime12h(p.time_slot_end)}`}
                      className={cn(
                        'absolute top-1 bottom-1 rounded-lg overflow-hidden transition-all group cursor-pointer',
                        'hover:scale-y-110 hover:z-10 hover:shadow-lg',
                        past && !currently && 'opacity-40 hover:opacity-100',
                        currently && 'ring-2 ring-white/60 shadow-lg z-10',
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: p.color_code || '#7c3aed',
                      }}
                    >
                      <div className="absolute inset-0 flex items-center px-1.5">
                        <span className="truncate text-[10px] font-bold text-white drop-shadow-md">
                          {p.current_episode_title || p.title}
                        </span>
                      </div>
                      {currently && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Daypart breakdown */}
              <div className="mt-5 space-y-4">
                {dayparts.map((part) => {
                  const partPrograms = sorted.filter((p) => {
                    const start = timeToMinutes(p.time_slot_start);
                    return start >= part.startMin && start < part.endMin;
                  });
                  if (partPrograms.length === 0) return null;

                  return (
                    <div key={part.key}>
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="text-base">{part.icon}</span>
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                          {part.label}
                        </h4>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                          {part.range}
                        </span>
                        <div className="h-px flex-1 bg-border/60" />
                        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {partPrograms.length}{' '}
                          {partPrograms.length === 1 ? 'program' : 'programs'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {partPrograms.map((p, idx) => {
                          const next = getNextProgram(sorted.indexOf(p));
                          const currently = isNow(p);
                          const past = isPast(p);
                          const upcoming = isUpcoming(p);

                          return (
                            <div key={p.id} className="relative">
                              <button
                                onClick={() => onProgramClick(p)}
                                className={cn(
                                  'group w-full rounded-2xl border p-3 text-left transition-all',
                                  currently
                                    ? 'border-red-500/40 bg-gradient-to-br from-red-500/[0.06] to-fuchsia-500/[0.03] shadow-md'
                                    : past
                                      ? 'border-border/40 bg-muted/20 opacity-60 hover:opacity-100'
                                      : 'border-border/60 bg-card hover:border-blue-500/40 hover:bg-blue-500/[0.03] hover:shadow-sm',
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Time column */}
                                  <div className="w-16 shrink-0 text-left">
                                    <div
                                      className={cn(
                                        'text-sm font-bold tabular-nums leading-tight',
                                        currently
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-foreground',
                                      )}
                                    >
                                      {formatTime12h(p.time_slot_start).replace(/\s(AM|PM)/, '')}
                                    </div>
                                    <div className="text-[10px] font-medium uppercase text-muted-foreground">
                                      {p.time_slot_start < '12:00' ? 'AM' : 'PM'}
                                    </div>
                                    <div className="mt-1 text-[10px] text-muted-foreground/70 tabular-nums">
                                      {formatDuration(
                                        timeToMinutes(p.time_slot_start),
                                        timeToMinutes(p.time_slot_end),
                                      )}
                                    </div>
                                  </div>

                                  {/* Thumbnail — episode-aware */}
                                  <div className="relative aspect-video w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-muted/60">
                                    {p.current_episode_thumbnail || p.thumbnail_url ? (
                                      <img
                                        src={p.current_episode_thumbnail || p.thumbnail_url || ''}
                                        alt={p.current_episode_title || p.title}
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                      />
                                    ) : (
                                      <div
                                        className="flex h-full w-full items-center justify-center"
                                        style={{
                                          background: `linear-gradient(135deg, ${p.color_code || '#7c3aed'}80, ${p.color_code || '#7c3aed'}40)`,
                                        }}
                                      >
                                        <Tv className="h-5 w-5 text-white/70" />
                                      </div>
                                    )}
                                    {currently && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <Play className="h-5 w-5 fill-white text-white" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Content */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                      {currently && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">
                                          <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
                                          LIVE
                                        </span>
                                      )}
                                      {past && !currently && (
                                        <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                          Aired
                                        </span>
                                      )}
                                      {upcoming && isToday && (
                                        <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                          Upcoming
                                        </span>
                                      )}
                                      {p.category && (
                                        <span
                                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                                          style={{ backgroundColor: p.color_code || '#7c3aed' }}
                                        >
                                          {p.category}
                                        </span>
                                      )}
                                    </div>

                                    {p.current_episode_title ? (
                                      <>
                                        <h5 className="text-sm font-bold tracking-tight line-clamp-1">
                                          {p.current_episode_title}
                                        </h5>
                                        <p className="text-[10px] font-semibold text-muted-foreground line-clamp-1">
                                          from{' '}
                                          <span className="text-foreground/70">{p.title}</span>
                                        </p>
                                      </>
                                    ) : (
                                      <h5 className="text-sm font-bold tracking-tight line-clamp-1">
                                        {p.title}
                                      </h5>
                                    )}

                                    {(p.current_episode_description || p.description) && (
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-1">
                                        {p.current_episode_description || p.description}
                                      </p>
                                    )}
                                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                                      <Clock className="h-3 w-3" />
                                      {formatTime12h(p.time_slot_start)} –{' '}
                                      {formatTime12h(p.time_slot_end)}
                                    </div>
                                  </div>

                                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                                </div>
                              </button>

                              {next && idx < partPrograms.length - 1 && (
                                <div className="my-1.5 ml-8 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                                  <div className="h-3 w-px bg-border" />
                                  <span>then</span>
                                  <span className="font-semibold text-muted-foreground/80">
                                    {next.current_episode_title || next.title}
                                  </span>
                                  {next.current_episode_title && (
                                    <span className="text-muted-foreground/60">
                                      · {next.title}
                                    </span>
                                  )}
                                  <span className="tabular-nums">
                                    at {formatTime12h(next.time_slot_start)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

const TVGridGuide = ({
  programs,
  selectedDate,
  onProgramClick,
}: {
  programs: ExtendedProgramSchedule[];
  selectedDate: Date;
  onProgramClick: (program: ExtendedProgramSchedule) => void;
}) => {
  const [now, setNow] = useState(getCurrentTimeHHMM());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(getCurrentTimeHHMM()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = [...programs].sort(
    (first, second) => timeToMinutes(first.time_slot_start) - timeToMinutes(second.time_slot_start),
  );
  const today = new Date();
  const viewingToday = selectedDate.toDateString() === today.toDateString();
  const nowMinutes = timeToMinutes(now);
  const isCurrentlyPlaying = (program: ExtendedProgramSchedule) => {
    const start = timeToMinutes(program.time_slot_start);
    let end = timeToMinutes(program.time_slot_end);
    if (end <= start) end += 24 * 60;
    return viewingToday && nowMinutes >= start && nowMinutes < end;
  };
  const hasAired = (program: ExtendedProgramSchedule) => {
    const selectedDay = new Date(selectedDate);
    const currentDay = new Date(today);
    selectedDay.setHours(0, 0, 0, 0);
    currentDay.setHours(0, 0, 0, 0);
    if (selectedDay < currentDay) return true;
    if (!viewingToday) return false;
    let end = timeToMinutes(program.time_slot_end);
    if (end <= timeToMinutes(program.time_slot_start)) end += 24 * 60;
    return nowMinutes >= end;
  };

  if (sorted.length === 0) {
    return (
      <Card className="rounded-3xl border-border/60 bg-card p-12 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-blue-500/20">
          <Tv className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm font-semibold">No programs scheduled</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((program) => {
        const currentlyPlaying = isCurrentlyPlaying(program);
        const past = hasAired(program);
        const episodeTitle = program.current_episode_title || program.title;
        const thumbnail = program.current_episode_thumbnail || program.thumbnail_url;
        const color = program.color_code || '#7c3aed';

        return (
          <button
            key={program.id}
            type="button"
            onClick={() => onProgramClick(program)}
            className={cn(
              'group relative overflow-hidden rounded-2xl border bg-card text-left transition-all',
              currentlyPlaying
                ? 'border-red-500/40 ring-2 ring-red-500/20 shadow-lg shadow-red-500/10'
                : past
                  ? 'border-border/40 opacity-60 hover:opacity-100'
                  : 'border-border/60 hover:border-blue-500/40 hover:shadow-md',
            )}
          >
            <div className="relative aspect-video overflow-hidden bg-muted/60">
              {thumbnail ? (
                <img src={thumbnail} alt={episodeTitle} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}66)` }}>
                  <Tv className="h-10 w-10 text-white/70" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {currentlyPlaying && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                  LIVE
                </span>
              )}
              {past && !currentlyPlaying && <span className="absolute left-3 top-3 rounded-full bg-slate-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Aired</span>}
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white ring-1 ring-white/20">
                <Clock className="h-2.5 w-2.5" />{formatTime12h(program.time_slot_start)}
              </span>
              {currentlyPlaying && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/40 transition-transform group-hover:scale-110"><Play className="h-5 w-5 fill-white text-white" /></span></span>}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75 line-clamp-1">{program.category || 'Program'}</p>
                <h3 className="mt-0.5 text-sm font-bold leading-tight text-white line-clamp-2">{episodeTitle}</h3>
              </div>
            </div>
            <div className="p-3.5">
              {program.current_episode_title && <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground line-clamp-1">from <span className="text-foreground/80">{program.title}</span></p>}
              <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">{formatTime12h(program.time_slot_start)} – {formatTime12h(program.time_slot_end)}</span>
                <span>·</span>
                <span className="shrink-0">{formatDuration(timeToMinutes(program.time_slot_start), timeToMinutes(program.time_slot_end))}</span>
              </div>
              {(program.current_episode_description || program.description) && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{program.current_episode_description || program.description}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
};

const TVCalendarGuide = ({
  programs,
  selectedDate,
  onDateChange,
  onProgramClick,
}: {
  programs: ExtendedProgramSchedule[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onProgramClick: (program: ExtendedProgramSchedule) => void;
}) => {
  const [now, setNow] = useState(getCurrentTimeHHMM());
  const hourHeight = 80;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(getCurrentTimeHHMM()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = [...programs].sort(
    (first, second) => timeToMinutes(first.time_slot_start) - timeToMinutes(second.time_slot_start),
  );
  const today = new Date();
  const viewingToday = selectedDate.toDateString() === today.toDateString();
  const isTomorrow = selectedDate.toDateString() === new Date(today.getTime() + 86_400_000).toDateString();
  const isYesterday = selectedDate.toDateString() === new Date(today.getTime() - 86_400_000).toDateString();
  const dateLabel = viewingToday ? 'Today' : isTomorrow ? 'Tomorrow' : isYesterday ? 'Yesterday' : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const shiftDate = (days: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    onDateChange(nextDate);
  };

  if (sorted.length === 0) {
    return (
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftDate(-1)} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-[140px] text-center"><div className="text-sm font-bold">{dateLabel}</div><div className="text-[10px] text-muted-foreground">{selectedDate.toLocaleDateString()}</div></div>
            <button type="button" onClick={() => shiftDate(1)} aria-label="Next day" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {!viewingToday && <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())} className="h-9 gap-1.5 rounded-full text-xs"><CircleDot className="h-3 w-3" />Today</Button>}
        </div>
        <div className="p-12 text-center"><Tv className="mx-auto mb-3 h-6 w-6 text-blue-600" /><p className="text-sm font-semibold">No programs scheduled</p><p className="mt-1 text-xs text-muted-foreground">Nothing scheduled for this date</p></div>
      </Card>
    );
  }

  const nowMinutes = timeToMinutes(now);
  const earliest = sorted.reduce((minimum, program) => Math.min(minimum, timeToMinutes(program.time_slot_start)), viewingToday ? nowMinutes : 8 * 60);
  const latest = sorted.reduce((maximum, program) => {
    let end = timeToMinutes(program.time_slot_end);
    if (end <= timeToMinutes(program.time_slot_start)) end += 24 * 60;
    return Math.max(maximum, end);
  }, viewingToday ? nowMinutes + 120 : 22 * 60);
  const startHour = Math.max(0, Math.floor(earliest / 60) - 1);
  const endHour = Math.min(24, Math.ceil(latest / 60) + 1);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const nowTop = viewingToday ? ((nowMinutes - startHour * 60) / 60) * hourHeight : null;

  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftDate(-1)} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <div className="min-w-[140px] text-center"><div className="text-sm font-bold">{dateLabel}</div><div className="text-[10px] text-muted-foreground">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
          <button type="button" onClick={() => shiftDate(1)} aria-label="Next day" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {!viewingToday && <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())} className="h-9 gap-1.5 rounded-full text-xs"><CircleDot className="h-3 w-3" />Today</Button>}
      </div>
      <div className="relative flex overflow-x-auto">
        <div className="w-16 shrink-0 border-r border-border/60 pt-4">
          {hours.map((hour) => <div key={hour} className="flex justify-end pr-2 text-[10px] font-bold tabular-nums text-muted-foreground" style={{ height: hourHeight }}><span className="-mt-1.5">{hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}</span></div>)}
        </div>
        <div className="relative min-w-[320px] flex-1">
          {hours.map((hour, index) => <div key={hour} className="pointer-events-none absolute left-0 right-0 border-t border-border/40" style={{ top: 16 + index * hourHeight }} />)}
          {viewingToday && nowTop !== null && <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: 16 + nowTop }}><span className="-ml-1.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" /><span className="h-0.5 flex-1 bg-red-500" /><span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">NOW</span></div>}
          <div className="relative" style={{ height: hours.length * hourHeight + 32 }}>
            {sorted.map((program) => {
              const start = timeToMinutes(program.time_slot_start);
              let end = timeToMinutes(program.time_slot_end);
              if (end <= start) end += 24 * 60;
              const top = 16 + ((start - startHour * 60) / 60) * hourHeight;
              const height = Math.max(56, ((end - start) / 60) * hourHeight);
              const currentlyPlaying = viewingToday && nowMinutes >= start && nowMinutes < end;
              const past = !currentlyPlaying && (selectedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) || (viewingToday && nowMinutes >= end));
              const thumbnail = program.current_episode_thumbnail || program.thumbnail_url;
              const episodeTitle = program.current_episode_title || program.title;
              return (
                <button key={program.id} type="button" onClick={() => onProgramClick(program)} className={cn('group absolute left-2 right-3 overflow-hidden rounded-2xl border bg-card text-left transition-all', currentlyPlaying ? 'z-10 border-red-500/40 ring-2 ring-red-500/20 shadow-lg shadow-red-500/10' : past ? 'border-border/40 opacity-60 hover:opacity-100' : 'border-border/60 hover:border-blue-500/40 hover:shadow-md')} style={{ top, height }}>
                  <div className="flex h-full">
                    <div className="relative w-24 shrink-0 overflow-hidden bg-muted/60 sm:w-36">
                      {thumbnail ? <img src={thumbnail} alt={episodeTitle} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${(program.color_code || '#7c3aed')}cc, ${(program.color_code || '#7c3aed')}66)` }}><Tv className="h-7 w-7 text-white/70" /></div>}
                      {currentlyPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40"><Play className="h-4 w-4 fill-white text-white" /></span></div>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {currentlyPlaying && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">LIVE</span>}
                        {past && <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[9px] font-bold text-slate-600">Aired</span>}
                        {program.category && <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-white" style={{ backgroundColor: program.color_code || '#7c3aed' }}>{program.category}</span>}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-bold leading-tight">{episodeTitle}</h3>
                      {program.current_episode_title && <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-muted-foreground">from <span className="text-foreground/70">{program.title}</span></p>}
                      {(program.current_episode_description || program.description) && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{program.current_episode_description || program.description}</p>}
                      <div className="mt-auto flex items-center gap-1.5 truncate pt-1.5 text-[10px] tabular-nums text-muted-foreground"><Clock className="h-3 w-3 shrink-0" />{formatTime12h(program.time_slot_start)} – {formatTime12h(program.time_slot_end)}<span>·</span>{formatDuration(start, end)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const StudiosPage = () => {
  const [shows, setShows] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShow, setEditingShow] = useState<any | null>(null);
  const [form, setForm] = useState<any>(defaultShow);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [userPrivilege, setUserPrivilege] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [episodes, setEpisodes] = useState<any[]>([]);
  const [calendarEpisodes, setCalendarEpisodes] = useState<any[]>([]);
  const [editingEpisode, setEditingEpisode] = useState<any | null>(null);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<any[]>([]);
  const [currentEpisodeShowId, setCurrentEpisodeShowId] = useState<string | number | null>(null);
  const [currentEpisodeShowTitle, setCurrentEpisodeShowTitle] = useState('');
  const [currentEpisodeShowSchedule, setCurrentEpisodeShowSchedule] = useState('');
  const [newEpisodeForm, setNewEpisodeForm] = useState<any>(defaultEpisode);
  const [showEpisodePage, setShowEpisodePage] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [showStep, setShowStep] = useState(12);
  const [showModalStep, setShowModalStep] = useState(1);
  const [stagedEpisodes, setStagedEpisodes] = useState<any[]>([]);
  const [stagedEpisodeForm, setStagedEpisodeForm] = useState<any>(defaultEpisode);
  const [stagedEpisodeIdx, setStagedEpisodeIdx] = useState<number | null>(null);

  const [currentSchedule, setCurrentSchedule] = useState<ExtendedProgramSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'guide' | 'grid' | 'calendar'>('guide');
  const [nowPlaying, setNowPlaying] = useState<ExtendedProgramSchedule | null>(null);
  const [podcastSessionId, setPodcastSessionId] = useState<string | null>(null);
  const podcastWindowRef = useRef<Window | null>(null);

  const activeTab: TabKey =
    showStep === 12
      ? 'studio'
      : showStep === 13
        ? 'schedule'
        : showStep === 14
          ? 'insights'
          : showStep === 15
            ? 'applications'
            : showStep === 17
              ? 'creator-shows'
              : 'ai-presenter';

  const handleTabChange = (key: TabKey) => {
    const map: Record<TabKey, number> = {
      studio: 12,
      schedule: 13,
      insights: 14,
      applications: 15,
      'ai-presenter': 16,
      'creator-shows': 17,
    };
    setShowStep(map[key]);
  };

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          setIsAuthenticated(false);
          return;
        }
        setUserId(user.id);
        setIsAuthenticated(true);

        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('id, privilege')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching user:', fetchError);
          return;
        }
        if (!existingUser) {
          setUserPrivilege(null);
          toast({
            title: 'Studio admin profile missing',
            description: 'Your account does not have an assigned Studio role. Contact an administrator.',
            variant: 'destructive',
          });
          return;
        }
        setUserPrivilege(existingUser.privilege);
      } catch (error) {
        console.error('Error initializing user:', error);
        toast({
          title: 'Error',
          description: 'Failed to initialize user session.',
          variant: 'destructive',
        });
      }
    };
    initializeUser();
  }, [toast]);

  const fetchShows = async () => {
    if (!isAuthenticated) return;
    const { data, error } = await supabase
      .from('studio_shows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch shows', variant: 'destructive' });
      return;
    }
    setShows((data || []).filter((show: any) => show.show_source !== 'creator'));
  };

  const fetchEpisodes = async (showId: string | number) => {
    setLoadingEpisodes(true);
    try {
      const { data, error } = await supabase
        .from('studio_episodes')
        .select('*')
        .eq('show_id', showId)
        .order('scheduled_time', { ascending: true });
      if (error) {
        toast({ title: 'Error', description: 'Failed to fetch episodes', variant: 'destructive' });
        return;
      }
      setEpisodes(data || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch episodes', variant: 'destructive' });
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const fetchEpisodeShowTitle = async (showId: string | number) => {
    setCurrentEpisodeShowTitle('');
    setCurrentEpisodeShowSchedule('');
    const { data, error } = await supabase
      .from('studio_shows')
      .select('title, approved_days, time_slot_start, time_slot_end')
      .eq('id', showId)
      .maybeSingle();
    if (error) {
      console.error('Could not load episode show name:', error);
      return;
    }
    setCurrentEpisodeShowTitle(data?.title || '');
    if (data?.time_slot_start && data?.time_slot_end) {
      const days = Array.isArray(data.approved_days) ? data.approved_days : [];
      const slot = `${String(data.time_slot_start).slice(0, 5)}–${String(data.time_slot_end).slice(0, 5)}`;
      setCurrentEpisodeShowSchedule(days.length ? `${days.join(', ')} · ${slot}` : slot);
    }
  };

  const fetchCalendarEpisodes = async () => {
    try {
      const { data } = await supabase
        .from('studio_episodes')
        .select('*')
        .order('scheduled_time', { ascending: true })
        .limit(100);
      setCalendarEpisodes(data || []);
    } catch (e) {
      console.error('Failed to fetch calendar episodes', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userPrivilege) fetchShows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userPrivilege]);

  const parseDays = (val: any): string[] | undefined => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.map((d: string) => d.toLowerCase());
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((d: string) => d.toLowerCase());
    } catch (e) {}
    if (typeof val === 'string') return val.split(',').map((s) => s.trim().toLowerCase());
    return undefined;
  };

  const toHHMM = (dateStr?: string) => {
    if (!dateStr) return '00:00';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime()))
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {}
    if (dateStr.indexOf('T') === -1 && dateStr.indexOf(':') !== -1) return dateStr.substring(0, 5);
    return '00:00';
  };

  // ── Enhanced schedule generation: attaches the current episode to each slot ─
  const generateSchedule = async (date: Date) => {
    if (!isAuthenticated) return;
    try {
      const { data: showsData } = await supabase
        .from('studio_shows')
        .select('*')
        .eq('is_active', true);

      // Fetch the day's episodes so we can attach the currently-airing one
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: episodesData } = await supabase
        .from('studio_episodes')
        .select('id, show_id, title, description, thumbnail_url, scheduled_time, end_time')
        .gte('scheduled_time', dayStart.toISOString())
        .lte('scheduled_time', dayEnd.toISOString())
        .order('scheduled_time', { ascending: true });

      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const schedule: ExtendedProgramSchedule[] = [];

      (showsData || []).forEach((show: any) => {
        const days = parseDays(show.days_of_week) || [];
        const pattern = (show.schedule_pattern || '').toLowerCase();
        const start = show.time_slot_start ? show.time_slot_start : toHHMM(show.scheduled_time);
        const end = show.time_slot_end ? show.time_slot_end : toHHMM(show.end_time);

        const airsToday =
          pattern === 'daily' ||
          days.includes(dayName) ||
          (!pattern &&
            !show.days_of_week &&
            show.scheduled_time &&
            new Date(show.scheduled_time).toDateString() === date.toDateString());

        if (airsToday) {
          const showEpisodes = (episodesData || []).filter(
            (ep: any) => String(ep.show_id) === String(show.id),
          );
          const currentEpisode =
            showEpisodes.find((ep: any) => {
              if (!ep.scheduled_time) return false;
              const epStart = new Date(ep.scheduled_time);
              const epStartMin = epStart.getHours() * 60 + epStart.getMinutes();
              const slotStartMin = timeToMinutes(start);
              const slotEndMin = timeToMinutes(end);
              return epStartMin >= slotStartMin && epStartMin < slotEndMin;
            }) ||
            showEpisodes[0] ||
            null;

          schedule.push({
            id: show.id,
            title: show.title,
            description: show.description,
            category: show.category,
            time_slot_start: start,
            time_slot_end: end,
            days_of_week: days,
            is_live: !!show.is_live,
            is_rerun: !!show.is_rerun,
            color_code: getCategoryColor(show.category),
            show_id: show.id,
            thumbnail_url: show.thumbnail_url || null,
            current_episode_title: currentEpisode?.title || null,
            current_episode_description: currentEpisode?.description || null,
            current_episode_thumbnail: currentEpisode?.thumbnail_url || null,
          });
        }
      });

      schedule.sort((a, b) => a.time_slot_start.localeCompare(b.time_slot_start));
      setCurrentSchedule(schedule);
    } catch (err) {
      console.error('Error generating schedule', err);
    }
  };

  const updateNowPlaying = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const playing =
      currentSchedule.find((p) => p.time_slot_start <= currentTime && p.time_slot_end > currentTime) ||
      null;
    setNowPlaying(playing);
  };

  const handleLoadPodcastDraft = (title: string, videoUrl: string) => {
    setForm((current: any) => ({
      ...defaultShow,
      ...current,
      title: title || current.title || defaultShow.title,
      description: '',
      video_type: 'url',
      video_file: null,
      video_url: videoUrl,
      category: current.category || 'News',
      show_type: current.show_type || defaultShow.show_type,
    }));
    setShowModalStep(1);
    setShowModal(true);
    toast({ title: 'Recording ready', description: 'The Supabase video URL is filled into the show draft.' });
  };

  const handleStartPodcastRecording = (title: string, script: string) => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(`podcast-recording:${sessionId}`, JSON.stringify({ title, script }));
    const width = window.screen.availWidth || 1440;
    const height = window.screen.availHeight || 900;
    const recordingWindow = window.open(
      `/podcast-teleprompter/${sessionId}`,
      'NexSqPodcastRecording',
      `popup=yes,width=${width},height=${height},left=0,top=0`,
    );
    if (!recordingWindow) {
      localStorage.removeItem(`podcast-recording:${sessionId}`);
      toast({
        title: 'Popup blocked',
        description: 'Allow popups for this site, then open the teleprompter again.',
        variant: 'destructive',
      });
      return;
    }
    podcastWindowRef.current = recordingWindow;
    setPodcastSessionId(sessionId);
  };

  useEffect(() => {
    const handleRecordingSaved = async (event: MessageEvent) => {
      const message = event.data;
      if (
        event.origin !== window.location.origin ||
        event.source !== podcastWindowRef.current ||
        message?.type !== 'NEXSQ_PODCAST_RECORDING_SAVED' ||
        message.sessionId !== podcastSessionId ||
        !(message.recording instanceof Blob)
      ) return;

      const recording = new File(
        [message.recording],
        message.fileName || `podcast-recording-${Date.now()}.webm`,
        { type: message.recording.type || 'video/webm' },
      );
      podcastWindowRef.current = null;
      setPodcastSessionId(null);
      toast({ title: 'Uploading recording', description: 'Saving the recorded video to Supabase Storage.' });
      try {
        const videoUrl = await uploadToStorage(recording, 'podcast-recordings');
        handleLoadPodcastDraft(message.title || 'Daily Podcast', videoUrl);
      } catch (uploadError) {
        console.error('Podcast recording upload failed:', uploadError);
        toast({
          title: 'Recording upload failed',
          description: uploadError instanceof Error ? uploadError.message : 'Could not save the video to Supabase Storage.',
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('message', handleRecordingSaved);
    return () => window.removeEventListener('message', handleRecordingSaved);
  }, [podcastSessionId, handleLoadPodcastDraft, toast]);

  useEffect(() => {
    generateSchedule(selectedDate);
    const interval = setInterval(updateNowPlaying, 60_000);
    updateNowPlaying();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isAuthenticated]);

  useEffect(() => {
    if (viewMode === 'calendar') fetchCalendarEpisodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleOpenModal = (show?: any) => {
    if (show) {
      setEditingShow(show);
      setForm(show);
      supabase
        .from('studio_episodes')
        .select('*')
        .eq('show_id', show.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setStagedEpisodes(data || []));
    } else {
      setEditingShow(null);
      setForm(defaultShow);
      setStagedEpisodes([]);
    }
    setShowModalStep(1);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingShow(null);
    setForm(defaultShow);
    setStagedEpisodes([]);
    setShowModalStep(1);
  };

  const handleStagedEpisodeFormChange = (e: any) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') setStagedEpisodeForm((f: any) => ({ ...f, [name]: checked }));
    else if (type === 'file') setStagedEpisodeForm((f: any) => ({ ...f, [name]: files[0] }));
    else setStagedEpisodeForm((f: any) => ({ ...f, [name]: value }));
  };

  const handleAddOrUpdateStagedEpisode = () => {
    if (stagedEpisodeIdx !== null) {
      setStagedEpisodes((eps) =>
        eps.map((ep, i) => (i === stagedEpisodeIdx ? { ...stagedEpisodeForm } : ep)),
      );
    } else {
      setStagedEpisodes((eps) => [...eps, { ...stagedEpisodeForm }]);
    }
    setStagedEpisodeForm(defaultEpisode);
    setStagedEpisodeIdx(null);
  };

  const handleEditStagedEpisode = (idx: number) => {
    setStagedEpisodeForm(stagedEpisodes[idx]);
    setStagedEpisodeIdx(idx);
  };

  const handleDeleteStagedEpisode = (idx: number) => {
    setStagedEpisodes((eps) => eps.filter((_, i) => i !== idx));
    if (stagedEpisodeIdx === idx) {
      setStagedEpisodeForm(defaultEpisode);
      setStagedEpisodeIdx(null);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!userId || !userPrivilege) {
      toast({
        title: 'Error',
        description: 'User not properly authenticated. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }
    if (!['admin', 'superadmin'].includes(userPrivilege)) {
      toast({
        title: 'Error',
        description: 'You do not have permission to create or edit shows.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      let video_url = form.video_url;
      let thumbnail_url = form.thumbnail_url;
      if (form.video_type === 'upload' && form.video_file)
        video_url = await uploadToStorage(form.video_file, 'videos');
      if (form.thumbnail_type === 'upload' && form.thumbnail_file)
        thumbnail_url = await uploadToStorage(form.thumbnail_file, 'thumbnails');

      const showData = {
        title: form.title,
        description: form.description,
        video_url,
        thumbnail_url,
        duration: form.duration,
        scheduled_time: form.scheduled_time || null,
        end_time: form.end_time || null,
        schedule_pattern: form.schedule_pattern || null,
        time_slot_start: form.time_slot_start || null,
        time_slot_end: form.time_slot_end || null,
        days_of_week: Array.isArray(form.days_of_week)
          ? form.days_of_week.join(',')
          : form.days_of_week || null,
        category: form.category || null,
        is_live: form.is_live || !!form.live_url,
        live_url: form.live_url || null,
        is_ad: !!form.is_ad,
        ad_interval_minutes: form.ad_interval_minutes ? Number(form.ad_interval_minutes) : null,
        ad_duration_seconds: form.ad_duration_seconds ? Number(form.ad_duration_seconds) : null,
        ad_start_at: form.ad_start_at || null,
        ad_end_at: form.ad_end_at || null,
        ad_placement: form.ad_placement || 'between_shows',
        show_type: form.show_type || 'show',
        is_active: form.is_active,
        created_by: userId,
        created_at: editingShow ? editingShow.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let showId = editingShow ? editingShow.id : null;
      let error;
      if (editingShow) {
        const { error: updateError } = await supabase
          .from('studio_shows')
          .update(showData)
          .eq('id', editingShow.id);
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('studio_shows')
          .insert([showData])
          .select();
        error = insertError;
        if (data && data[0]) showId = data[0].id;
      }
      if (error) throw error;

      if (showId && stagedEpisodes.length > 0) {
        if (editingShow) await supabase.from('studio_episodes').delete().eq('show_id', showId);
        for (let ep of stagedEpisodes) {
          let epVideoUrl = ep.video_url;
          let epThumbUrl = ep.thumbnail_url;
          if (ep.video_type === 'upload' && ep.video_file)
            epVideoUrl = await uploadToStorage(ep.video_file, 'episodes/videos');
          if (ep.thumbnail_type === 'upload' && ep.thumbnail_file)
            epThumbUrl = await uploadToStorage(ep.thumbnail_file, 'episodes/thumbnails');
          const episodeData = {
            ...ep,
            video_url: epVideoUrl,
            thumbnail_url: epThumbUrl,
            show_id: showId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { error: episodeError } = await supabase.from('studio_episodes').insert(episodeData);
          if (episodeError) console.error('Episode insert error:', episodeError);
        }
      }

      try {
        const daysToGen = Number(form.auto_generate_days || 7);
        if (
          showId &&
          daysToGen > 0 &&
          (form.schedule_pattern || form.time_slot_start || form.days_of_week)
        ) {
          await generateEpisodesForShow(
            showId,
            {
              title: form.title,
              schedule_pattern: form.schedule_pattern,
              time_slot_start: form.time_slot_start || form.scheduled_time?.substring(11, 16),
              time_slot_end: form.time_slot_end || form.end_time?.substring(11, 16),
              days_of_week: form.days_of_week,
              is_vod_available: true,
            },
            daysToGen,
          );
        }
      } catch (err) {
        console.error('Auto-generate episodes error:', err);
      }

      toast({ title: 'Success', description: 'Show and episodes saved successfully.' });
      setShowModal(false);
      setForm(defaultShow);
      setStagedEpisodes([]);
      fetchShows();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save show. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadToStorage = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage
      .from('studio-media')
      .upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { publicUrl } = supabase.storage.from('studio-media').getPublicUrl(fileName).data;
    return publicUrl;
  };

  const handleFormChange = (e: any) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') setForm((f: any) => ({ ...f, [name]: checked }));
    else if (type === 'file') setForm((f: any) => ({ ...f, [name]: files[0] }));
    else setForm((f: any) => ({ ...f, [name]: value }));
  };

  const handleDaysToggle = (day: string) => {
    setForm((f: any) => {
      const existing = Array.isArray(f.days_of_week)
        ? f.days_of_week
        : f.days_of_week
          ? String(f.days_of_week)
              .split(',')
              .map((s: string) => s.trim())
          : [];
      const lowered = day.toLowerCase();
      const found = existing.map((d: string) => d.toLowerCase()).indexOf(lowered) !== -1;
      const next = found
        ? existing.filter((d: string) => d.toLowerCase() !== lowered)
        : [...existing, day];
      return { ...f, days_of_week: next };
    });
  };

  const handleDeleteShow = async (showId: number) => {
    if (!window.confirm('Are you sure you want to delete this show?')) return;
    setUploading(true);
    try {
      await supabase.from('studio_shows').delete().eq('id', showId);
      await supabase.from('studio_episodes').delete().eq('show_id', showId);
      toast({ title: 'Show deleted' });
      fetchShows();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenEpisodeModal = (showId: string | number) => {
    setCurrentEpisodeShowId(showId);
    void fetchEpisodeShowTitle(showId);
    setShowEpisodePage(true);
    fetchEpisodes(showId);
  };

  const episodePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showEpisodePage && episodePanelRef.current) {
      try {
        episodePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
    }
  }, [showEpisodePage]);

  const handleCloseEpisodeModal = () => {
    setShowEpisodePage(false);
    setEditingEpisode(null);
    setSelectedEpisodeIds([]);
    setCurrentEpisodeShowId(null);
    setCurrentEpisodeShowTitle('');
    setCurrentEpisodeShowSchedule('');
    setNewEpisodeForm(defaultEpisode);
  };

  const handleSelectEpisode = (id: string | number) => {
    setSelectedEpisodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleDeleteEpisode = async (id: string | number) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      const { error } = await supabase.from('studio_episodes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Episode deleted successfully' });
      if (currentEpisodeShowId) fetchEpisodes(currentEpisodeShowId);
      fetchCalendarEpisodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete episode',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEpisodeIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedEpisodeIds.length} selected episodes?`)) return;
    try {
      const { error } = await supabase.from('studio_episodes').delete().in('id', selectedEpisodeIds);
      if (error) throw error;
      toast({
        title: 'Success',
        description: `${selectedEpisodeIds.length} episode(s) deleted successfully`,
      });
      setSelectedEpisodeIds([]);
      if (currentEpisodeShowId) fetchEpisodes(currentEpisodeShowId);
      fetchCalendarEpisodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete episodes',
        variant: 'destructive',
      });
    }
  };

  const handleEditEpisode = async (episode: any) => {
    let ep = episode;
    if (episode?.id) {
      const { data, error } = await supabase
        .from('studio_episodes')
        .select('*')
        .eq('id', episode.id)
        .maybeSingle();
      if (error) console.error('Could not reload episode before editing:', error);
      if (data) ep = data;
    }

    const videoUrl = typeof ep?.video_url === 'string' ? ep.video_url.trim() : '';
    const thumbnailUrl = typeof ep?.thumbnail_url === 'string' ? ep.thumbnail_url.trim() : '';
    setEditingEpisode(ep);
    setNewEpisodeForm({
      ...defaultEpisode,
      ...ep,
      title: ep?.title || '',
      description: ep?.description || '',
      video_url: videoUrl,
      video_file: null,
      video_type: videoUrl ? 'url' : 'upload',
      thumbnail_url: thumbnailUrl,
      thumbnail_file: null,
      thumbnail_type: thumbnailUrl ? 'url' : 'upload',
    });
    const showId = ep?.show_id || ep?.showId || currentEpisodeShowId;
    if (showId !== null && showId !== undefined) {
      setCurrentEpisodeShowId(showId);
      void fetchEpisodeShowTitle(showId);
    }
    setShowEpisodePage(true);
  };

  const handleNewEpisodeChange = (e: any) => {
    const { name, value, type, files, checked } = e.target;
    if (type === 'checkbox') setNewEpisodeForm((f: any) => ({ ...f, [name]: checked }));
    else if (type === 'file')
      setNewEpisodeForm((f: any) => ({
        ...f,
        [name]: files && files[0] ? files[0] : undefined,
        ...(name === 'video_file' && { video_url: '' }),
        ...(name === 'thumbnail_file' && { thumbnail_url: '' }),
      }));
    else setNewEpisodeForm((f: any) => ({ ...f, [name]: value }));
  };

  const validateEpisodeForm = (): boolean => {
    if (newEpisodeForm.video_type === 'url' && !newEpisodeForm.video_url?.trim()) {
      toast({ title: 'Error', description: 'Video URL is required', variant: 'destructive' });
      return false;
    }
    if (newEpisodeForm.video_type === 'upload' && !newEpisodeForm.video_file) {
      toast({ title: 'Error', description: 'Video file is required', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSaveEpisode = async () => {
    if (!currentEpisodeShowId) {
      toast({ title: 'Error', description: 'No show selected for episode', variant: 'destructive' });
      return;
    }
    if (!validateEpisodeForm()) return;
    try {
      const payload: any = {
        title: newEpisodeForm.title,
        description: newEpisodeForm.description || '',
        duration: newEpisodeForm.duration || '0',
        scheduled_time: newEpisodeForm.scheduled_time || null,
        end_time: newEpisodeForm.end_time || null,
        is_active: newEpisodeForm.is_active !== undefined ? newEpisodeForm.is_active : true,
        show_id: currentEpisodeShowId,
        updated_at: new Date().toISOString(),
      };
      if (newEpisodeForm.video_type === 'upload' && newEpisodeForm.video_file) {
        try {
          payload.video_url = await uploadToStorage(newEpisodeForm.video_file, 'episodes/videos');
        } catch (e) {
          toast({ title: 'Warning', description: 'Video upload failed', variant: 'destructive' });
          return;
        }
      } else if (newEpisodeForm.video_type === 'url' && newEpisodeForm.video_url) {
        payload.video_url = newEpisodeForm.video_url;
      }
      if (newEpisodeForm.thumbnail_type === 'upload' && newEpisodeForm.thumbnail_file) {
        try {
          payload.thumbnail_url = await uploadToStorage(
            newEpisodeForm.thumbnail_file,
            'episodes/thumbnails',
          );
        } catch (e) {
          payload.thumbnail_url = '';
        }
      } else if (newEpisodeForm.thumbnail_type === 'url' && newEpisodeForm.thumbnail_url) {
        payload.thumbnail_url = newEpisodeForm.thumbnail_url;
      }

      if (editingEpisode) {
        const { error } = await supabase
          .from('studio_episodes')
          .update(payload)
          .eq('id', editingEpisode.id)
          .select();
        if (error) throw error;
        toast({ title: 'Success', description: 'Episode updated successfully' });
      } else {
        payload.created_at = new Date().toISOString();
        payload.created_by = userId;
        const { error } = await supabase.from('studio_episodes').insert([payload]).select();
        if (error) throw error;
        toast({ title: 'Success', description: 'Episode created successfully' });
      }
      setNewEpisodeForm(defaultEpisode);
      setEditingEpisode(null);
      if (currentEpisodeShowId) fetchEpisodes(currentEpisodeShowId);
      fetchCalendarEpisodes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save episode',
        variant: 'destructive',
      });
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-sm w-full rounded-2xl border-border/60 bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
            <Radio className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-pulse" />
          </div>
          <p className="text-sm font-semibold">Authenticating…</p>
          <p className="text-xs text-muted-foreground mt-1">
            Verifying your Studio access
          </p>
        </Card>
      </div>
    );
  }

  const isAdmin = ['admin', 'superadmin'].includes(userPrivilege || '');

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════════════════════════════════════════════════════
          PAGE HEADER
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-fuchsia-500/[0.04]">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg shadow-purple-500/25">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Studios
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Full studio control' : 'Read-only'} · Signed in as{' '}
                  <span className="font-medium text-foreground/80">@{userId?.slice(0, 8)}</span>
                </p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="flex items-center gap-5 flex-wrap">
              <HeaderStat icon={Tv} value={shows.length} label="Shows" tone="purple" />
              <HeaderStat
                icon={Activity}
                value={shows.filter((s) => s.is_active).length}
                label="Active"
                tone="emerald"
              />
              <HeaderStat
                icon={Radio}
                value={shows.filter((s) => s.is_live).length}
                label="Live"
                tone="amber"
              />
            </div>
          </div>

          {/* Tab navigation — pill style */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max pb-1">
              {TABS.map(({ key, label, icon: Icon, gradient }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleTabChange(key)}
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
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* ── Schedule Guide Tab ── */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-blue-500/20">
                  <Calendar className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">TV Schedule Guide</h2>
                  <p className="text-xs text-muted-foreground">
                    Full day's programming · {currentSchedule.length}{' '}
                    {currentSchedule.length === 1 ? 'program' : 'programs'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full bg-muted/60 p-1 ring-1 ring-border/40">
                  {(['guide', 'grid', 'calendar'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-colors',
                        viewMode === mode
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {mode === 'guide' ? 'Guide' : mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {viewMode === 'guide' && (
              <TVScheduleGuide
                programs={currentSchedule}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                nowPlaying={nowPlaying}
                onWatch={(p) => {
                  if (p.show_id) handleOpenEpisodeModal(p.show_id);
                }}
                onProgramClick={(p) => {
                  if (p.show_id) handleOpenEpisodeModal(p.show_id);
                }}
              />
            )}
            {viewMode === 'grid' && (
              <TVGridGuide
                programs={currentSchedule}
                selectedDate={selectedDate}
                onProgramClick={(program) => {
                  if (program.show_id) handleOpenEpisodeModal(program.show_id);
                }}
              />
            )}
            {viewMode === 'calendar' && (
              <TVCalendarGuide
                programs={currentSchedule}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onProgramClick={(program) => {
                  if (program.show_id) handleOpenEpisodeModal(program.show_id);
                }}
              />
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            STUDIO MANAGER TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'studio' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
                  <Tv className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Shows</h2>
                  <p className="text-xs text-muted-foreground">
                    {shows.length} {shows.length === 1 ? 'show' : 'shows'} · Manage NexSq-owned TV programming
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleOpenModal()}
                disabled={!isAdmin}
                className={cn(
                  'h-10 gap-2 rounded-xl font-semibold shrink-0',
                  'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                  'shadow-md shadow-purple-500/25',
                )}
              >
                <Plus className="h-4 w-4" />
                Add Show
              </Button>
            </div>

            {!isAdmin && (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-500/[0.06] px-4 py-3 text-xs ring-1 ring-amber-500/20">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white mt-0.5">
                  <Activity className="h-3 w-3" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    Read-only access
                  </p>
                  <p className="text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                    You have <span className="font-semibold">{userPrivilege}</span> privileges.
                    Only admin and superadmin users can create or edit shows.
                  </p>
                </div>
              </div>
            )}

            {shows.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 p-12 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
                  <Tv className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold">No platform-owned shows yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a show owned and managed by NexSq
                </p>
                {isAdmin && (
                  <Button
                    onClick={() => handleOpenModal()}
                    className="mt-4 gap-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-md shadow-purple-500/25"
                  >
                    <Plus className="h-4 w-4" />
                    Add Show
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shows.map((show, idx) => (
                  <Card
                    key={idx}
                    className="group overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-purple-500/30"
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted/60">
                      {show.thumbnail_url ? (
                        <img
                          src={show.thumbnail_url}
                          alt={`${show.title} preview`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5">
                          <Tv className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex gap-1.5">
                        {show.is_live && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                            </span>
                            LIVE
                          </span>
                        )}
                        {show.show_type === 'event' && (
                          <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            EVENT
                          </span>
                        )}
                        {show.is_ad && (
                          <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            AD
                          </span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm',
                            show.is_active
                              ? 'bg-emerald-500/90 text-white'
                              : 'bg-slate-500/90 text-white',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              show.is_active ? 'bg-white' : 'bg-white/60',
                            )}
                          />
                          {show.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="text-sm font-bold tracking-tight line-clamp-1">
                        {show.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {show.scheduled_time || 'No schedule'}
                          {show.end_time ? ` – ${show.end_time}` : ''}
                        </span>
                      </div>
                      {show.description && (
                        <p className="mt-2 text-xs leading-relaxed text-foreground/70 line-clamp-2">
                          {show.description}
                        </p>
                      )}

                      {show.category && (
                        <div className="mt-2.5">
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: getCategoryColor(show.category) }}
                          >
                            {show.category}
                          </span>
                        </div>
                      )}

                      <div className="mt-3.5 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenModal(show)}
                          disabled={!isAdmin}
                          className="h-8 flex-1 rounded-lg text-[11px] font-semibold bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-sm"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEpisodeModal(show.id)}
                          className="h-8 flex-1 rounded-lg text-[11px] font-semibold"
                        >
                          Episodes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteShow(show.id)}
                          disabled={!isAdmin}
                          className="h-8 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-600"
                        >
                          <svg
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                          </svg>
                        </Button>
                      </div>

                      {show.live_url && (
                        <a
                          href={show.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                        >
                          <Radio className="h-3 w-3" />
                          Watch live stream
                          <ChevronRight className="h-3 w-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai-presenter' && (
          <DailyPodcastNewsroom
            onStartRecording={handleStartPodcastRecording}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            INSIGHTS TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="rounded-2xl border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20">
                    <Tv className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums leading-none">
                  {shows.length.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Total Shows
                </div>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums leading-none">
                  {shows.filter((s) => s.is_active).length.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Active
                </div>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 ring-1 ring-slate-500/20">
                    <Users className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums leading-none">
                  {shows.filter((s) => !s.is_active).length.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Inactive
                </div>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums leading-none">
                  {shows.filter((s) => new Date(s.scheduled_time) > new Date()).length.toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Upcoming
                </div>
              </Card>
            </div>

            <Card className="rounded-2xl border-border/60 bg-card overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-base font-bold tracking-tight">
                    Broadcast Schedule
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Show
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Start
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          End
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-center py-8 text-xs text-muted-foreground"
                          >
                            No scheduled shows
                          </td>
                        </tr>
                      ) : (
                        [...shows]
                          .sort(
                            (a, b) =>
                              new Date(a.scheduled_time).getTime() -
                              new Date(b.scheduled_time).getTime(),
                          )
                          .map((show, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-border/40 hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-3 py-2.5 font-semibold text-[13px]">
                                {show.title}
                              </td>
                              <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
                                {show.scheduled_time || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
                                {show.end_time || '—'}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            APPLICATIONS TAB
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <ShowApplicationReview
              isAdmin={isAdmin}
              onReviewComplete={() => {
                void fetchShows();
              }}
            />
            <CreatorShowPublicationReview
              isAdmin={isAdmin}
              view="review"
              onReviewComplete={() => {
                void fetchShows();
              }}
            />
          </div>
        )}
        {activeTab === 'creator-shows' && (
          <CreatorShowPublicationReview isAdmin={isAdmin} view="published" />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            EPISODE MANAGEMENT PANEL
           ═══════════════════════════════════════════════════════════════ */}
        {showEpisodePage && (
          <div ref={episodePanelRef}>
            <Card className="rounded-2xl border-border/60 bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                      <ClipboardList className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold tracking-tight">
                        Manage Episodes
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Show ID: {currentEpisodeShowId}
                        {loadingEpisodes && (
                          <>
                            {' · '}
                            <SkeletonLine width="3rem" className="inline-block align-middle" />
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseEpisodeModal}
                    className="h-9 rounded-xl shrink-0"
                  >
                    Back to Shows
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEpisodes ? (
                  <div className="py-6">
                    <SkeletonLine width="40%" className="mx-auto" />
                    <div className="mt-4 grid gap-3">
                      <SkeletonCard />
                      <SkeletonCard />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 rounded-2xl overflow-hidden border border-border/60">
                      <EpisodeCalendar
                        episodes={episodes}
                        onEventDrop={() => {}}
                        onEventClick={(info: any) => {
                          const ep = info.event.extendedProps?.episode;
                          if (ep) handleEditEpisode(ep);
                        }}
                      />
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingEpisode(null);
                          setNewEpisodeForm(defaultEpisode);
                        }}
                        className="h-9 gap-1.5 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-sm shadow-purple-500/25 font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Episode
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedEpisodeIds.length === 0}
                        onClick={handleBulkDelete}
                        className="h-9 rounded-xl text-red-600 border-red-500/30 hover:bg-red-500/10 hover:text-red-600 font-semibold"
                      >
                        Delete ({selectedEpisodeIds.length})
                      </Button>
                      <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                        {episodes.length} total episodes
                      </span>
                    </div>

                    <EpisodeDragDropList
                      key={episodes.length}
                      episodes={episodes}
                      selectedIds={selectedEpisodeIds}
                      onReorder={() => {}}
                      onEdit={handleEditEpisode}
                      onDelete={handleDeleteEpisode}
                      onSelect={handleSelectEpisode}
                    />

                    <div className="mt-8 rounded-2xl border border-border/60 bg-muted/30 p-5">
                      <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 ring-1 ring-purple-500/20">
                          <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        {editingEpisode
                          ? `Edit Episode: ${editingEpisode.title}`
                          : 'Add New Episode'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-full">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Show
                          </label>
                          <Input
                            value={currentEpisodeShowTitle || (currentEpisodeShowId ? `Show ${currentEpisodeShowId}` : '')}
                            readOnly
                            aria-label="Episode parent show"
                            className="h-11 rounded-xl bg-muted/40"
                          />
                        </div>
                        <div className="col-span-full">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Approved Broadcast Slot
                          </label>
                          <Input
                            value={currentEpisodeShowSchedule || 'No broadcast slot assigned'}
                            readOnly
                            aria-label="Approved show broadcast slot"
                            className="h-11 rounded-xl bg-muted/40"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Title *
                          </label>
                          <Input
                            name="title"
                            value={newEpisodeForm.title || ''}
                            onChange={handleNewEpisodeChange}
                            placeholder="Episode title"
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Duration (minutes)
                          </label>
                          <Input
                            name="duration"
                            value={newEpisodeForm.duration || ''}
                            onChange={handleNewEpisodeChange}
                            placeholder="e.g., 30"
                            type="number"
                            className="h-11 rounded-xl"
                          />
                        </div>

                        <div className="col-span-full">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Video *
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <select
                                name="video_type"
                                value={newEpisodeForm.video_type || 'url'}
                                onChange={handleNewEpisodeChange}
                                className="h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              >
                                <option value="url">URL</option>
                                <option value="upload">Upload File</option>
                              </select>
                              {newEpisodeForm.video_type === 'upload' ? (
                                <input
                                  type="file"
                                  name="video_file"
                                  accept="video/*"
                                  onChange={handleNewEpisodeChange}
                                  className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-purple-600 dark:file:text-purple-400"
                                />
                              ) : (
                                <Input
                                  name="video_url"
                                  value={newEpisodeForm.video_url || ''}
                                  onChange={handleNewEpisodeChange}
                                  placeholder="https://example.com/video.mp4"
                                  className="flex-1 h-11 rounded-xl"
                                />
                              )}
                            </div>
                            {newEpisodeForm.video_type === 'url' &&
                              newEpisodeForm.video_url && (
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
                                    <svg
                                      width="9"
                                      height="9"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                    >
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                  Using URL: {newEpisodeForm.video_url.substring(0, 50)}…
                                </div>
                              )}
                          </div>
                        </div>

                        <div className="col-span-full">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Thumbnail
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <select
                                name="thumbnail_type"
                                value={newEpisodeForm.thumbnail_type || 'url'}
                                onChange={handleNewEpisodeChange}
                                className="h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              >
                                <option value="url">URL</option>
                                <option value="upload">Upload File</option>
                              </select>
                              {newEpisodeForm.thumbnail_type === 'upload' ? (
                                <input
                                  type="file"
                                  name="thumbnail_file"
                                  accept="image/*"
                                  onChange={handleNewEpisodeChange}
                                  className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-purple-600 dark:file:text-purple-400"
                                />
                              ) : (
                                <Input
                                  name="thumbnail_url"
                                  value={newEpisodeForm.thumbnail_url || ''}
                                  onChange={handleNewEpisodeChange}
                                  placeholder="https://example.com/thumbnail.jpg"
                                  className="flex-1 h-11 rounded-xl"
                                />
                              )}
                            </div>
                            {newEpisodeForm.thumbnail_type === 'url' &&
                              newEpisodeForm.thumbnail_url && (
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
                                    <svg
                                      width="9"
                                      height="9"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                    >
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </div>
                                  Using thumbnail URL
                                </div>
                              )}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Scheduled Time
                          </label>
                          <Input
                            name="scheduled_time"
                            value={newEpisodeForm.scheduled_time || ''}
                            onChange={handleNewEpisodeChange}
                            type="datetime-local"
                            className="h-11 rounded-xl"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            End Time
                          </label>
                          <Input
                            name="end_time"
                            value={newEpisodeForm.end_time || ''}
                            onChange={handleNewEpisodeChange}
                            type="datetime-local"
                            className="h-11 rounded-xl"
                          />
                        </div>

                        <div className="col-span-full">
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Description
                          </label>
                          <Input
                            name="description"
                            value={newEpisodeForm.description || ''}
                            onChange={handleNewEpisodeChange}
                            placeholder="Episode description"
                            className="h-11 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingEpisode(null);
                            setNewEpisodeForm(defaultEpisode);
                          }}
                          className="h-10 rounded-xl"
                        >
                          Clear Form
                        </Button>
                        <Button
                          onClick={handleSaveEpisode}
                          disabled={!newEpisodeForm.title?.trim()}
                          className={cn(
                            'h-10 gap-2 rounded-xl font-semibold',
                            'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                            'shadow-md shadow-purple-500/25',
                          )}
                        >
                          {editingEpisode ? 'Update Episode' : 'Create Episode'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SHOW MODAL
         ═══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
                  <Tv className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">
                    {editingShow ? 'Edit Show' : 'Add TV Show'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {editingShow ? 'Update show details' : 'Fill in the show details below'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {showModalStep === 1 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="col-span-full">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Title
                    </label>
                    <Input
                      name="title"
                      value={form.title}
                      onChange={handleFormChange}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleFormChange}
                      required
                      rows={4}
                      className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Type
                    </label>
                    <select
                      name="show_type"
                      value={form.show_type || 'show'}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="show">Show</option>
                      <option value="event">Live Event</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Category
                    </label>
                    <select
                      name="category"
                      value={form.category || ''}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="">None</option>
                      {[
                        'Fanalysis',
                        "Mic'd Breakfast Show",
                        'Girls Talk',
                        'Kickstart',
                        'Mid-Day Groove',
                        'Perspective Inspiration',
                        'Documentary',
                        'Sermons',
                        'Business',
                        'Education',
                      ].map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Video
                    </label>
                    <select
                      name="video_type"
                      value={form.video_type}
                      onChange={handleFormChange}
                      className="mb-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.video_type === 'url' ? (
                      <Input
                        name="video_url"
                        value={form.video_url}
                        onChange={handleFormChange}
                        placeholder="https://..."
                        className="h-11 rounded-xl"
                      />
                    ) : (
                      <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm">
                        <input
                          type="file"
                          name="video_file"
                          accept="video/*"
                          onChange={handleFormChange}
                          className="hidden"
                        />
                        <span className="text-muted-foreground">Choose video file</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Thumbnail
                    </label>
                    <select
                      name="thumbnail_type"
                      value={form.thumbnail_type}
                      onChange={handleFormChange}
                      className="mb-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.thumbnail_type === 'url' ? (
                      <Input
                        name="thumbnail_url"
                        value={form.thumbnail_url}
                        onChange={handleFormChange}
                        placeholder="https://..."
                        className="h-11 rounded-xl"
                      />
                    ) : (
                      <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm">
                        <input
                          type="file"
                          name="thumbnail_file"
                          accept="image/*"
                          onChange={handleFormChange}
                          className="hidden"
                        />
                        <span className="text-muted-foreground">Choose thumbnail</span>
                      </label>
                    )}
                  </div>
                  <div className="col-span-full">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Live Stream URL
                    </label>
                    <Input
                      name="live_url"
                      value={form.live_url || ''}
                      onChange={handleFormChange}
                      placeholder="https://example.com/live/stream.m3u8 or https://youtube.com/watch?v=..."
                      className="h-11 rounded-xl"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Optional: add a live stream URL to mark this show as live immediately.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Duration (mins)
                    </label>
                    <Input
                      name="duration"
                      value={form.duration}
                      onChange={handleFormChange}
                      type="number"
                      min="0"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Auto-generate episodes (days)
                    </label>
                    <input
                      name="auto_generate_days"
                      type="number"
                      min={0}
                      value={form.auto_generate_days ?? 7}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Auto-create episode slots for the next N days. Set 0 to disable.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Schedule Pattern
                    </label>
                    <select
                      name="schedule_pattern"
                      value={form.schedule_pattern || ''}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly (select days)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Time Slot Start
                    </label>
                    <input
                      type="time"
                      name="time_slot_start"
                      value={form.time_slot_start || (form.scheduled_time ? form.scheduled_time.substring(11, 16) : '')}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Time Slot End
                    </label>
                    <input
                      type="time"
                      name="time_slot_end"
                      value={form.time_slot_end || (form.end_time ? form.end_time.substring(11, 16) : '')}
                      onChange={handleFormChange}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Days Of Week
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                        (d) => {
                          const isChecked = (
                            Array.isArray(form.days_of_week)
                              ? form.days_of_week.map((x: string) => x.toLowerCase())
                              : String(form.days_of_week || '')
                                  .split(',')
                                  .map((s: string) => s.trim().toLowerCase())
                          ).includes(d.toLowerCase());
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleDaysToggle(d)}
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-semibold transition-all ring-1',
                                isChecked
                                  ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white ring-transparent shadow-sm'
                                  : 'bg-background text-muted-foreground ring-border/60 hover:ring-purple-500/30',
                              )}
                            >
                              {d.substring(0, 3)}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Select days the show should recur. Leave empty for one-off scheduled_time.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Scheduled Time
                    </label>
                    <Input
                      name="scheduled_time"
                      value={form.scheduled_time}
                      onChange={handleFormChange}
                      type="datetime-local"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      End Time
                    </label>
                    <Input
                      name="end_time"
                      value={form.end_time}
                      onChange={handleFormChange}
                      type="datetime-local"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="col-span-full flex flex-wrap gap-4 items-center pt-2">
                    {[
                      { key: 'is_live', label: 'Is Live', accent: 'accent-purple-600' },
                      { key: 'is_active', label: 'Is Active', accent: 'accent-emerald-600' },
                      { key: 'is_ad', label: 'Is Ad', accent: 'accent-amber-600' },
                    ].map(({ key, label, accent }) => (
                      <label
                        key={key}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          name={key}
                          checked={!!form[key]}
                          onChange={handleFormChange}
                          className={cn('h-4 w-4 rounded', accent)}
                        />
                        <span className="text-xs font-semibold">{label}</span>
                      </label>
                    ))}
                  </div>

                  {form.is_ad && (
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ad Interval (min)
                        </label>
                        <input
                          name="ad_interval_minutes"
                          type="number"
                          min={1}
                          value={form.ad_interval_minutes || 30}
                          onChange={handleFormChange}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ad Duration (sec)
                        </label>
                        <input
                          name="ad_duration_seconds"
                          type="number"
                          min={5}
                          value={form.ad_duration_seconds || 60}
                          onChange={handleFormChange}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Placement
                        </label>
                        <select
                          name="ad_placement"
                          value={form.ad_placement || 'between_shows'}
                          onChange={handleFormChange}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        >
                          <option value="between_shows">Between Shows</option>
                          <option value="pre_roll">Pre-roll</option>
                          <option value="post_roll">Post-roll</option>
                          <option value="overlay">Overlay</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ad Start
                        </label>
                        <Input
                          name="ad_start_at"
                          value={form.ad_start_at || ''}
                          onChange={handleFormChange}
                          type="datetime-local"
                          className="h-10 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ad End
                        </label>
                        <Input
                          name="ad_end_at"
                          value={form.ad_end_at || ''}
                          onChange={handleFormChange}
                          type="datetime-local"
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="col-span-full rounded-xl bg-blue-500/[0.06] px-3 py-2.5 ring-1 ring-blue-500/15">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      💡 You can add episodes in the next step, or just save the show if this is a
                      one-off video (e.g. a movie or special).
                    </p>
                  </div>
                </form>
              )}
            </div>

            <div className="flex gap-2 justify-end border-t border-border/60 px-5 py-4 shrink-0">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                type="button"
                className="h-10 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={uploading}
                className={cn(
                  'h-10 gap-2 rounded-xl font-semibold',
                  'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                  'shadow-md shadow-purple-500/25',
                )}
              >
                {uploading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Show'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudiosPage;