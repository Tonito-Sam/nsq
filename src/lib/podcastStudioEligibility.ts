import { supabase } from '@/integrations/supabase/client';

export const PODCAST_STUDIO_MIN_REELS = 10;
export const PODCAST_STUDIO_MIN_SUBSCRIBERS = 1;

export type PodcastStudioEligibility = {
  channelId: string | null;
  reelCount: number;
  subscriberCount: number;
  eligible: boolean;
};

export async function getPodcastStudioEligibility(userId: string): Promise<PodcastStudioEligibility> {
  const { data: channels, error: channelsError } = await supabase
    .from('studio_channels')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (channelsError) throw channelsError;
  if (!channels?.length) {
    return { channelId: null, reelCount: 0, subscriberCount: 0, eligible: false };
  }

  const channelEligibility = await Promise.all(channels.map(async ({ id: channelId }) => {
    const [reelsResult, subscribersResult] = await Promise.all([
      supabase.from('studio_videos')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .eq('is_reel', true),
      supabase.from('studio_channel_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId),
    ]);

    if (reelsResult.error) throw reelsResult.error;
    if (subscribersResult.error) throw subscribersResult.error;
    return {
      channelId,
      reelCount: reelsResult.count || 0,
      subscriberCount: subscribersResult.count || 0,
    };
  }));

  const eligibleChannel = channelEligibility.find(({ reelCount, subscriberCount }) =>
    reelCount >= PODCAST_STUDIO_MIN_REELS
    && subscriberCount >= PODCAST_STUDIO_MIN_SUBSCRIBERS
  );
  const selectedChannel = eligibleChannel || channelEligibility[0];

  return {
    ...selectedChannel,
    eligible: Boolean(eligibleChannel),
  };
}
