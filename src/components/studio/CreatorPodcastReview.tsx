import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Loader2, MessageSquareText, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const PRIVATE_BUCKET = 'creator-podcast-drafts';

type ReviewDraft = {
  id: string;
  owner_id: string;
  channel_id: string;
  show_id: string;
  title: string;
  topic: string;
  description: string;
  script: string;
  host_names: string;
  recording_path: string;
  cover_image_path: string | null;
  submitted_at: string;
  creator_name?: string;
  channel_name?: string;
  show_title?: string;
  recording_url?: string;
  cover_url?: string;
};

type CreatorPodcastReviewProps = {
  isAdmin: boolean;
  onReviewComplete?: () => void;
};

export default function CreatorPodcastReview({ isAdmin, onReviewComplete }: CreatorPodcastReviewProps) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('creator_podcast_drafts')
      .select('id, owner_id, channel_id, show_id, title, topic, description, script, host_names, recording_path, cover_image_path, submitted_at')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
      .limit(50);
    if (error) {
      toast({ title: 'Could not load podcast review queue', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const rows = (data || []) as ReviewDraft[];
    try {
      const userIds = [...new Set(rows.map((draft) => draft.owner_id))];
      const channelIds = [...new Set(rows.map((draft) => draft.channel_id))];
      const showIds = [...new Set(rows.map((draft) => draft.show_id))];
      const [usersResult, channelsResult, showsResult] = await Promise.all([
        userIds.length ? supabase.from('users').select('id, username, first_name, last_name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
        channelIds.length ? supabase.from('studio_channels').select('id, name').in('id', channelIds) : Promise.resolve({ data: [], error: null }),
        showIds.length ? supabase.from('studio_shows').select('id, title').in('id', showIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (usersResult.error || channelsResult.error || showsResult.error) {
        throw usersResult.error || channelsResult.error || showsResult.error;
      }

      const users = new Map((usersResult.data || []).map((profile) => [
        profile.id,
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Creator',
      ]));
      const channels = new Map((channelsResult.data || []).map((channel) => [channel.id, channel.name]));
      const shows = new Map((showsResult.data || []).map((show: { id: string; title: string }) => [show.id, show.title]));
      const enriched = await Promise.all(rows.map(async (draft) => {
        const [recordingResult, coverResult] = await Promise.all([
          supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(draft.recording_path, 60 * 60),
          draft.cover_image_path
            ? supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(draft.cover_image_path, 60 * 60)
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (recordingResult.error || coverResult.error) throw recordingResult.error || coverResult.error;
        return {
          ...draft,
          creator_name: users.get(draft.owner_id) || 'Creator',
          channel_name: channels.get(draft.channel_id) || 'Studio channel',
          show_title: shows.get(draft.show_id) || 'Creator TV show',
          recording_url: recordingResult.data.signedUrl,
          cover_url: coverResult.data?.signedUrl,
        };
      }));
      setDrafts(enriched);
    } catch (detailError) {
      toast({
        title: 'Could not load podcast review details',
        description: detailError instanceof Error ? detailError.message : 'Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [isAdmin, toast]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const reviewDraft = async (draft: ReviewDraft, decision: 'publish' | 'changes_requested') => {
    const reviewerNotes = notes[draft.id]?.trim() || '';
    if (decision === 'changes_requested' && !reviewerNotes) {
      toast({ title: 'Add a review note', description: 'Explain what the creator needs to update before requesting changes.', variant: 'destructive' });
      return;
    }
    setReviewingId(draft.id);
    let reviewed = false;
    try {
      let videoUrl: string | null = null;
      if (decision === 'publish') {
        videoUrl = `podcast-private://${draft.recording_path}`;
      }

      const { error } = await supabase.rpc('review_creator_podcast_draft', {
        p_draft_id: draft.id,
        p_decision: decision,
        p_video_url: videoUrl,
        p_reviewer_notes: reviewerNotes || null,
      });
      if (error) throw error;
      reviewed = true;

      toast({
        title: decision === 'publish' ? 'Podcast episode published' : 'Changes requested',
        description: decision === 'publish'
          ? 'The approved recording is now part of the creator show.'
          : 'The creator can update and resubmit this private draft.',
      });
      await loadQueue();
      onReviewComplete?.();
    } catch (reviewError) {
      toast({
        title: reviewed ? 'Podcast review completed' : 'Podcast review failed',
        description: reviewed
          ? 'The decision was saved, but the queue did not refresh.'
          : reviewError instanceof Error ? reviewError.message : 'Please try again.',
        variant: reviewed ? 'default' : 'destructive',
      });
    } finally {
      setReviewingId(null);
    }
  };

  if (!isAdmin) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Only Studio administrators can review creator podcasts.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" /> Creator podcast submissions
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{drafts.length} pending</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading podcast submissions…</p> : drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Clock3 className="mx-auto mb-2 h-5 w-5" />No creator podcasts are waiting for review.
          </div>
        ) : drafts.map((draft) => (
          <article key={draft.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start gap-3">
              {draft.cover_url && <img src={draft.cover_url} alt="" className="h-16 w-24 rounded-md object-cover" />}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{draft.title}</h3>
                <p className="text-xs text-muted-foreground">{draft.creator_name} · {draft.channel_name} · {draft.show_title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{draft.topic || 'Creator-written script'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(draft.submitted_at).toLocaleString()}</p>
              </div>
            </div>
            <video src={draft.recording_url} controls playsInline className="max-h-[70vh] w-full rounded-lg bg-black" />
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Read submitted script</summary>
              <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed">{draft.script}</pre>
            </details>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={notes[draft.id] || ''}
                onChange={(event) => setNotes((current) => ({ ...current, [draft.id]: event.target.value }))}
                maxLength={500}
                placeholder="Review note (required when requesting changes)"
                aria-label={`Review note for ${draft.title}`}
                className="sm:flex-1"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={reviewingId === draft.id} onClick={() => void reviewDraft(draft, 'changes_requested')}>
                  {reviewingId === draft.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}Request changes
                </Button>
                <Button type="button" disabled={reviewingId === draft.id} onClick={() => void reviewDraft(draft, 'publish')}>
                  {reviewingId === draft.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Publish
                </Button>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
