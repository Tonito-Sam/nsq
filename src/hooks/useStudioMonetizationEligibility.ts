import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const DONATION_REEL_UNLOCK_COUNT = 10;
export const DONATION_REEL_MIN_DURATION_SECONDS = 90;

export const getStudioMonetizationFeatureEligibility = (
  qualifyingReelCount: number,
  podcastChannelApproved: boolean,
) => ({
  liveDonations: qualifyingReelCount >= DONATION_REEL_UNLOCK_COUNT,
  seriesSubscriptions: podcastChannelApproved,
});

type EligibilityState = {
  qualifyingReelCount: number;
  podcastChannelApproved: boolean;
  loading: boolean;
  error: string | null;
};

export function useStudioMonetizationEligibility(
  channelId?: string | null,
  userId?: string | null,
) {
  const [state, setState] = useState<EligibilityState>({
    qualifyingReelCount: 0,
    podcastChannelApproved: false,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    if (!channelId || !userId) {
      setState({
        qualifyingReelCount: 0,
        podcastChannelApproved: false,
        loading: false,
        error: null,
      });
      return () => { active = false; };
    }

    setState({
      qualifyingReelCount: 0,
      podcastChannelApproved: false,
      loading: true,
      error: null,
    });

    const loadEligibility = async () => {
      try {
        const [reelsResult, applicationResult] = await Promise.all([
          supabase.from('studio_videos')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channelId)
            .eq('user_id', userId)
            .eq('is_reel', true)
            .gte('duration', DONATION_REEL_MIN_DURATION_SECONDS),
          supabase.from('studio_show_applications' as any)
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channelId)
            .eq('applicant_id', userId)
            .eq('status', 'approved')
            .not('approved_show_id', 'is', null),
        ]);

        if (reelsResult.error) throw reelsResult.error;
        if (applicationResult.error) throw applicationResult.error;
        if (!active) return;

        setState({
          qualifyingReelCount: reelsResult.count || 0,
          podcastChannelApproved: (applicationResult.count || 0) > 0,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Could not load Studio monetization eligibility:', error);
        if (!active) return;

        setState({
          qualifyingReelCount: 0,
          podcastChannelApproved: false,
          loading: false,
          error: 'Could not verify eligibility. Refresh and try again.',
        });
      }
    };

    void loadEligibility();
    return () => { active = false; };
  }, [channelId, userId]);

  return {
    ...state,
    ...getStudioMonetizationFeatureEligibility(
      state.qualifyingReelCount,
      state.podcastChannelApproved,
    ),
  };
}
