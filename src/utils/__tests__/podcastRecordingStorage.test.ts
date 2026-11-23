import { describe, expect, it } from 'vitest';
import {
  getPodcastRecordingStoragePaths,
  PODCAST_RECORDING_STORAGE_BUCKET,
} from '../podcastRecordingStorage';

describe('podcast recording storage', () => {
  it('creates private per-user paths for the original and latest render', () => {
    expect(getPodcastRecordingStoragePaths('user-123', 'session-456')).toEqual({
      original: 'user-123/teleprompter-autosaves/session-456/original.webm',
      latest: 'user-123/teleprompter-autosaves/session-456/latest.webm',
    });
    expect(PODCAST_RECORDING_STORAGE_BUCKET).toBe('creator-podcast-drafts');
  });

  it('rejects session keys that could escape the user folder', () => {
    expect(() => getPodcastRecordingStoragePaths('user-123', '../other-user')).toThrow(
      'invalid storage key',
    );
  });
});
