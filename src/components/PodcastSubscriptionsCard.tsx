import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Crown, Mic2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PodcastOrdersDialog } from '@/components/PodcastOrdersDialog';

type PodcastSubscription = {
  showId: string;
  name: string;
  coverUrl: string | null;
  logoUrl: string | null;
  isMyChannel: boolean;
};

type PodcastSubscriptionsCardProps = {
  onNavigate?: (path: string) => void;
};

export const PodcastSubscriptionsCard = ({ onNavigate }: PodcastSubscriptionsCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<PodcastSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!user?.id) {
      setSubscriptions([]);
      setLoading(false);
      setLoadingError(false);
      return;
    }

    setLoading(true);
    setLoadingError(false);
    try {
      const [membershipsResult, ownedShowsResult] = await Promise.all([
        supabase
          .from('studio_podcast_subscriptions')
          .select('show_id, expires_at')
          .eq('subscriber_id', user.id),
        supabase
          .from('studio_show_applications')
          .select('approved_show_id')
          .eq('applicant_id', user.id)
          .eq('status', 'approved')
          .not('approved_show_id', 'is', null),
      ]);
      if (membershipsResult.error) throw membershipsResult.error;
      if (ownedShowsResult.error) throw ownedShowsResult.error;

      const activeShowIds = (membershipsResult.data || [])
        .filter((membership) => !membership.expires_at || new Date(membership.expires_at).getTime() > Date.now())
        .map((membership) => membership.show_id);
      const ownedShowIds = new Set((ownedShowsResult.data || [])
        .map((application) => application.approved_show_id)
        .filter((showId): showId is string => Boolean(showId)));
      const channelIds = [...new Set([...ownedShowIds, ...activeShowIds])];
      if (channelIds.length === 0) {
        setSubscriptions([]);
        return;
      }

      const { data: channels, error: channelsError } = await supabase
        .from('studio_podcast_branding')
        .select('show_id, podcast_name, cover_url, logo_url')
        .in('show_id', channelIds);
      if (channelsError) throw channelsError;

      setSubscriptions((channels || [])
        .map((channel) => ({
          showId: channel.show_id,
          name: channel.podcast_name?.trim() || 'Podcast channel',
          coverUrl: channel.cover_url,
          logoUrl: channel.logo_url,
          isMyChannel: ownedShowIds.has(channel.show_id),
        }))
        .sort((first, second) => Number(second.isMyChannel) - Number(first.isMyChannel)));
    } catch (error) {
      console.error('Error fetching Podcast subscriptions:', error);
      setLoadingError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    const refreshSubscriptions = () => void fetchSubscriptions();
    window.addEventListener('podcast-subscriptions-updated', refreshSubscriptions);
    return () => window.removeEventListener('podcast-subscriptions-updated', refreshSubscriptions);
  }, [fetchSubscriptions]);

  const openChannel = (showId: string) => {
    const path = `/podcast/${showId}`;
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  return (
    <Card className="relative overflow-hidden rounded-2xl border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] via-card to-orange-500/[0.04] p-4 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
      <div className="relative">
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Mic2 className="h-3.5 w-3.5" />
            </div>
            <h3 className="truncate text-sm font-bold tracking-tight">Subscriptions</h3>
          </div>
          {subscriptions.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
              {subscriptions.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2.5" role="status" aria-label="Loading Podcast subscriptions">
            {[0, 1].map((item) => (
              <div key={item} className="h-[76px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
            ))}
          </div>
        ) : loadingError ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
            <p className="text-xs text-destructive">Could not load Podcast subscriptions.</p>
            <button
              type="button"
              onClick={() => void fetchSubscriptions()}
              className="mt-1 text-[11px] font-semibold text-destructive underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-500/20 bg-background/60 px-3 py-5 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-300">
              <Mic2 className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-foreground">Your listening list starts here</p>
            <p className="mx-auto mt-1 max-w-[190px] text-[11px] leading-relaxed text-muted-foreground">
              Podcast channels you subscribe to will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {subscriptions.slice(0, 5).map((subscription) => (
              <button
                key={subscription.showId}
                type="button"
                onClick={() => openChannel(subscription.showId)}
                aria-label={`Open ${subscription.isMyChannel ? 'my ' : ''}${subscription.name} Podcast channel`}
                className="group relative flex min-h-[76px] w-full items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-md"
              >
                {subscription.coverUrl && (
                  <>
                    <img
                      src={subscription.coverUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-[0.12] transition-opacity group-hover:opacity-[0.18]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/95 to-amber-500/[0.04]" />
                  </>
                )}
                <Avatar className="relative h-11 w-11 shrink-0 rounded-xl ring-2 ring-background shadow-sm">
                  <AvatarImage src={subscription.logoUrl || subscription.coverUrl || '/placeholder.svg'} className="object-cover" />
                  <AvatarFallback className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                    <Mic2 className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="relative min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-bold text-foreground transition-colors group-hover:text-amber-700 dark:group-hover:text-amber-300">
                      {subscription.name}
                    </span>
                    {subscription.isMyChannel && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200">
                        <Crown className="h-2.5 w-2.5" />
                        My Channel
                      </span>
                    )}
                  </span>
                  {!subscription.isMyChannel && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-500/15 dark:text-amber-300">
                      <Mic2 className="h-2.5 w-2.5" />
                      Subscribed
                    </span>
                  )}
                </span>
                <ChevronRight className="relative h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
              </button>
            ))}
            {subscriptions.length > 5 && (
              <p className="px-2 pt-1 text-center text-[11px] font-medium text-muted-foreground">
                +{subscriptions.length - 5} more subscriptions
              </p>
            )}
          </div>
        )}
        <div className="mt-3 border-t border-border/60 pt-3">
          <PodcastOrdersDialog />
        </div>
      </div>
    </Card>
  );
};
