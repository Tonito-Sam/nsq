import { describe, expect, it } from 'vitest';
import {
  getNextPodcastBroadcastSlot,
  PODCAST_OUTRO_DURATION_MS,
  shouldShowPodcastLowerThird,
  shouldStartPodcastOutro,
} from '../podcastIntroMontage';

describe('shouldShowPodcastLowerThird', () => {
  it('shows the first lower third after 30 seconds for 15 seconds', () => {
    expect(shouldShowPodcastLowerThird(0)).toBe(false);
    expect(shouldShowPodcastLowerThird(29_999)).toBe(false);
    expect(shouldShowPodcastLowerThird(30_000)).toBe(true);
    expect(shouldShowPodcastLowerThird(44_999)).toBe(true);
    expect(shouldShowPodcastLowerThird(45_000)).toBe(false);
  });

  it('repeats every minute after the first appearance', () => {
    expect(shouldShowPodcastLowerThird(89_999)).toBe(false);
    expect(shouldShowPodcastLowerThird(90_000)).toBe(true);
    expect(shouldShowPodcastLowerThird(104_999)).toBe(true);
    expect(shouldShowPodcastLowerThird(105_000)).toBe(false);
  });
});

describe('Podcast outro timing and broadcast slot', () => {
  it('starts a 15-second outro exactly 15 seconds before the target runtime', () => {
    expect(PODCAST_OUTRO_DURATION_MS).toBe(15_000);
    expect(shouldStartPodcastOutro(584, 10)).toBe(false);
    expect(shouldStartPodcastOutro(585, 10)).toBe(true);
    expect(shouldStartPodcastOutro(0, 0)).toBe(false);
  });

  it('returns the next approved slot in its configured timezone', () => {
    const slot = getNextPodcastBroadcastSlot(
      ['Wednesday'],
      '15:00:00',
      '16:00:00',
      'America/Los_Angeles',
      new Date('2026-11-18T23:30:00.000Z'),
    );

    expect(slot).toEqual({
      date: 'Wednesday, November 25, 2026',
      time: '3:00 PM – 4:00 PM',
      timeZone: 'America/Los_Angeles',
    });
  });
});
