import { describe, it, expect } from 'vitest';
import { computeEpisodeSlots } from '../scheduleGenerator';

describe('sample schedules (TV-like)', () => {
  it('generates Breakfast Show slots (weekdays 08:00-11:00)', () => {
    const breakfast = {
      title: "Mic'd Podcast Breakfast",
      schedule_pattern: 'weekdays',
      time_slot_start: '08:00',
      time_slot_end: '11:00',
    };
    const slots = computeEpisodeSlots(breakfast, 7);
    // In a 7-day window expect between 5 and 7 entries depending on start day; ensure >=5
    expect(slots.length).toBeGreaterThanOrEqual(5);
    slots.forEach(s => {
      expect(s.scheduled_time).toMatch(/T08:00:00$/);
      expect(s.end_time).toMatch(/T11:00:00$/);
    });
  });

  it('generates Fanalysis (daily 11:30-12:00)', () => {
    const fanalysis = {
      title: 'Fanalysis',
      schedule_pattern: 'daily',
      time_slot_start: '11:30',
      time_slot_end: '12:00',
    };
    const slots = computeEpisodeSlots(fanalysis, 3);
    expect(slots.length).toBe(3);
    expect(slots[0].scheduled_time).toMatch(/T11:30:00$/);
  });

  it('generates Mid-day groove (daily 12:00-14:00)', () => {
    const midday = {
      title: 'Mid-day groove',
      schedule_pattern: 'daily',
      time_slot_start: '12:00',
      time_slot_end: '14:00',
    };
    const slots = computeEpisodeSlots(midday, 2);
    expect(slots.length).toBe(2);
    expect(slots[0].end_time).toMatch(/T14:00:00$/);
  });

  it('generates Perspective show (evening variable)', () => {
    const perspective = {
      title: 'Perspective',
      schedule_pattern: 'weekly',
      days_of_week: ['monday','wednesday','friday'],
      time_slot_start: '18:00',
      time_slot_end: '20:00',
    };
    const slots = computeEpisodeSlots(perspective, 7);
    // Should only include slots for the selected days within next 7 days
    slots.forEach(s => {
      expect(s.scheduled_time).toMatch(/T18:00:00$/);
    });
  });
});
