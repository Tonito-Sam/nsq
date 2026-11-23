import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LockKeyhole, Mic2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { PodcastEpisodeCard } from '@/components/podcast/PodcastEpisodeCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type PodcastChannel = {
  id: string;
  podcast_name: string;
  podcast_description: string;
  cover_url: string | null;
  logo_url: string | null;
  subscription_mode: 'free' | 'paid';
  subscription_price: number;
  channel_status: 'active' | 'suspended' | 'deleted';
};

type PodcastEpisode = {
  id: string;
  title: string;
  topic: string;
  host_names: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  scheduled_time: string | null;
  views: number | null;
  shares: number | null;
};

const PRIVATE_VIDEO_PREFIX = 'podcast-private://';

const resolveEpisodeUrl = async (videoUrl: string) => {
  if (!videoUrl.startsWith(PRIVATE_VIDEO_PREFIX)) return videoUrl;
  const assetPath = videoUrl.slice(PRIVATE_VIDEO_PREFIX.length);
  const { data, error } = await supabase.storage
    .from('creator-podcast-drafts')
    .createSignedUrl(assetPath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export default function PodcastChannelPage() {
  const { showId } = useParams<{ showId: string }>();
  const [searchParams] = useSearchParams();
  const requestedEpisodeId = searchParams.get('episode');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [channel, setChannel] = useState<PodcastChannel | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [isChannelManager, setIsChannelManager] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  const loadChannel = useCallback(async () => {
    if (!showId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setChannel(null);
    setEpisodes([]);
    setSubscribed(false);
    setIsChannelManager(false);
    setSubscriptionExpiresAt(null);
    try {
      const brandResult = await supabase
        .from('studio_podcast_branding')
        .select('show_id, podcast_name, podcast_description, cover_url, logo_url, subscription_mode, subscription_price, channel_status')
        .eq('show_id', showId)
        .maybeSingle();
      if (brandResult.error) throw brandResult.error;
      const brand = brandResult.data;
      if (!brand) {
        setChannel(null);
        setEpisodes([]);
        setSubscribed(false);
        return;
      }

      const loadedChannel: PodcastChannel = {
        id: brand.show_id,
        podcast_name: brand.podcast_name,
        podcast_description: brand.podcast_description,
        cover_url: brand.cover_url,
        logo_url: brand.logo_url,
        subscription_mode: brand.subscription_mode,
        subscription_price: Number(brand.subscription_price || 0),
        channel_status: brand.channel_status,
      };
      setChannel(loadedChannel);

      if (loadedChannel.channel_status !== 'active') {
        setEpisodes([]);
        return;
      }

      if (!user?.id) {
        setSubscribed(false);
        setIsChannelManager(false);
        setSubscriptionExpiresAt(null);
        setEpisodes([]);
        return;
      }

      const [managerResult, membershipResult] = await Promise.all([
        supabase.rpc('is_podcast_show_manager', { p_show_id: showId }),
        supabase
          .from('studio_podcast_subscriptions')
          .select('expires_at')
          .eq('show_id', showId)
          .eq('subscriber_id', user.id)
          .maybeSingle(),
      ]);
      if (managerResult.error) throw managerResult.error;
      if (membershipResult.error) throw membershipResult.error;
      const isManager = Boolean(managerResult.data);
      setIsChannelManager(isManager);
      const membership = membershipResult.data;
      const activeMembership = Boolean(
        membership && (!membership.expires_at || new Date(membership.expires_at).getTime() > Date.now()),
      );
      setSubscribed(activeMembership);
      setSubscriptionExpiresAt(activeMembership ? membership?.expires_at || null : null);

      if (!activeMembership && !isManager) {
        setEpisodes([]);
        return;
      }

      const { data: episodeRows, error: episodesError } = await supabase
        .from('studio_episodes')
        .select('id, title, topic, host_names, description, video_url, thumbnail_url, created_at, scheduled_time, views, shares')
        .eq('show_id', showId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (episodesError) throw episodesError;
      setEpisodes(await Promise.all((episodeRows || []).map(async (episode) => ({
        ...episode,
        video_url: await resolveEpisodeUrl(episode.video_url),
      }))));
    } catch (loadError) {
      console.error('Could not load Podcast channel:', loadError);
      const message = loadError instanceof Error
        ? loadError.message
        : typeof loadError === 'object'
          && loadError !== null
          && 'message' in loadError
          && typeof loadError.message === 'string'
          ? loadError.message
          : 'Could not load this Podcast channel.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [showId, user?.id]);

  useEffect(() => {
    void loadChannel();
  }, [loadChannel]);

  const handleSubscribe = async () => {
    if (!user?.id) {
      navigate('/auth');
      return;
    }
    if (!channel || subscribing) return;
    setSubscribing(true);
    try {
      const { data, error: subscribeError } = await supabase.rpc('subscribe_to_podcast', {
        p_show_id: channel.id,
      });
      if (subscribeError) throw subscribeError;
      const result = data as {
        status?: string;
        amount_usd?: number;
        platform_fee_usd?: number;
        creator_net_usd?: number;
        expires_at?: string | null;
        order_number?: string;
        invoice_number?: string;
      } | null;
      const alreadySubscribed = result?.status === 'already_subscribed';
      const amount = Number(result?.amount_usd ?? channel.subscription_price);
      const platformFee = Number(result?.platform_fee_usd ?? 0);
      const creatorNet = Number(result?.creator_net_usd ?? amount - platformFee);
      const invoiceDetails = result?.invoice_number
        ? ` Invoice ${result.invoice_number} is available in Podcast orders & invoices.`
        : '';
      toast({
        title: alreadySubscribed ? 'Already subscribed' : 'Podcast subscription active',
        description: alreadySubscribed
          ? 'Your access is already active. No additional payment was taken.'
          : channel.subscription_mode === 'paid'
            ? `$${amount.toFixed(2)} total was charged. This includes NexSq's $${platformFee.toFixed(2)} platform fee; the creator receives $${creatorNet.toFixed(2)}. Your access lasts 30 days.${invoiceDetails}`
            : 'You now have access to this Podcast channel.',
      });
      window.dispatchEvent(new Event('podcast-subscriptions-updated'));
      await loadChannel();
    } catch (subscribeError) {
      toast({
        title: 'Could not subscribe',
        description: subscribeError instanceof Error ? subscribeError.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubscribing(false);
    }
  };

  const podcastName = channel?.podcast_name?.trim() || 'Podcast channel';
  const hasEpisodeAccess = subscribed || isChannelManager;
  const requiresSubscription = !hasEpisodeAccess;

  useEffect(() => {
    if (loading || !hasEpisodeAccess || !requestedEpisodeId || !episodes.length) return;
    document.getElementById(`podcast-episode-${requestedEpisodeId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [episodes.length, hasEpisodeAccess, loading, requestedEpisodeId]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <Link to="/studio" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back to Studio
        </Link>
        {loading ? (
          <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Loading Podcast channel…</div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
        ) : !channel ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This Podcast channel is not available.</p>
        ) : (
          <>
            <Card className="overflow-hidden rounded-3xl border-border/60 bg-card">
              <div
                className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-violet-700 via-fuchsia-600 to-amber-500"
                style={channel.cover_url ? { backgroundImage: `url("${channel.cover_url}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  <Mic2 className="h-3 w-3" /> Podcast
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 text-white sm:p-7">
                  {channel.logo_url && (
                    <img src={channel.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1 shadow-lg sm:h-20 sm:w-20" />
                  )}
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold sm:text-3xl">{podcastName}</h1>
                    <p className="mt-1 text-sm text-white/80">
                      {channel.subscription_mode === 'paid'
                        ? `$${channel.subscription_price.toFixed(2)} per 30 days`
                        : 'Free subscription'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-5 sm:p-7">
                {channel.podcast_description && <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{channel.podcast_description}</p>}
                {channel.channel_status !== 'active' ? (
                  <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
                    This Podcast channel is currently {channel.channel_status}.
                  </p>
                ) : requiresSubscription ? (
                  <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold">Subscribe to access Podcast episodes</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {!user?.id
                            ? 'Sign in to subscribe and access this channel.'
                            : channel.subscription_mode === 'paid'
                            ? 'Payment is taken from your real NexSq wallet balance. Renew manually after 30 days.'
                            : 'This channel is free to join; subscribing unlocks its episodes.'}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => void handleSubscribe()} disabled={subscribing} className="shrink-0 gap-2">
                      {channel.subscription_mode === 'paid' ? <Wallet className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
                      {subscribing
                        ? 'Subscribing…'
                        : !user?.id
                          ? 'Sign in to subscribe'
                          : channel.subscription_mode === 'paid'
                          ? `Subscribe for $${channel.subscription_price.toFixed(2)}`
                          : 'Subscribe for free'}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                    {subscriptionExpiresAt
                      ? <>Your subscription is active until {new Date(subscriptionExpiresAt).toLocaleDateString()}.</>
                      : 'Your free subscription is active.'}
                  </div>
                )}
              </div>
            </Card>

            {hasEpisodeAccess && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Podcast episodes</h2>
                  <p className="text-sm text-muted-foreground">Episodes for {podcastName}.</p>
                </div>
                {episodes.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {episodes.map((episode) => (
                      <PodcastEpisodeCard
                        key={episode.id}
                        episode={episode}
                        showId={channel.id}
                        podcastName={podcastName}
                        channelLogoUrl={channel.logo_url}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="font-medium">No published Podcast episodes yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Published episodes will appear here.</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
