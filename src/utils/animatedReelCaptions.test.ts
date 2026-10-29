import { describe, expect, it } from 'vitest';
import { getAutoCameraTransform, getCaptionWordIndex } from './animatedReelCaptions';

describe('getCaptionWordIndex', () => {
  it('advances one word at a time across the phrase duration', () => {
    expect(getCaptionWordIndex(4, 0)).toBe(0);
    expect(getCaptionWordIndex(4, 0.26)).toBe(1);
    expect(getCaptionWordIndex(4, 0.76)).toBe(3);
    expect(getCaptionWordIndex(4, 1)).toBe(3);
  });

  it('clamps progress and handles empty phrases', () => {
    expect(getCaptionWordIndex(3, -1)).toBe(0);
    expect(getCaptionWordIndex(3, 2)).toBe(2);
    expect(getCaptionWordIndex(0, 0.5)).toBe(-1);
  });
});

describe('getAutoCameraTransform', () => {
  it('cycles through distinct camera moves over the recording', () => {
    const frames = [0, 5, 10, 15].map((time) =>
      getAutoCameraTransform(true, time, 20, 1000, 1800)
    );

    expect(frames[0].zoom).toBe(1);
    expect(frames[1].zoom).toBe(1.18);
    expect(frames[1].offsetX).toBeGreaterThan(0);
    expect(frames[2].zoom).toBe(1.12);
    expect(frames[3].zoom).toBe(1.18);
    expect(frames[3].offsetX).toBeLessThan(0);
  });

  it('eases through move boundaries without a visible transform jump', () => {
    const before = getAutoCameraTransform(true, 4.999, 20, 1000, 1800);
    const after = getAutoCameraTransform(true, 5, 20, 1000, 1800);

    expect(Math.abs(before.zoom - after.zoom)).toBeLessThan(0.001);
    expect(Math.abs(before.offsetX - after.offsetX)).toBeLessThan(0.001);
    expect(Math.abs(before.offsetY - after.offsetY)).toBeLessThan(0.001);
  });

  it('returns an identity transform when animation is disabled', () => {
    expect(getAutoCameraTransform(false, 12, 20, 1000, 1800)).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});
