import { describe, expect, it } from 'vitest';
import { createPodcastCaptionPhrases } from '../podcastShortCaptioning';

describe('createPodcastCaptionPhrases', () => {
  it('groups timed words into readable phrases and highlights meaningful terms', () => {
    const phrases = createPodcastCaptionPhrases([
      { text: 'This', timestamp: [0, 0.2] },
      { text: 'is', timestamp: [0.2, 0.35] },
      { text: 'important', timestamp: [0.4, 0.9] },
      { text: 'for', timestamp: [0.9, 1.1] },
      { text: 'everyone.', timestamp: [1.1, 1.7] },
      { text: 'Listen', timestamp: [2.6, 2.9] },
      { text: 'closely.', timestamp: [2.9, 3.4] },
    ]);

    expect(phrases).toHaveLength(2);
    expect(phrases[0]).toMatchObject({
      text: ['This', 'is', 'important', 'for', 'everyone.'],
      start: 0,
      end: 1.7,
    });
    expect([...phrases[0].keywords]).toEqual([2, 4]);
    expect(phrases[1].text).toEqual(['Listen', 'closely.']);
  });

  it('returns no caption phrases when transcription contains no words', () => {
    expect(createPodcastCaptionPhrases([])).toEqual([]);
  });
});
