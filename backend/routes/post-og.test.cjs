const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEventMetadata, buildPostMetadata } = require('./post-og.cjs');

describe('buildPostMetadata', () => {
  it('uses the post content and image for a public image post', () => {
    const metadata = buildPostMetadata({
      content: '  A post-specific caption\n with spaces ',
      media_urls: ['https://cdn.example.com/photo.jpg'],
      privacy: 'public',
      post_type: 'image',
    }, '123e4567-e89b-12d3-a456-426614174000');

    assert.equal(metadata.description, 'A post-specific caption with spaces');
    assert.equal(metadata.title, 'A post-specific caption with spaces');
    assert.equal(metadata.imageUrl, 'https://cdn.example.com/photo.jpg');
    assert.equal(metadata.canonicalUrl, 'https://www.nexsq.com/post/123e4567-e89b-12d3-a456-426614174000');
  });

  describe('buildEventMetadata', () => {
    it('uses the public event poster as the share image', () => {
      const metadata = buildEventMetadata({
        content: 'Kickstart 2027 #GTM-Planner',
        event_banner: 'https://cdn.example.com/kickstart-poster.jpg',
        event_logo: 'https://cdn.example.com/kickstart-logo.png',
        event_description: 'Plan the next go-to-market launch.',
        post_type: 'event',
        privacy: 'public',
      }, 'kickstart-2027-gtm-planner-48bdbb1f');

      assert.equal(metadata.title, 'Kickstart 2027 #GTM-Planner');
      assert.equal(metadata.description, 'Plan the next go-to-market launch.');
      assert.equal(metadata.imageUrl, 'https://cdn.example.com/kickstart-poster.jpg');
      assert.equal(
        metadata.canonicalUrl,
        'https://www.nexsq.com/event/kickstart-2027-gtm-planner-48bdbb1f',
      );
    });

    it('falls back to the event logo and excludes private events', () => {
      const event = {
        content: 'Private event',
        event_logo: 'https://cdn.example.com/event-logo.png',
        post_type: 'event',
        privacy: 'public',
      };
      const metadata = buildEventMetadata(event, 'private-event-1234');

      assert.equal(metadata.imageUrl, 'https://cdn.example.com/event-logo.png');
      assert.equal(buildEventMetadata({ ...event, privacy: 'friends' }, 'private-event-1234'), null);
    });
  });

  it('uses a saved video thumbnail and does not expose non-public posts', () => {
    const video = buildPostMetadata({
      content: 'A video post',
      media_url: 'https://cdn.example.com/video.mp4',
      video_thumbnail_url: 'https://cdn.example.com/video-thumbnail.jpg',
      privacy: 'public',
      post_type: 'video',
    }, '123e4567-e89b-12d3-a456-426614174000');
    const privatePost = buildPostMetadata({
      content: 'Private content',
      privacy: 'friends',
    }, '123e4567-e89b-12d3-a456-426614174000');

    assert.equal(video.imageUrl, 'https://cdn.example.com/video-thumbnail.jpg');
    assert.equal(video.videoUrl, 'https://cdn.example.com/video.mp4');
    assert.equal(video.videoType, 'video/mp4');
    assert.equal(privatePost, null);
  });
});
