import { describe, expect, it } from 'vitest';
import { extractFirstUrl } from './LinkPreviewCard';

describe('extractFirstUrl', () => {
  it('finds an HTTP URL inside post text and removes sentence punctuation', () => {
    expect(extractFirstUrl('Read this: https://example.com/story.')).toBe('https://example.com/story');
  });

  it('normalizes www links to HTTPS', () => {
    expect(extractFirstUrl('Visit www.example.com/news')).toBe('https://www.example.com/news');
  });

  it('ignores unsupported or malformed links', () => {
    expect(extractFirstUrl('javascript://example.com')).toBeNull();
    expect(extractFirstUrl('https://')).toBeNull();
  });
});