import { describe, expect, it } from 'vitest';
import {
  getPodcastShortStartTimes,
  getPodcastVideoDuration,
  PODCAST_SHORT_CONTENT_DURATION_SECONDS,
  PODCAST_SHORT_DURATION_SECONDS,
  PODCAST_SHORT_OUTRO_DURATION_SECONDS,
} from '../podcastShorts';

describe('getPodcastVideoDuration', () => {
  it('uses the recorded duration when the media container has no duration metadata', () => {
    expect(getPodcastVideoDuration(Number.POSITIVE_INFINITY, 185, Number.POSITIVE_INFINITY)).toBe(185);
  });

  it('uses the seekable end when neither media nor recorded duration is available', () => {
    expect(getPodcastVideoDuration(Number.NaN, 0, 94)).toBe(94);
  });

  it('reports an unknown length instead of claiming the episode is too short', () => {
    expect(getPodcastVideoDuration(Number.NaN, 0, Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('getPodcastShortStartTimes', () => {
  it('spreads three 55-second clips across the episode timeline', () => {
    expect(getPodcastShortStartTimes(180)).toEqual([0, 62.5, 125]);
  });

  it('requires enough timeline to select distinct clip points', () => {
    expect(() => getPodcastShortStartTimes(55)).toThrow('longer than 55 seconds');
  });

  it('rejects episodes shorter than the requested clip length', () => {
    expect(() => getPodcastShortStartTimes(54.9)).toThrow('54 seconds long');
  });

  it('reserves the closing card while keeping each Podshort 55 seconds total', () => {
    expect(PODCAST_SHORT_CONTENT_DURATION_SECONDS + PODCAST_SHORT_OUTRO_DURATION_SECONDS)
      .toBe(PODCAST_SHORT_DURATION_SECONDS);
    expect(getPodcastShortStartTimes(180, PODCAST_SHORT_CONTENT_DURATION_SECONDS))
      .toEqual([0, 64, 128]);
  });
});
