import { describe, expect, it } from 'vitest';
import { createEventSlug, slugifyEventTitle } from './eventSlug';

describe('event slugs', () => {
  it('normalizes event titles for public URLs', () => {
    expect(slugifyEventTitle('Kickstart 2027 #GTM-Planner')).toBe('kickstart-2027-gtm-planner');
    expect(slugifyEventTitle('')).toBe('event');
  });

  it('adds a unique suffix to generated event slugs', () => {
    expect(createEventSlug('Kickstart 2027')).toMatch(/^kickstart-2027-[0-9a-f]{8}$/);
  });
});
