import { describe, expect, it } from 'vitest';
import { getRetainedAudioRanges, parseMediaDuration, parseSilenceRanges } from '../podcastSilence';

describe('parseMediaDuration', () => {
  it('reads the duration reported by FFmpeg', () => {
    expect(parseMediaDuration([
      "Input #0, matroska,webm, from 'input.webm':",
      '  Duration: 00:01:02.375, start: 0.000000, bitrate: 132 kb/s',
    ])).toBe(62.375);
  });

  it('returns null when the media duration is unavailable', () => {
    expect(parseMediaDuration(['Duration: N/A'])).toBeNull();
  });
});

describe('parseSilenceRanges', () => {
  it('parses internal and trailing silent ranges', () => {
    const ranges = parseSilenceRanges([
      '[silencedetect] silence_start: 2.5',
      '[silencedetect] silence_end: 4.25 | silence_duration: 1.75',
      '[silencedetect] silence_start: 8',
    ], 10);

    expect(ranges).toEqual([
      { start: 2.5, end: 4.25 },
      { start: 8, end: 10 },
    ]);
  });
});

describe('getRetainedAudioRanges', () => {
  it('keeps short pauses and trims long silences with speech padding', () => {
    const ranges = getRetainedAudioRanges(10, [
      { start: 1, end: 1.7 },
      { start: 3, end: 5 },
    ], 1);

    expect(ranges).toEqual([
      { start: 0, end: 3.12 },
      { start: 4.88, end: 10 },
    ]);
  });

  it('leaves the recording unchanged when no silence reaches the threshold', () => {
    expect(getRetainedAudioRanges(4, [{ start: 1, end: 1.5 }], 1))
      .toEqual([{ start: 0, end: 4 }]);
  });
});
