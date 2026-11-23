import { describe, expect, it } from 'vitest';
import {
  getActiveLinearTvOccurrence,
  getNextLinearTvPlaylistIndex,
  getLinearTvPlaylistPosition,
  getMostRecentLinearTvOccurrence,
  getNextLinearTvOccurrence,
} from '../linearTvSchedule';

describe('linear NexSq TV schedule', () => {
  it('finds the active weekly show and its elapsed wall-clock time', () => {
    const active = getActiveLinearTvOccurrence(
      [{
        id: 'morning-show',
        schedulePattern: 'weekly',
        daysOfWeek: ['Monday'],
        timeSlotStart: '09:00',
        timeSlotEnd: '10:30',
      }],
      new Date('2026-11-23T09:30:00+02:00'),
    );

    expect(active).toMatchObject({
      occurrenceKey: 'morning-show:2026-11-23:32400',
      elapsedSeconds: 1800,
      remainingSeconds: 3600,
    });
  });

  it('keeps an overnight slot attached to the day it began', () => {
    const active = getActiveLinearTvOccurrence(
      [{
        id: 'late-show',
        schedulePattern: 'weekly',
        daysOfWeek: ['Sunday'],
        timeSlotStart: '23:00',
        timeSlotEnd: '01:00',
      }],
      new Date('2026-11-23T00:30:00+02:00'),
    );

    expect(active).toMatchObject({
      occurrenceKey: 'late-show:2026-11-22:82800',
      elapsedSeconds: 5400,
      remainingSeconds: 1800,
    });
  });

  it('switches to the program starting exactly at a slot boundary', () => {
    const active = getActiveLinearTvOccurrence(
      [
        {
          id: 'morning-show',
          schedulePattern: 'daily',
          timeSlotStart: '09:00',
          timeSlotEnd: '10:30',
        },
        {
          id: 'midday-show',
          schedulePattern: 'daily',
          timeSlotStart: '10:30',
          timeSlotEnd: '12:00',
        },
      ],
      new Date('2026-11-23T10:30:00+02:00'),
    );

    expect(active?.schedule.id).toBe('midday-show');
    expect(active?.elapsedSeconds).toBe(0);
  });

  it('finds the next scheduled program in the channel timezone', () => {
    const upcoming = getNextLinearTvOccurrence(
      [{
        id: 'morning-show',
        schedulePattern: 'weekdays',
        timeSlotStart: '09:00',
        timeSlotEnd: '10:00',
      }],
      new Date('2026-11-23T08:30:00+02:00'),
    );

    expect(upcoming?.occurrenceKey).toBe('morning-show:2026-11-23:32400');
    expect(upcoming?.elapsedSeconds).toBe(0);
  });

  it('keeps the previous program playing through an unscheduled gap', () => {
    const schedules = [
      {
        id: 'morning-show',
        schedulePattern: 'daily',
        timeSlotStart: '09:00',
        timeSlotEnd: '10:00',
      },
      {
        id: 'afternoon-show',
        schedulePattern: 'daily',
        timeSlotStart: '14:00',
        timeSlotEnd: '15:00',
      },
    ];
    const now = new Date('2026-11-23T12:00:00+02:00');
    const previous = getMostRecentLinearTvOccurrence(schedules, now);
    const upcoming = getNextLinearTvOccurrence(schedules, now);

    expect(previous).toMatchObject({
      schedule: { id: 'morning-show' },
      occurrenceKey: 'morning-show:2026-11-23:32400',
      elapsedSeconds: 10800,
      remainingSeconds: -7200,
    });
    expect(upcoming?.schedule.id).toBe('afternoon-show');
  });

  it('does not start a future one-off slot early when no previous slot exists', () => {
    const previous = getMostRecentLinearTvOccurrence(
      [{
        id: 'future-show',
        scheduledTime: '2026-11-24T09:00:00+02:00',
        endTime: '2026-11-24T10:00:00+02:00',
      }],
      new Date('2026-11-23T12:00:00+02:00'),
    );

    expect(previous).toBeNull();
  });

  it('selects the episode and seek offset for the current playlist position', () => {
    expect(getLinearTvPlaylistPosition([60, 90, 30], 75)).toEqual({
      episodeIndex: 1,
      offsetSeconds: 15,
    });
    expect(getLinearTvPlaylistPosition([60, 90], 150)).toEqual({
      episodeIndex: 0,
      offsetSeconds: 0,
    });
  });

  it('does not claim to time-sync a playlist with unknown episode durations', () => {
    expect(getLinearTvPlaylistPosition([60, 0, 90], 75)).toBeNull();
  });

  it('advances through the playlist in order when episode durations are unknown', () => {
    const playlistIndexes = [4, 5, 6];
    expect(getNextLinearTvPlaylistIndex(playlistIndexes, 4)).toBe(5);
    expect(getNextLinearTvPlaylistIndex(playlistIndexes, 5)).toBe(6);
    expect(getNextLinearTvPlaylistIndex(playlistIndexes, 6)).toBe(4);
  });
});
