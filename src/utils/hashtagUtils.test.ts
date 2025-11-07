import { describe, it, expect } from 'vitest';
import { extractHashtagsFromText } from './hashtagUtils';

describe('extractHashtagsFromText', () => {
  it('extracts simple hashtags', () => {
    expect(extractHashtagsFromText('hello #world test')).toEqual(['#world']);
  });

  it('extracts multiple hashtags and deduplicates', () => {
    expect(extractHashtagsFromText('#one #two #one')).toEqual(['#one', '#two']);
  });

  it('supports unicode letters and underscores and hyphens', () => {
    expect(extractHashtagsFromText('#hello-world #héllo #你好_世界')).toEqual(['#hello-world', '#héllo', '#你好_世界']);
  });

  it('returns empty for no hashtags', () => {
    expect(extractHashtagsFromText('no tags here')).toEqual([]);
  });

  it('handles punctuation correctly', () => {
    expect(extractHashtagsFromText('end of sentence #tag. next')).toEqual(['#tag']);
    expect(extractHashtagsFromText('brackets (#tag)')).toEqual(['#tag']);
  });
});
