import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MIN_PUBLISHED_VIDEOS = 10;
const MIN_CHANNEL_SUBSCRIBERS = 1;

const SHOW_CATEGORIES = [
  'Sports',
  'News',
  'Lifestyle',
  'Music',
  'Drama',
  'Comedy',
  'Education',
  'Politics',
  'Business',
  'Faith & Culture',
  'Other',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface ShowApplication {
  id: string;
  show_title: string;
  category: string;
  status: ApplicationStatus;
  reviewer_notes: string | null;
  approved_show_id: string | null;
}

export const ShowSlotApplication = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState(0);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [application, setApplication] = useState<ShowApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTitle, setShowTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState<'recorded' | 'live' | 'mixed'>('recorded');
  const [coHosts, setCoHosts] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState('');

  useEffect(() => {
    let current = true;

    const loadApplicationStatus = async () => {
      if (!user) {
        if (current) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: channels, error: channelError } = await supabase
          .from('studio_channels')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (channelError) throw channelError;
        const channel = channels?.[0];
        if (!channel) {
          if (current) setChannelId(null);
          return;
        }

        const [{ count: videos, error: videosError }, { count: subscribers, error: subscribersError }, { data: applications, error: applicationsError }] = await Promise.all([
          supabase
            .from('studio_videos')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .eq('user_id', user.id)
            .eq('is_reel', true),
          supabase
            .from('studio_channel_subscribers')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channel.id),
          supabase
            .from('studio_show_applications' as any)
            .select('id, show_title, category, status, reviewer_notes, approved_show_id')
            .eq('channel_id', channel.id)
            .in('status', ['pending', 'approved'])
            .order('created_at', { ascending: false })
            .limit(1),
        ]);

        if (videosError) throw videosError;
        if (subscribersError) throw subscribersError;
        if (applicationsError) throw applicationsError;

        if (current) {
          setChannelId(channel.id);
          setVideoCount(videos || 0);
          setSubscriberCount(subscribers || 0);
          setApplication((applications?.[0] as ShowApplication | undefined) || null);
        }
      } catch (error) {
        console.error('Could not load TV slot eligibility:', error);
        if (current) setChannelId(null);
      } finally {
        if (current) setLoading(false);
      }
    };

    void loadApplicationStatus();
    return () => { current = false; };
  }, [user]);

  const eligible = videoCount >= MIN_PUBLISHED_VIDEOS && subscriberCount >= MIN_CHANNEL_SUBSCRIBERS;

  const toggleDay = (day: string) => {
    setPreferredDays((selected) => selected.includes(day)
      ? selected.filter((value) => value !== day)
      : [...selected, day]);
  };

  const resetForm = () => {
    setShowTitle('');
    setDescription('');
    setCategory('');
    setFormat('recorded');
    setCoHosts('');
    setPreferredDays([]);
    setPreferredTime('');
  };

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !channelId || submitting) return;

    setSubmitting(true);
    const { error } = await supabase
      .from('studio_show_applications' as any)
      .insert({
        channel_id: channelId,
        applicant_id: user.id,
        show_title: showTitle.trim(),
        description: description.trim(),
        category,
        format,
        co_host_credits: coHosts.split(/[\n,]/).map((name) => name.trim()).filter(Boolean),
        preferred_days: preferredDays,
        preferred_time: preferredTime.trim() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });

    setSubmitting(false);
    if (error) {
      toast({
        title: 'Application could not be submitted',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setApplication({
      id: 'submitted',
      show_title: showTitle.trim(),
      category,
      status: 'pending',
      reviewer_notes: null,
      approved_show_id: null,
    });
    setDialogOpen(false);
    resetForm();
    toast({ title: 'TV show application submitted', description: 'The NexSq team will review your program.' });
  };

  if (loading || !channelId || (!eligible && !application)) return null;

  return (
    <>
      <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/[0.06] to-fuchsia-500/[0.04]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300">
              {application?.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> : application ? <Clock3 className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">{application ? application.show_title : 'Apply for a NexSq TV slot'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {application?.status === 'pending'
                  ? 'Your application is under review.'
                  : application?.status === 'approved'
                    ? 'Approved. The team will schedule your show.'
                    : 'Your channel meets the participation requirements.'}
              </p>
              {application?.reviewer_notes && <p className="mt-1 text-xs text-muted-foreground">Review note: {application.reviewer_notes}</p>}
            </div>
          </div>
          {!application && (
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Apply for a slot
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Apply for a NexSq TV slot</DialogTitle>
            <DialogDescription>
              Applications are reviewed by the NexSq team. Approved shows are scheduled separately.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Eligibility: {videoCount} / {MIN_PUBLISHED_VIDEOS} Studio videos and {subscriberCount} / {MIN_CHANNEL_SUBSCRIBERS} channel subscribers.
          </div>
          <form id="show-slot-application" onSubmit={submitApplication} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="tv-show-title" className="text-sm font-medium">Show title</label>
              <Input id="tv-show-title" value={showTitle} onChange={(event) => setShowTitle(event.target.value)} maxLength={100} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tv-show-category" className="text-sm font-medium">Category</label>
              <select id="tv-show-category" value={category} onChange={(event) => setCategory(event.target.value)} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a category</option>
                {SHOW_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tv-show-description" className="text-sm font-medium">What is the show about?</label>
              <textarea id="tv-show-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} required className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="tv-show-format" className="text-sm font-medium">Program format</label>
                <select id="tv-show-format" value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="recorded">Pre-recorded</option>
                  <option value="live">Live</option>
                  <option value="mixed">Mix of live and recorded</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tv-show-time" className="text-sm font-medium">Preferred airtime (optional)</label>
                <Input id="tv-show-time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} placeholder="e.g. weekday evenings" />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Preferred days (optional)</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {DAYS.map((day) => (
                  <label key={day} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={preferredDays.includes(day)} onChange={() => toggleDay(day)} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tv-show-cohosts" className="text-sm font-medium">Co-hosts / contributors (optional)</label>
              <textarea id="tv-show-cohosts" value={coHosts} onChange={(event) => setCoHosts(event.target.value)} rows={2} placeholder="Enter names, separated by commas or new lines" className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="show-slot-application" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};