import { describe, it, expect } from 'vitest';
import { computeEpisodeSlots } from '../scheduleGenerator';

describe('computeEpisodeSlots', () => {
  it('generates daily slots for next N days', () => {
    const show = { title: 'Daily Show', schedule_pattern: 'daily', time_slot_start: '08:00', time_slot_end: '09:00' };
    const slots = computeEpisodeSlots(show, 3);
    expect(slots.length).toBe(3);
    slots.forEach(s => {
      expect(s.scheduled_time).toMatch(/T08:00:00$/);
      expect(s.end_time).toMatch(/T09:00:00$/);
      expect(s.title).toContain('Daily Show');
    });
  });

  it('honors weekdays pattern', () => {
    const show = { title: 'Weekday Show', schedule_pattern: 'weekdays', time_slot_start: '10:00' };
    const slots = computeEpisodeSlots(show, 7);
    // should be <=7 and only include weekdays
    expect(slots.every(s => {
      const d = new Date(s.broadcast_date);
      const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      return ['monday','tuesday','wednesday','thursday','friday'].includes(day);
    })).toBe(true);
  });
});
