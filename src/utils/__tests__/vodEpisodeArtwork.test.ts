import { describe, expect, it } from 'vitest';
import { getVodEpisodeArtwork } from '../vodEpisodeArtwork';

describe('getVodEpisodeArtwork', () => {
  it('uses the podcast channel cover instead of episode or TV-show artwork', () => {
    expect(getVodEpisodeArtwork({
      is_podcast: true,
      podcast_cover_url: 'podcast-cover.jpg',
      thumbnail_url: 'episode-cover.jpg',
      show_thumbnail: 'tv-show-cover.jpg',
    })).toBe('podcast-cover.jpg');
  });

  it('does not fall back to TV-show artwork when a podcast cover is missing', () => {
    expect(getVodEpisodeArtwork({
      is_podcast: true,
      show_thumbnail: 'tv-show-cover.jpg',
    })).toBeNull();
  });

  it('keeps the existing episode-then-show artwork order for non-podcast episodes', () => {
    expect(getVodEpisodeArtwork({
      thumbnail_url: 'episode-cover.jpg',
      show_thumbnail: 'tv-show-cover.jpg',
    })).toBe('episode-cover.jpg');
    expect(getVodEpisodeArtwork({
      show_thumbnail: 'tv-show-cover.jpg',
    })).toBe('tv-show-cover.jpg');
  });
});
