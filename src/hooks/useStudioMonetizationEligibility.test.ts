import { describe, expect, it } from 'vitest';
import { getStudioMonetizationFeatureEligibility } from './useStudioMonetizationEligibility';

describe('getStudioMonetizationFeatureEligibility', () => {
  it('unlocks donations at 10 qualifying Reels and subscriptions after Podcast approval', () => {
    expect(getStudioMonetizationFeatureEligibility(9, false)).toEqual({
      liveDonations: false,
      seriesSubscriptions: false,
    });
    expect(getStudioMonetizationFeatureEligibility(10, false)).toEqual({
      liveDonations: true,
      seriesSubscriptions: false,
    });
    expect(getStudioMonetizationFeatureEligibility(0, true)).toEqual({
      liveDonations: false,
      seriesSubscriptions: true,
    });
  });
});
