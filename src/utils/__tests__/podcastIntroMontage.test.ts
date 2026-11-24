import { describe, expect, it } from 'vitest';
import {
  getPodcastLowerThirdStage,
  getNextPodcastBroadcastSlot,
  PODCAST_OUTRO_DURATION_MS,
  shouldShowPodcastLowerThird,
  shouldStartPodcastOutro,
} from '../podcastIntroMontage';

describe('shouldShowPodcastLowerThird', () => {
  it('shows the first lower third after five seconds for 15 seconds', () => {
    expect(shouldShowPodcastLowerThird(0)).toBe(false);
    expect(shouldShowPodcastLowerThird(4_999)).toBe(false);
    expect(shouldShowPodcastLowerThird(5_000)).toBe(true);
    expect(shouldShowPodcastLowerThird(19_999)).toBe(true);
    expect(shouldShowPodcastLowerThird(20_000)).toBe(false);
  });

  it('repeats every 30 seconds after the first appearance', () => {
    expect(shouldShowPodcastLowerThird(34_999)).toBe(false);
    expect(shouldShowPodcastLowerThird(35_000)).toBe(true);
    expect(shouldShowPodcastLowerThird(49_999)).toBe(true);
    expect(shouldShowPodcastLowerThird(50_000)).toBe(false);
  });
});

describe('getPodcastLowerThirdStage', () => {
  it('cycles the channel, topic, and host through the lower third', () => {
    expect(getPodcastLowerThirdStage(4_999)).toBeNull();
    expect(getPodcastLowerThirdStage(5_000)).toEqual({ stage: 0, progress: 0 });
    expect(getPodcastLowerThirdStage(10_000)).toEqual({ stage: 1, progress: 0 });
    expect(getPodcastLowerThirdStage(15_000)).toEqual({ stage: 2, progress: 0 });
    expect(getPodcastLowerThirdStage(19_999)?.stage).toBe(2);
    expect(getPodcastLowerThirdStage(20_000)).toBeNull();
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
