import { describe, expect, it } from 'vitest';
import {
  canApplyForPodcastStudio,
  canUsePodcastStudio,
  hasPodcastStudioEligibilityException,
  isPodcastStudioChannelEligible,
  PODCAST_STUDIO_ELIGIBILITY_EXEMPT_USER_ID,
} from './podcastStudioEligibility';

describe('isPodcastStudioChannelEligible', () => {
  it('requires 50 qualifying Reels and 20 subscribers', () => {
    expect(isPodcastStudioChannelEligible(49, 20)).toBe(false);
    expect(isPodcastStudioChannelEligible(50, 19)).toBe(false);
    expect(isPodcastStudioChannelEligible(50, 20)).toBe(true);
  });
});

describe('canUsePodcastStudio', () => {
  it('preserves access for creators with an already approved Podcast', () => {
    expect(canUsePodcastStudio(false, true)).toBe(true);
  });

  it('requires the new criteria when there is no approved Podcast', () => {
    expect(canUsePodcastStudio(false, false)).toBe(false);
    expect(canUsePodcastStudio(true, false)).toBe(true);
  });
});

describe('Podcast eligibility exception', () => {
  it('allows the configured account to apply without meeting the Reel and subscriber thresholds', () => {
    const userId = PODCAST_STUDIO_ELIGIBILITY_EXEMPT_USER_ID;
    const mayApply = canApplyForPodcastStudio(false, hasPodcastStudioEligibilityException(userId));
    expect(mayApply).toBe(true);
    expect(canUsePodcastStudio(mayApply, false)).toBe(true);
  });

  it('does not waive the thresholds for other accounts', () => {
    const otherUserId = 'c0d0e97d-e972-4e31-b24b-cc8123456789';
    const isExempt = hasPodcastStudioEligibilityException(otherUserId);
    expect(isExempt).toBe(false);
    expect(canApplyForPodcastStudio(false, isExempt)).toBe(false);
  });
});
