import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mic2, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type ChannelStatus = 'active' | 'suspended' | 'deleted';
type SubscriptionMode = 'free' | 'paid';

type PodcastAdminChannel = {
  showId: string;
  creatorName: string;
  creatorUsername: string;
  podcastName: string;
  podcastDescription: string;
  coverUrl: string | null;
  logoUrl: string | null;
  subscriptionMode: SubscriptionMode;
  subscriptionPrice: number;
  status: ChannelStatus;
};

type PodcastEditForm = {
  name: string;
  description: string;
  subscriptionMode: SubscriptionMode;
  subscriptionPrice: string;
};

const emptyForm: PodcastEditForm = {
  name: '',
  description: '',
  subscriptionMode: 'free',
  subscriptionPrice: '0',
};

const channelStatusLabel: Record<ChannelStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  deleted: 'Deleted',
};

export default function AdminPodcastChannels() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<PodcastAdminChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyShowId, setBusyShowId] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<PodcastAdminChannel | null>(null);
  const [editForm, setEditForm] = useState<PodcastEditForm>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data: applications, error: applicationsError } = await supabase
        .from('studio_show_applications')
        .select('approved_show_id, applicant_id')
        .eq('status', 'approved')
        .not('approved_show_id', 'is', null);
      if (applicationsError) throw applicationsError;

      const approvedShowIds = [...new Set((applications || [])
        .map((application) => application.approved_show_id)
        .filter((showId): showId is string => Boolean(showId)))];
      if (!approvedShowIds.length) {
        setChannels([]);
        return;
      }

      const { data: shows, error: showsError } = await supabase
        .from('studio_shows')
        .select('id')
        .in('id', approvedShowIds)
        .eq('show_source', 'creator');
      if (showsError) throw showsError;
      if (!shows?.length) {
        setChannels([]);
        return;
      }

      const showIds = shows.map((show) => show.id);
      const applicantByShow = new Map(
        (applications || [])
          .filter((application) => showIds.includes(application.approved_show_id))
          .map((application) => [application.approved_show_id, application.applicant_id]),
      );
      const creatorIds = [...new Set([...applicantByShow.values()].filter(Boolean))];
      const [brandsResult, creatorsResult] = await Promise.all([
        supabase
          .from('studio_podcast_branding')
          .select('show_id, podcast_name, podcast_description, cover_url, logo_url, subscription_mode, subscription_price, channel_status')
          .in('show_id', showIds),
        creatorIds.length
          ? supabase
            .from('users')
            .select('id, first_name, last_name, username')
            .in('id', creatorIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (brandsResult.error) throw brandsResult.error;
      if (creatorsResult.error) throw creatorsResult.error;

      const brandsByShow = new Map((brandsResult.data || []).map((brand) => [brand.show_id, brand]));
      const creatorsById = new Map((creatorsResult.data || []).map((creator) => [creator.id, creator]));
      setChannels(shows.map((show) => {
        const brand = brandsByShow.get(show.id);
        const creator = creatorsById.get(applicantByShow.get(show.id));
        const creatorName = [creator?.first_name, creator?.last_name].filter(Boolean).join(' ');
        return {
          showId: show.id,
          creatorName: creatorName || (creator?.username ? `@${creator.username}` : 'Unknown creator'),
          creatorUsername: creator?.username ? `@${creator.username}` : '',
          podcastName: brand?.podcast_name?.trim() || 'Podcast channel',
          podcastDescription: brand?.podcast_description || '',
          coverUrl: brand?.cover_url || null,
          logoUrl: brand?.logo_url || null,
          subscriptionMode: brand?.subscription_mode === 'paid' ? 'paid' : 'free',
          subscriptionPrice: Number(brand?.subscription_price || 0),
          status: brand?.channel_status || 'active',
        };
      }).sort((a, b) => a.podcastName.localeCompare(b.podcastName)));
    } catch (error) {
      console.error('Could not load approved Podcast channels:', error);
      setLoadError(
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Could not load approved Podcast channels.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const openEditDialog = (channel: PodcastAdminChannel) => {
    setEditingChannel(channel);
    setEditForm({
      name: channel.podcastName,
      description: channel.podcastDescription,
      subscriptionMode: channel.subscriptionMode,
      subscriptionPrice: String(channel.subscriptionPrice),
    });
  };

  const saveChannel = async () => {
    if (!editingChannel || savingEdit) return;
    setSavingEdit(true);
    try {
      const price = editForm.subscriptionMode === 'paid' ? Number(editForm.subscriptionPrice) : 0;
      const { error } = await supabase.rpc('admin_update_podcast_channel', {
        p_show_id: editingChannel.showId,
        p_podcast_name: editForm.name.trim(),
        p_podcast_description: editForm.description.trim(),
        p_subscription_mode: editForm.subscriptionMode,
        p_subscription_price: price,
      });
      if (error) throw error;

      setChannels((current) => current.map((channel) => (
        channel.showId === editingChannel.showId
          ? {
              ...channel,
              podcastName: editForm.name.trim(),
              podcastDescription: editForm.description.trim(),
              subscriptionMode: editForm.subscriptionMode,
              subscriptionPrice: price,
            }
          : channel
      )));
      setEditingChannel(null);
      toast({ title: 'Podcast channel updated' });
    } catch (error) {
      toast({
        title: 'Could not update Podcast channel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const setChannelStatus = async (channel: PodcastAdminChannel, status: 'active' | 'suspended') => {
    setBusyShowId(channel.showId);
    try {
      const { error } = await supabase.rpc('admin_set_podcast_channel_status', {
        p_show_id: channel.showId,
        p_status: status,
      });
      if (error) throw error;
      setChannels((current) => current.map((item) => (
        item.showId === channel.showId ? { ...item, status } : item
      )));
      toast({ title: status === 'suspended' ? 'Podcast channel suspended' : 'Podcast channel reactivated' });
    } catch (error) {
      toast({
        title: 'Could not update Podcast channel status',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyShowId(null);
    }
  };

  const deleteChannel = async (channel: PodcastAdminChannel) => {
    const confirmed = window.confirm(
      `Delete "${channel.podcastName}" and revoke its subscriptions? The linked TV show and its episodes/recordings will be preserved.`,
    );
    if (!confirmed) return;

    setBusyShowId(channel.showId);
    try {
      const { error } = await supabase.rpc('admin_delete_podcast_channel', {
        p_show_id: channel.showId,
      });
      if (error) throw error;
      setChannels((current) => current.map((item) => (
        item.showId === channel.showId ? { ...item, status: 'deleted' } : item
      )));
      toast({ title: 'Podcast channel deleted' });
    } catch (error) {
      toast({
        title: 'Could not delete Podcast channel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyShowId(null);
    }
  };

  const priceIsValid = editForm.subscriptionMode === 'free'
    || (Number.isFinite(Number(editForm.subscriptionPrice))
      && Number(editForm.subscriptionPrice) >= 0.01
      && Number(editForm.subscriptionPrice) <= 500);

  return (
    <>
      <Card className="rounded-2xl border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic2 className="h-4 w-4 text-purple-600" />
            Approved Podcast channels
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Creator Podcast channels are approved automatically with their TV slot. Suspend or delete a channel only when needed for platform enforcement.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading approved Podcast channels…
            </div>
          ) : loadError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <span>{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadChannels()} disabled={loading}>
                Retry
              </Button>
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Mic2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">No approved creator Podcast channels</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Channels will appear here when a creator has an approved TV slot.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-3 font-semibold">Podcast channel</th>
                    <th className="px-3 py-3 font-semibold">Creator</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {channels.map((channel) => {
                    const isBusy = busyShowId === channel.showId;
                    return (
                      <tr key={channel.showId} className="align-middle">
                        <td className="px-3 py-3">
                          <div className="flex max-w-[260px] items-center gap-3">
                            <Avatar className="h-10 w-10 shrink-0 rounded-lg">
                              <AvatarImage src={channel.logoUrl || channel.coverUrl || undefined} alt="" />
                              <AvatarFallback className="rounded-lg bg-purple-500/10 text-purple-600">
                                <Mic2 className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{channel.podcastName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {channel.subscriptionMode === 'paid'
                                  ? `$${channel.subscriptionPrice.toFixed(2)} per 30 days`
                                  : 'Free subscription'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{channel.creatorName}</p>
                          {channel.creatorUsername && (
                            <p className="text-xs text-muted-foreground">{channel.creatorUsername}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            channel.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : channel.status === 'suspended'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {channel.status !== 'active' && <ShieldAlert className="h-3 w-3" />}
                            {channelStatusLabel[channel.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            {channel.status !== 'deleted' && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => openEditDialog(channel)}
                                  className="gap-1.5"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => void setChannelStatus(
                                    channel,
                                    channel.status === 'active' ? 'suspended' : 'active',
                                  )}
                                >
                                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : channel.status === 'active' ? 'Suspend' : 'Reactivate'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => void deleteChannel(channel)}
                                  className="gap-1.5 text-destructive hover:text-destructive"
                                  aria-label={`Delete ${channel.podcastName}`}
                                >
                                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingChannel)} onOpenChange={(open) => !open && setEditingChannel(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Podcast channel</DialogTitle>
            <DialogDescription>
              Update this Podcast channel without changing its linked TV show.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              Channel name
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={120}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Description
              <textarea
                value={editForm.description}
                onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={1200}
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Subscription plan
              <select
                value={editForm.subscriptionMode}
                onChange={(event) => setEditForm((current) => ({
                  ...current,
                  subscriptionMode: event.target.value as SubscriptionMode,
                  subscriptionPrice: event.target.value === 'free' ? '0' : current.subscriptionPrice === '0' ? '1' : current.subscriptionPrice,
                }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="free">Free subscription</option>
                <option value="paid">Paid subscription</option>
              </select>
            </label>
            {editForm.subscriptionMode === 'paid' && (
              <label className="block max-w-xs space-y-1.5 text-sm font-medium">
                Monthly price (USD)
                <Input
                  type="number"
                  min="0.01"
                  max="500"
                  step="0.01"
                  value={editForm.subscriptionPrice}
                  onChange={(event) => setEditForm((current) => ({ ...current, subscriptionPrice: event.target.value }))}
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingChannel(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveChannel()}
              disabled={
                savingEdit
                || editForm.name.trim().length < 2
                || (editForm.subscriptionMode === 'paid' && !priceIsValid)
              }
            >
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
