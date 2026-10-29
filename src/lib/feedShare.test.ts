import { describe, expect, it } from 'vitest';
import { buildSharedFeedPostPayload } from './feedShare';

describe('buildSharedFeedPostPayload', () => {
  it('builds a feed post payload from a shared reel upload', () => {
    const payload = buildSharedFeedPostPayload({
      userId: 'user-123',
      caption: 'Cool day',
      mediaUrl: 'https://example.com/video.mp4',
      categories: ['Tech', 'Lifestyle'],
      audience: 'public',
      sourceType: 'video',
    });

    expect(payload).toMatchObject({
      user_id: 'user-123',
      content: 'Cool day',
      media_url: 'https://example.com/video.mp4',
      media_urls: ['https://example.com/video.mp4'],
      post_type: 'video',
      share_to_feed: true,
      audience: 'public',
      categories: ['Tech', 'Lifestyle'],
    });
  });
});
