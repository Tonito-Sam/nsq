import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Loader2, Mic2, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type SuggestedPodcast = {
  showId: string;
  name: string;
  description: string;
  coverUrl: string | null;
  logoUrl: string | null;
  subscriptionMode: 'free' | 'paid';
  subscriptionPrice: number;
};

type SuggestedPodcastChannelsProps = {
  onNavigate?: (path: string) => void;
};

export const SuggestedPodcastChannels = ({ onNavigate }: SuggestedPodcastChannelsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [channels, setChannels] = useState<SuggestedPodcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(false);
  const [subscribingShowId, setSubscribingShowId] = useState<string | null>(null);
  const goTo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else navigate(path);
  };

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setLoadingError(false);
    try {
      const { data: brandRows, error: brandsError } = await supabase
        .from('studio_podcast_branding')
        .select('show_id, podcast_name, podcast_description, cover_url, logo_url, subscription_mode, subscription_price')
        .neq('podcast_name', '')
        .limit(100);
      if (brandsError) throw brandsError;

      let excludedShowIds = new Set<string>();
      if (user?.id) {
        const [membershipResult, applicationResult, managerResult] = await Promise.all([
          supabase
            .from('studio_podcast_subscriptions')
            .select('show_id, expires_at')
            .eq('subscriber_id', user.id),
          supabase
            .from('studio_show_applications')
            .select('approved_show_id')
            .eq('applicant_id', user.id)
            .eq('status', 'approved'),
          supabase
            .from('studio_show_managers')
            .select('show_id')
            .eq('user_id', user.id),
        ]);
        if (membershipResult.error) throw membershipResult.error;
        if (applicationResult.error) throw applicationResult.error;
        if (managerResult.error) throw managerResult.error;

        const activeSubscriptions = (membershipResult.data || [])
          .filter((membership) => !membership.expires_at || new Date(membership.expires_at).getTime() > Date.now())
          .map((membership) => membership.show_id);
        const ownShows = ((applicationResult.data || []) as Array<{ approved_show_id: string | null }>)
          .flatMap((application) => application.approved_show_id ? [application.approved_show_id] : []);
        const managedShows = ((managerResult.data || []) as Array<{ show_id: string }>)
          .map((manager) => manager.show_id);
        excludedShowIds = new Set([...activeSubscriptions, ...ownShows, ...managedShows]);
      }

      const suggestions = (brandRows || [])
        .filter((brand) => brand.podcast_name?.trim() && !excludedShowIds.has(brand.show_id))
        .slice(0, 5)
        .map((brand) => ({
          showId: brand.show_id,
          name: brand.podcast_name.trim(),
          description: brand.podcast_description?.trim() || 'Discover episodes from this Podcast channel.',
          coverUrl: brand.cover_url,
          logoUrl: brand.logo_url,
          subscriptionMode: brand.subscription_mode,
          subscriptionPrice: Number(brand.subscription_price || 0),
        }));
      setChannels(suggestions);
    } catch (error) {
      console.error('Could not load suggested Podcast channels:', error);
      setLoadingError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const handleSubscribe = async (showId: string) => {
    if (!user?.id) {
      goTo('/auth');
      return;
    }
    if (subscribingShowId) return;

    setSubscribingShowId(showId);
    try {
      const { data, error } = await supabase.rpc('subscribe_to_podcast', { p_show_id: showId });
      if (error) throw error;

      const result = data as {
        status?: string;
        amount_usd?: number;
        platform_fee_usd?: number;
        creator_net_usd?: number;
        order_number?: string;
        invoice_number?: string;
      } | null;
      const alreadySubscribed = result?.status === 'already_subscribed';
      const channel = channels.find((item) => item.showId === showId);
      const amount = Number(result?.amount_usd ?? channel?.subscriptionPrice ?? 0);
      const platformFee = Number(result?.platform_fee_usd ?? 0);
      const creatorNet = Number(result?.creator_net_usd ?? amount - platformFee);
      const invoiceDetails = result?.invoice_number
        ? ` Invoice ${result.invoice_number} is available in Podcast orders & invoices.`
        : '';
      toast({
        title: alreadySubscribed ? 'Already subscribed' : 'Podcast subscription active',
        description: alreadySubscribed
          ? 'Your access is already active. No additional payment was taken.'
          : channel?.subscriptionMode === 'paid'
            ? `$${amount.toFixed(2)} total was charged. This includes NexSq's $${platformFee.toFixed(2)} platform fee; the creator receives $${creatorNet.toFixed(2)}.${invoiceDetails}`
            : 'You can find this channel in your Podcast subscriptions.',
      });
      window.dispatchEvent(new Event('podcast-subscriptions-updated'));
      await loadSuggestions();
    } catch (error) {
      toast({
        title: 'Could not subscribe',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubscribingShowId(null);
    }
  };

  return (
    <Card className="relative overflow-hidden border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-card to-fuchsia-500/[0.04] shadow-sm dark:bg-[#161616]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/20">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-semibold leading-tight text-gray-900 dark:text-gray-100">
              Podcast Channels to Follow
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Find a new voice for your next listen.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Finding Podcast channels">
            {[0, 1].map((item) => (
              <div key={item} className="h-[112px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
            ))}
          </div>
        ) : loadingError ? (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center text-xs text-destructive">
            Could not load suggested Podcast channels.
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-500/20 bg-background/60 px-4 py-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300">
              <Mic2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Your next favorite is on its way</p>
            <p className="mx-auto mt-1 max-w-[190px] text-[11px] leading-relaxed text-muted-foreground">
              No Podcast channels to suggest yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.showId}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md"
              >
                {channel.coverUrl && (
                  <>
                    <img
                      src={channel.coverUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-[0.12] transition-opacity group-hover:opacity-[0.2]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-card via-card/90 to-violet-500/[0.08]" />
                  </>
                )}
                <div className="relative p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-10 w-10 shrink-0 rounded-xl ring-2 ring-background shadow-sm">
                      <AvatarImage src={channel.logoUrl || channel.coverUrl || undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
                        <Mic2 className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => goTo(`/podcast/${channel.showId}`)}
                        className="block max-w-full truncate text-left text-sm font-semibold text-gray-900 transition-colors hover:text-violet-700 dark:text-gray-100 dark:hover:text-violet-300"
                      >
                        {channel.name}
                      </button>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 ring-1 ring-violet-500/15 dark:text-violet-300">
                        {channel.subscriptionMode === 'paid' ? (
                          <>
                            <Wallet className="h-2.5 w-2.5" />
                            ${channel.subscriptionPrice.toFixed(2)} / 30 days
                          </>
                        ) : (
                          'Free to follow'
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {channel.description}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={subscribingShowId !== null}
                    onClick={() => void handleSubscribe(channel.showId)}
                    className="mt-3 h-8 w-full gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-xs font-semibold text-white shadow-sm shadow-violet-500/15 hover:from-violet-700 hover:to-fuchsia-600"
                  >
                    {subscribingShowId === channel.showId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Headphones className="h-3.5 w-3.5" />
                    )}
                    {subscribingShowId === channel.showId ? 'Subscribing…' : 'Subscribe'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
