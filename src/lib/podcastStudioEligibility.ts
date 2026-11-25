import { supabase } from '@/integrations/supabase/client';

export const PODCAST_STUDIO_MIN_REELS = 50;
export const PODCAST_STUDIO_MAX_REEL_DURATION_SECONDS = 360;
export const PODCAST_STUDIO_MIN_SUBSCRIBERS = 20;
export const PODCAST_STUDIO_ELIGIBILITY_EXEMPT_USER_ID = '0c00e1ba-6893-4b6f-a3ad-164e7d96b3b0';

export const hasPodcastStudioEligibilityException = (userId: string) =>
  userId === PODCAST_STUDIO_ELIGIBILITY_EXEMPT_USER_ID;

export const isPodcastStudioChannelEligible = (reelCount: number, subscriberCount: number) =>
  reelCount >= PODCAST_STUDIO_MIN_REELS
  && subscriberCount >= PODCAST_STUDIO_MIN_SUBSCRIBERS;

export const canUsePodcastStudio = (meetsNewCriteria: boolean, hasApprovedPodcast: boolean) =>
  meetsNewCriteria || hasApprovedPodcast;

export const canApplyForPodcastStudio = (meetsNewCriteria: boolean, hasEligibilityException: boolean) =>
  meetsNewCriteria || hasEligibilityException;

export type PodcastStudioEligibility = {
  channelId: string | null;
  reelCount: number;
  subscriberCount: number;
  eligible: boolean;
  approvedChannelId: string | null;
  eligibilityException: boolean;
  canApplyForPodcastStudio: boolean;
  canUsePodcastStudio: boolean;
};

export async function getPodcastStudioEligibility(userId: string): Promise<PodcastStudioEligibility> {
  const eligibilityException = hasPodcastStudioEligibilityException(userId);
  const { data: channels, error: channelsError } = await supabase
    .from('studio_channels')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (channelsError) throw channelsError;
  if (!channels?.length) {
    return {
      channelId: null,
      reelCount: 0,
      subscriberCount: 0,
      eligible: false,
      approvedChannelId: null,
      eligibilityException,
      canApplyForPodcastStudio: eligibilityException,
      canUsePodcastStudio: false,
    };
  }

  const channelEligibility = await Promise.all(channels.map(async ({ id: channelId }) => {
    const [reelsResult, subscribersResult, approvedResult] = await Promise.all([
      supabase.from('studio_videos')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .eq('is_reel', true)
        .lte('duration', PODCAST_STUDIO_MAX_REEL_DURATION_SECONDS),
      supabase.from('studio_channel_subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId),
      supabase.from('studio_show_applications' as any)
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .eq('applicant_id', userId)
        .eq('status', 'approved')
        .not('approved_show_id', 'is', null),
    ]);

    if (reelsResult.error) throw reelsResult.error;
    if (subscribersResult.error) throw subscribersResult.error;
    if (approvedResult.error) throw approvedResult.error;
    return {
      channelId,
      reelCount: reelsResult.count || 0,
      subscriberCount: subscribersResult.count || 0,
      hasApprovedPodcast: (approvedResult.count || 0) > 0,
    };
  }));

  const approvedChannel = channelEligibility.find(({ hasApprovedPodcast }) => hasApprovedPodcast);
  const eligibleChannel = channelEligibility.find(({ reelCount, subscriberCount }) =>
    isPodcastStudioChannelEligible(reelCount, subscriberCount)
  );
  const selectedChannel = eligibleChannel || channelEligibility[0];

  return {
    channelId: selectedChannel.channelId,
    reelCount: selectedChannel.reelCount,
    subscriberCount: selectedChannel.subscriberCount,
    eligible: Boolean(eligibleChannel),
    approvedChannelId: approvedChannel?.channelId || null,
    eligibilityException,
    canApplyForPodcastStudio: canApplyForPodcastStudio(Boolean(eligibleChannel), eligibilityException),
    canUsePodcastStudio: canUsePodcastStudio(
      canApplyForPodcastStudio(Boolean(eligibleChannel), eligibilityException),
      Boolean(approvedChannel),
    ),
  };
}
