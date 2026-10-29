import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, ExternalLink, Image as ImageIcon, Play, Send, Tv, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ShowApplication {
  id: string;
  applicant_id: string;
  channel_id: string;
  show_title: string;
  description: string;
  category: string;
  format: 'recorded' | 'live' | 'mixed';
  co_host_credits: string[];
  preferred_days: string[];
  preferred_time: string | null;
  timezone: string;
  created_at: string;
  channel_name?: string;
}

interface ShowApplicationReviewProps {
  isAdmin: boolean;
  onReviewComplete?: () => void;
}

interface CreatorShowPublicationReviewProps extends ShowApplicationReviewProps {
  view?: 'all' | 'review' | 'published';
}

export const ShowApplicationReview = ({ isAdmin, onReviewComplete }: ShowApplicationReviewProps) => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<ShowApplication[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('studio_show_applications' as any)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      toast({ title: 'Could not load show applications', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const rows = (data || []) as ShowApplication[];
    const channelIds = [...new Set(rows.map((application) => application.channel_id))];
    let channelNames: Record<string, string> = {};
    if (channelIds.length) {
      const { data: channels } = await supabase
        .from('studio_channels')
        .select('id, name')
        .in('id', channelIds);
      channelNames = Object.fromEntries((channels || []).map((channel) => [channel.id, channel.name]));
    }

    setApplications(rows.map((application) => ({
      ...application,
      channel_name: channelNames[application.channel_id] || 'Studio channel',
    })));
    setLoading(false);
  }, [isAdmin, toast]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const reviewApplication = async (application: ShowApplication, decision: 'approved' | 'rejected') => {
    setReviewingId(application.id);
    const { error } = await supabase.rpc('review_studio_show_application' as any, {
      p_application_id: application.id,
      p_decision: decision,
      p_reviewer_notes: reviewNotes[application.id]?.trim() || null,
    });
    setReviewingId(null);

    if (error) {
      toast({ title: 'Application review failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: decision === 'approved' ? 'Show application approved' : 'Show application declined',
      description: decision === 'approved'
        ? 'A creator show draft is ready for the owner to complete before publication review.'
        : 'The creator can submit a new application later.',
    });
    await loadApplications();
    onReviewComplete?.();
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Only Studio administrators can review TV show applications.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tv className="h-5 w-5" /> Creator TV applications
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{applications.length} pending</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications…</p>
        ) : applications.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Clock3 className="mx-auto mb-2 h-5 w-5" />
            No pending applications.
          </div>
        ) : applications.map((application) => (
          <article key={application.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{application.show_title}</h3>
                <p className="text-xs text-muted-foreground">
                  {application.channel_name} · {application.category} · {application.format}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(application.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{application.description}</p>
            {application.co_host_credits?.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Contributors: {application.co_host_credits.join(', ')}
              </p>
            )}
            {(application.preferred_days?.length > 0 || application.preferred_time) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Preferred airtime: {[application.preferred_days?.join(', '), application.preferred_time].filter(Boolean).join(' · ')} ({application.timezone})
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input
                value={reviewNotes[application.id] || ''}
                onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                maxLength={500}
                placeholder="Optional note to the creator"
                aria-label={`Review note for ${application.show_title}`}
                className="sm:flex-1"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={reviewingId === application.id}
                  onClick={() => void reviewApplication(application, 'rejected')}
                >
                  <X className="mr-2 h-4 w-4" /> Decline
                </Button>
                <Button
                  type="button"
                  disabled={reviewingId === application.id}
                  onClick={() => void reviewApplication(application, 'approved')}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
};

interface CreatorEpisodePreview {
  id: string;
  show_id: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface CreatorShowSubmission {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  created_by: string;
  submitted_for_review_at: string | null;
  time_slot_start: string | null;
  time_slot_end: string | null;
  creator_username?: string;
  channel_name?: string;
  preferred_days: string[];
  episodes: CreatorEpisodePreview[];
}

interface PublishedCreatorShow {
  id: string;
  title: string;
  category: string;
  created_by: string;
  thumbnail_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  approved_days: string[];
  published_at: string | null;
  creator_username?: string;
  channel_name?: string;
}

const SHOW_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const CreatorShowPublicationReview = ({
  isAdmin,
  onReviewComplete,
  view = 'all',
}: CreatorShowPublicationReviewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shows, setShows] = useState<CreatorShowSubmission[]>([]);
  const [publishedShows, setPublishedShows] = useState<PublishedCreatorShow[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [approvedDaysByShow, setApprovedDaysByShow] = useState<Record<string, string[]>>({});
  const [approvedSlotsByShow, setApprovedSlotsByShow] = useState<Record<string, { start: string; end: string }>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await (supabase.from('studio_shows') as any)
      .select('id, title, description, category, thumbnail_url, logo_url, banner_url, created_by, submitted_for_review_at, time_slot_start, time_slot_end')
      .eq('show_source', 'creator')
      .eq('publication_status', 'pending_review')
      .order('submitted_for_review_at', { ascending: true });

    if (error) {
      toast({ title: 'Could not load creator shows', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: publishedData, error: publishedError } = await (supabase.from('studio_shows') as any)
      .select('id, title, category, created_by, thumbnail_url, logo_url, banner_url, approved_days, published_at')
      .eq('show_source', 'creator')
      .eq('publication_status', 'published')
      .order('published_at', { ascending: false })
      .limit(100);

    if (publishedError) {
      toast({ title: 'Could not load published creator shows', description: publishedError.message, variant: 'destructive' });
    }

    const rows = (data || []) as Omit<CreatorShowSubmission, 'episodes' | 'preferred_days'>[];
    const publishedRows = (publishedData || []) as PublishedCreatorShow[];
    const creatorIds = [...new Set([...rows, ...publishedRows].map((show) => show.created_by).filter(Boolean))];
    const showIds = rows.map((show) => show.id);
    const [usersResult, channelsResult, episodesResult, applicationsResult] = await Promise.all([
      creatorIds.length
        ? supabase.from('users').select('id, username').in('id', creatorIds)
        : Promise.resolve({ data: [], error: null }),
      creatorIds.length
        ? supabase.from('studio_channels').select('user_id, name').in('user_id', creatorIds)
        : Promise.resolve({ data: [], error: null }),
      showIds.length
        ? (supabase.from('studio_episodes') as any).select('id, show_id, title, video_url, thumbnail_url').in('show_id', showIds).order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      showIds.length
        ? (supabase.from('studio_show_applications' as any).select('approved_show_id, preferred_days').in('approved_show_id', showIds).eq('status', 'approved') as any)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (usersResult.error || channelsResult.error || episodesResult.error || applicationsResult.error) {
      const relatedError = usersResult.error || channelsResult.error || episodesResult.error || applicationsResult.error;
      toast({ title: 'Could not load creator show details', description: relatedError?.message, variant: 'destructive' });
    }

    const usernames = new Map((usersResult.data || []).map((user) => [user.id, user.username]));
    const channelNames = new Map((channelsResult.data || []).map((channel) => [channel.user_id, channel.name]));
    const preferredDaysByShow = new Map<string, string[]>(
      (applicationsResult.data || []).map((application: { approved_show_id: string; preferred_days: string[] | null }) => [
        application.approved_show_id,
        application.preferred_days || [],
      ]),
    );
    const episodesByShow = new Map<string, CreatorEpisodePreview[]>();
    for (const episode of (episodesResult.data || []) as CreatorEpisodePreview[]) {
      const currentEpisodes = episodesByShow.get(episode.show_id) || [];
      currentEpisodes.push(episode);
      episodesByShow.set(episode.show_id, currentEpisodes);
    }

    setShows(rows.map((show) => ({
      ...show,
      creator_username: usernames.get(show.created_by) || undefined,
      channel_name: channelNames.get(show.created_by) || undefined,
      preferred_days: preferredDaysByShow.get(show.id) || [],
      episodes: episodesByShow.get(show.id) || [],
    })));
    setPublishedShows(publishedRows.map((show) => ({
      ...show,
      creator_username: usernames.get(show.created_by) || undefined,
      channel_name: channelNames.get(show.created_by) || undefined,
      approved_days: show.approved_days || [],
    })));
    setApprovedDaysByShow(Object.fromEntries(rows.map((show) => [show.id, preferredDaysByShow.get(show.id) || []])));
    setApprovedSlotsByShow(Object.fromEntries(rows.map((show) => [show.id, {
      start: show.time_slot_start?.slice(0, 5) || '',
      end: show.time_slot_end?.slice(0, 5) || '',
    }])));
    setLoading(false);
  }, [isAdmin, toast]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const reviewSubmission = async (show: CreatorShowSubmission, decision: 'publish' | 'changes_requested') => {
    const notes = reviewNotes[show.id]?.trim() || '';
    const approvedDays = approvedDaysByShow[show.id] || [];
    const approvedSlot = approvedSlotsByShow[show.id] || { start: '', end: '' };
    if (decision === 'changes_requested' && !notes) {
      toast({ title: 'Add a review note', description: 'Tell the creator what needs to change before returning this show.', variant: 'destructive' });
      return;
    }
    if (decision === 'publish' && approvedDays.length === 0) {
      toast({ title: 'Approve at least one broadcast day', description: 'Select at least one of the creator’s requested days before publishing.', variant: 'destructive' });
      return;
    }
    if (decision === 'publish' && (!approvedSlot.start || !approvedSlot.end || approvedSlot.start === approvedSlot.end)) {
      toast({ title: 'Set a broadcast time', description: 'Choose a start and end time. The times must be different.', variant: 'destructive' });
      return;
    }

    setReviewingId(show.id);
    const { error } = await supabase.rpc('review_studio_show_publication' as any, {
      p_show_id: show.id,
      p_decision: decision,
      p_approved_days: approvedDays,
      p_time_slot_start: approvedSlot.start || null,
      p_time_slot_end: approvedSlot.end || null,
      p_reviewer_notes: notes || null,
    });
    setReviewingId(null);

    if (error) {
      toast({ title: 'Creator show review failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: decision === 'publish' ? 'Creator show published' : 'Changes requested',
      description: decision === 'publish'
        ? 'The creator’s existing show and episodes are now active on NexSq TV.'
        : 'The creator can update the existing show and resubmit it.',
    });
    if (decision === 'publish') {
      await queryClient.invalidateQueries({ queryKey: ['studioShows'] });
    }
    await loadSubmissions();
    onReviewComplete?.();
  };

  if (!isAdmin) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Only Studio administrators can publish creator shows.</CardContent></Card>;
  }

  return (
    <>
    {view !== 'published' && (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/[0.06] to-teal-500/[0.03]">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Send className="h-4 w-4 text-emerald-600" /> Creator shows awaiting publication
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">{shows.length} pending</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Review the creator’s completed show and publish that existing record. No duplicate show entry is needed.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading creator submissions…</p>
        ) : shows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
            <Clock3 className="mx-auto mb-2 h-5 w-5" />
            No creator shows are awaiting publication.
          </div>
        ) : shows.map((show) => (
          <article key={show.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/40">
            <div className="relative aspect-[16/5] min-h-28 overflow-hidden bg-gradient-to-br from-emerald-600/20 to-cyan-500/10">
              {show.banner_url ? <img src={show.banner_url} alt={`${show.title} banner`} className="h-full w-full object-cover" /> : show.thumbnail_url ? <img src={show.thumbnail_url} alt={`${show.title} artwork`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-emerald-700/60 dark:text-emerald-300/60"><ImageIcon className="h-8 w-8" /></div>}
              {show.logo_url && <img src={show.logo_url} alt={`${show.title} logo`} className="absolute bottom-3 left-3 h-14 w-14 rounded-xl border border-white/40 bg-white object-contain p-1 shadow-lg" />}
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold">{show.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {show.creator_username ? `@${show.creator_username}` : 'Creator'}
                    {show.channel_name ? ` · ${show.channel_name}` : ''}
                    {show.category ? ` · ${show.category}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Submitted {show.submitted_for_review_at ? new Date(show.submitted_for_review_at).toLocaleDateString() : 'recently'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{show.description}</p>
              <div className="space-y-2 rounded-xl border border-border/60 bg-card/70 p-3">
                <div>
                  <p className="text-xs font-semibold">Approve broadcast days</p>
                  <p className="text-[11px] text-muted-foreground">
                    Creator requested: {show.preferred_days.length ? show.preferred_days.join(', ') : 'No days selected'}
                  </p>
                </div>
                {show.preferred_days.length ? (
                  <div className="flex flex-wrap gap-2">
                    {SHOW_DAYS.filter((day) => show.preferred_days.includes(day)).map((day) => {
                      const selected = (approvedDaysByShow[show.id] || []).includes(day);
                      return (
                        <label key={day} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setApprovedDaysByShow((current) => ({
                              ...current,
                              [show.id]: selected
                                ? (current[show.id] || []).filter((approvedDay) => approvedDay !== day)
                                : [...(current[show.id] || []), day],
                            }))}
                          />
                          {day}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">Request changes so the creator can choose preferred broadcast days.</p>
                )}
                <div className="grid gap-3 border-t border-border/50 pt-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold">
                    <span className="text-muted-foreground">Approved start time</span>
                    <Input
                      type="time"
                      value={approvedSlotsByShow[show.id]?.start || ''}
                      onChange={(event) => setApprovedSlotsByShow((current) => ({
                        ...current,
                        [show.id]: { ...(current[show.id] || { start: '', end: '' }), start: event.target.value },
                      }))}
                      aria-label={`Approved start time for ${show.title}`}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    <span className="text-muted-foreground">Approved end time</span>
                    <Input
                      type="time"
                      value={approvedSlotsByShow[show.id]?.end || ''}
                      onChange={(event) => setApprovedSlotsByShow((current) => ({
                        ...current,
                        [show.id]: { ...(current[show.id] || { start: '', end: '' }), end: event.target.value },
                      }))}
                      aria-label={`Approved end time for ${show.title}`}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Episodes ({show.episodes.length})</p>
                {show.episodes.length ? show.episodes.map((episode) => (
                  <div key={episode.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-2.5">
                    {episode.thumbnail_url ? <img src={episode.thumbnail_url} alt="" className="h-10 w-16 rounded-lg object-cover" /> : <span className="flex h-10 w-16 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Play className="h-4 w-4" /></span>}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{episode.title}</span>
                    {episode.video_url && <a href={episode.video_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-500/10 dark:text-blue-300"><ExternalLink className="h-3.5 w-3.5" />Preview</a>}
                  </div>
                )) : <p className="text-xs text-amber-700 dark:text-amber-300">No episodes were found for this submission.</p>}
              </div>
              <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row">
                <Input
                  value={reviewNotes[show.id] || ''}
                  onChange={(event) => setReviewNotes((current) => ({ ...current, [show.id]: event.target.value }))}
                  maxLength={500}
                  placeholder="Review note (required to request changes)"
                  aria-label={`Publication review note for ${show.title}`}
                  className="sm:flex-1"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={reviewingId === show.id || !reviewNotes[show.id]?.trim()} onClick={() => void reviewSubmission(show, 'changes_requested')}>
                    <X className="mr-2 h-4 w-4" /> Request changes
                  </Button>
                  <Button type="button" disabled={reviewingId === show.id || !(approvedDaysByShow[show.id] || []).length || !approvedSlotsByShow[show.id]?.start || !approvedSlotsByShow[show.id]?.end || approvedSlotsByShow[show.id]?.start === approvedSlotsByShow[show.id]?.end} onClick={() => void reviewSubmission(show, 'publish')} className="bg-gradient-to-br from-emerald-600 to-teal-500 text-white hover:from-emerald-700 hover:to-teal-600">
                    <Check className="mr-2 h-4 w-4" /> Publish
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
    )}
    {view !== 'review' && (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/[0.06] to-cyan-500/[0.03]">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Tv className="h-4 w-4 text-blue-600" /> Published creator shows
          <span className="ml-auto rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300">{publishedShows.length} published</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Creator-owned shows already live on NexSq TV.</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">
        {loading ? (
          <p className="py-5 text-center text-sm text-muted-foreground">Loading published shows…</p>
        ) : publishedShows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
            No creator shows have been published yet.
          </div>
        ) : publishedShows.map((show) => (
          <article key={show.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-500/10">
              {show.banner_url || show.thumbnail_url ? (
                <img src={show.banner_url || show.thumbnail_url || ''} alt={`${show.title} artwork`} className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-blue-600"><Tv className="h-5 w-5" /></div>}
              {show.logo_url && <img src={show.logo_url} alt="" className="absolute bottom-1 left-1 h-6 w-6 rounded-md bg-white object-contain p-0.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{show.title}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {show.creator_username ? `@${show.creator_username}` : 'Creator'}
                {show.channel_name ? ` · ${show.channel_name}` : ''}
                {show.category ? ` · ${show.category}` : ''}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {show.approved_days.length ? `Approved days: ${show.approved_days.join(', ')}` : 'No broadcast days'}
                {show.published_at ? ` · Published ${new Date(show.published_at).toLocaleDateString()}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">Live</span>
          </article>
        ))}
      </CardContent>
    </Card>
    )}
    </>
  );
};