import { describe, expect, it } from 'vitest';
import { getVodEpisodeQueue } from '../vodEpisodeQueue';

const now = Date.parse('2026-11-23T12:00:00Z');

describe('getVodEpisodeQueue', () => {
  it('starts at the selected episode and plays later aired episodes in order', () => {
    const episodes = [
      { id: 'later', created_at: '2026-11-03T00:00:00Z', video_url: 'later.mp4' },
      { id: 'selected', created_at: '2026-11-02T00:00:00Z', video_url: 'selected.mp4' },
      { id: 'earlier', created_at: '2026-11-01T00:00:00Z', video_url: 'earlier.mp4' },
      { id: 'future', created_at: '2026-11-04T00:00:00Z', scheduled_time: '2026-11-24T00:00:00Z', video_url: 'future.mp4' },
    ];

    expect(getVodEpisodeQueue(episodes, 'selected', now).map(({ id }) => id))
      .toEqual(['selected', 'later']);
  });

  it('starts from the oldest aired episode when no episode is selected', () => {
    const episodes = [
      { id: 'later', created_at: '2026-11-03T00:00:00Z', video_url: 'later.mp4' },
      { id: 'earlier', created_at: '2026-11-01T00:00:00Z', video_url: 'earlier.mp4' },
    ];

    expect(getVodEpisodeQueue(episodes).map(({ id }) => id)).toEqual(['earlier', 'later']);
  });

  it('deduplicates records and excludes live, inactive, and unplayable episodes', () => {
    const episodes = [
      { id: 'one', created_at: '2026-11-01T00:00:00Z', video_url: 'one.mp4' },
      { id: 'one', created_at: '2026-11-01T00:00:00Z', video_url: 'duplicate.mp4' },
      { id: 'live', created_at: '2026-11-01T00:00:00Z', video_url: 'live.mp4', is_live: true },
      { id: 'inactive', created_at: '2026-11-01T00:00:00Z', video_url: 'inactive.mp4', is_active: false },
      { id: 'missing-video', created_at: '2026-11-01T00:00:00Z' },
    ];

    expect(getVodEpisodeQueue(episodes, 'one', now).map(({ id }) => id)).toEqual(['one']);
  });

  it('returns an empty queue when the selected episode is not available', () => {
    expect(getVodEpisodeQueue([
      { id: 'one', created_at: '2026-11-01T00:00:00Z', video_url: 'one.mp4' },
    ], 'missing', now)).toEqual([]);
  });
});
