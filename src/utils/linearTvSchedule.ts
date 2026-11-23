export const TV_SCHEDULE_TIME_ZONE = 'Africa/Johannesburg';

export type LinearTvSchedule = {
  id: string;
  schedulePattern?: string | null;
  daysOfWeek?: string[] | string | null;
  timeSlotStart?: string | null;
  timeSlotEnd?: string | null;
  scheduledTime?: string | null;
  endTime?: string | null;
};

export type LinearTvOccurrence = {
  schedule: LinearTvSchedule;
  occurrenceKey: string;
  elapsedSeconds: number;
  remainingSeconds: number;
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseClock(value?: string | null): number | null {
  const match = value?.match(/(?:^|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseDays(value?: string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map((day) => day.trim().toLowerCase()).filter(Boolean);
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((day) => String(day).trim().toLowerCase()).filter(Boolean);
  } catch {
    return value.split(',').map((day) => day.trim().toLowerCase()).filter(Boolean);
  }
  return value.split(',').map((day) => day.trim().toLowerCase()).filter(Boolean);
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    year,
    month,
    day,
    dateOrdinal: Math.floor(Date.UTC(year, month - 1, day) / 86_400_000),
    dayName: values.weekday.toLowerCase(),
    secondsOfDay: Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second),
  };
}

function getDateAtZonedTime(dateOrdinal: number, secondsOfDay: number, timeZone: string): Date {
  const wallTime = dateOrdinal * 86_400_000 + secondsOfDay * 1000;
  let timestamp = wallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedParts(new Date(timestamp), timeZone);
    const observedWallTime = zoned.dateOrdinal * 86_400_000 + zoned.secondsOfDay * 1000;
    timestamp += wallTime - observedWallTime;
  }
  return new Date(timestamp);
}

function occursOnDay(schedule: LinearTvSchedule, dayName: string): boolean {
  const pattern = schedule.schedulePattern?.trim().toLowerCase();
  const days = parseDays(schedule.daysOfWeek);
  if (pattern === 'daily') return true;
  if (pattern === 'weekdays') return !['saturday', 'sunday'].includes(dayName);
  if (pattern === 'weekly' && days.length === 0) return true;
  return days.includes(dayName);
}

export function getActiveLinearTvOccurrence(
  schedules: LinearTvSchedule[],
  now: Date = new Date(),
  timeZone = TV_SCHEDULE_TIME_ZONE,
): LinearTvOccurrence | null {
  const current = getZonedParts(now, timeZone);
  const active: LinearTvOccurrence[] = [];

  schedules.forEach((schedule) => {
    const pattern = schedule.schedulePattern?.trim().toLowerCase();
    const hasRecurringDays = pattern === 'daily'
      || pattern === 'weekdays'
      || pattern === 'weekly'
      || parseDays(schedule.daysOfWeek).length > 0;
    const startSeconds = parseClock(schedule.timeSlotStart);
    const endSeconds = parseClock(schedule.timeSlotEnd);

    if (hasRecurringDays && startSeconds !== null && endSeconds !== null && startSeconds !== endSeconds) {
      const durationSeconds = (endSeconds > startSeconds ? endSeconds : endSeconds + 86_400) - startSeconds;
      [-1, 0].forEach((dayOffset) => {
        const startDate = new Date((current.dateOrdinal + dayOffset) * 86_400_000);
        const dayName = WEEKDAYS[startDate.getUTCDay()];
        if (!occursOnDay(schedule, dayName)) return;

        const elapsedSeconds = -dayOffset * 86_400 + current.secondsOfDay - startSeconds;
        if (elapsedSeconds < 0 || elapsedSeconds >= durationSeconds) return;

        const dateKey = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startDate.getUTCDate()).padStart(2, '0')}`;
        active.push({
          schedule,
          occurrenceKey: `${schedule.id}:${dateKey}:${startSeconds}`,
          elapsedSeconds,
          remainingSeconds: durationSeconds - elapsedSeconds,
        });
      });
      return;
    }

    if (hasRecurringDays || !schedule.scheduledTime || !schedule.endTime) return;
    const start = Date.parse(schedule.scheduledTime);
    const end = Date.parse(schedule.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const nowTime = now.getTime();
    if (nowTime < start || nowTime >= end) return;
    active.push({
      schedule,
      occurrenceKey: `${schedule.id}:${start}`,
      elapsedSeconds: (nowTime - start) / 1000,
      remainingSeconds: (end - nowTime) / 1000,
    });
  });

  return active.sort((first, second) =>
    first.elapsedSeconds - second.elapsedSeconds
    || first.schedule.id.localeCompare(second.schedule.id)
  )[0] || null;
}

export function getMostRecentLinearTvOccurrence(
  schedules: LinearTvSchedule[],
  now: Date = new Date(),
  timeZone = TV_SCHEDULE_TIME_ZONE,
): LinearTvOccurrence | null {
  const current = getZonedParts(now, timeZone);
  const previous: LinearTvOccurrence[] = [];

  schedules.forEach((schedule) => {
    const pattern = schedule.schedulePattern?.trim().toLowerCase();
    const hasRecurringDays = pattern === 'daily'
      || pattern === 'weekdays'
      || pattern === 'weekly'
      || parseDays(schedule.daysOfWeek).length > 0;
    const startSeconds = parseClock(schedule.timeSlotStart);
    const endSeconds = parseClock(schedule.timeSlotEnd);

    if (hasRecurringDays && startSeconds !== null && endSeconds !== null && startSeconds !== endSeconds) {
      const durationSeconds = (endSeconds > startSeconds ? endSeconds : endSeconds + 86_400) - startSeconds;
      for (let dayOffset = -7; dayOffset <= 0; dayOffset += 1) {
        const startDateOrdinal = current.dateOrdinal + dayOffset;
        const startDate = new Date(startDateOrdinal * 86_400_000);
        const dayName = WEEKDAYS[startDate.getUTCDay()];
        if (!occursOnDay(schedule, dayName)) continue;

        const startTime = getDateAtZonedTime(startDateOrdinal, startSeconds, timeZone);
        if (startTime.getTime() > now.getTime()) continue;
        const elapsedSeconds = -dayOffset * 86_400 + current.secondsOfDay - startSeconds;
        if (elapsedSeconds < 0) continue;

        const dateKey = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startDate.getUTCDate()).padStart(2, '0')}`;
        previous.push({
          schedule,
          occurrenceKey: `${schedule.id}:${dateKey}:${startSeconds}`,
          elapsedSeconds,
          remainingSeconds: durationSeconds - elapsedSeconds,
        });
      }
      return;
    }

    if (hasRecurringDays || !schedule.scheduledTime || !schedule.endTime) return;
    const start = Date.parse(schedule.scheduledTime);
    const end = Date.parse(schedule.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start > now.getTime()) return;

    previous.push({
      schedule,
      occurrenceKey: `${schedule.id}:${start}`,
      elapsedSeconds: (now.getTime() - start) / 1000,
      remainingSeconds: (end - now.getTime()) / 1000,
    });
  });

  return previous.sort((first, second) =>
    first.elapsedSeconds - second.elapsedSeconds
    || first.schedule.id.localeCompare(second.schedule.id)
  )[0] || null;
}

export function getNextLinearTvOccurrence(
  schedules: LinearTvSchedule[],
  now: Date = new Date(),
  timeZone = TV_SCHEDULE_TIME_ZONE,
): LinearTvOccurrence | null {
  const current = getZonedParts(now, timeZone);
  const upcoming: Array<{ occurrence: LinearTvOccurrence; startsAt: number }> = [];

  schedules.forEach((schedule) => {
    const pattern = schedule.schedulePattern?.trim().toLowerCase();
    const hasRecurringDays = pattern === 'daily'
      || pattern === 'weekdays'
      || pattern === 'weekly'
      || parseDays(schedule.daysOfWeek).length > 0;
    const startSeconds = parseClock(schedule.timeSlotStart);
    const endSeconds = parseClock(schedule.timeSlotEnd);

    if (hasRecurringDays && startSeconds !== null && endSeconds !== null && startSeconds !== endSeconds) {
      const durationSeconds = (endSeconds > startSeconds ? endSeconds : endSeconds + 86_400) - startSeconds;
      for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
        const startDateOrdinal = current.dateOrdinal + dayOffset;
        const startDate = new Date(startDateOrdinal * 86_400_000);
        const dayName = WEEKDAYS[startDate.getUTCDay()];
        if (!occursOnDay(schedule, dayName)) continue;
        const startsAt = getDateAtZonedTime(startDateOrdinal, startSeconds, timeZone).getTime();
        if (startsAt <= now.getTime()) continue;
        const dateKey = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startDate.getUTCDate()).padStart(2, '0')}`;
        upcoming.push({
          startsAt,
          occurrence: {
            schedule,
            occurrenceKey: `${schedule.id}:${dateKey}:${startSeconds}`,
            elapsedSeconds: 0,
            remainingSeconds: durationSeconds,
          },
        });
        break;
      }
      return;
    }

    if (hasRecurringDays || !schedule.scheduledTime || !schedule.endTime) return;
    const start = Date.parse(schedule.scheduledTime);
    const end = Date.parse(schedule.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= now.getTime() || end <= start) return;
    upcoming.push({
      startsAt: start,
      occurrence: {
        schedule,
        occurrenceKey: `${schedule.id}:${start}`,
        elapsedSeconds: 0,
        remainingSeconds: (end - start) / 1000,
      },
    });
  });

  return upcoming.sort((first, second) =>
    first.startsAt - second.startsAt
    || first.occurrence.schedule.id.localeCompare(second.occurrence.schedule.id)
  )[0]?.occurrence || null;
}

export function getLinearTvPlaylistPosition(
  episodeDurations: number[],
  elapsedSeconds: number,
): { episodeIndex: number; offsetSeconds: number } | null {
  if (
    !episodeDurations.length
    || episodeDurations.some((duration) => !Number.isFinite(duration) || duration <= 0)
    || !Number.isFinite(elapsedSeconds)
    || elapsedSeconds < 0
  ) return null;

  const playlistDuration = episodeDurations.reduce((total, duration) => total + duration, 0);
  let offset = elapsedSeconds % playlistDuration;
  for (let episodeIndex = 0; episodeIndex < episodeDurations.length; episodeIndex += 1) {
    if (offset < episodeDurations[episodeIndex]) return { episodeIndex, offsetSeconds: offset };
    offset -= episodeDurations[episodeIndex];
  }
  return { episodeIndex: 0, offsetSeconds: 0 };
}

export function getNextLinearTvPlaylistIndex(
  playlistIndexes: number[],
  currentIndex: number,
): number | null {
  if (!playlistIndexes.length) return null;
  const currentPosition = playlistIndexes.indexOf(currentIndex);
  return playlistIndexes[(currentPosition + 1) % playlistIndexes.length];
}
