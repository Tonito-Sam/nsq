export type TimeRange = { start: number; end: number };

export function parseMediaDuration(logs: string[]): number | null {
  const durationMatch = logs.join('\n').match(/Duration:\s*(\d{2}):(\d{2}):(\d+(?:\.\d+)?)/);
  if (!durationMatch) return null;

  const duration = Number(durationMatch[1]) * 3600
    + Number(durationMatch[2]) * 60
    + Number(durationMatch[3]);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function parseSilenceRanges(logs: string[], duration: number): TimeRange[] {
  const ranges: TimeRange[] = [];
  let silenceStart: number | null = null;

  logs.forEach((line) => {
    const startMatch = line.match(/silence_start:\s*(-?\d+(?:\.\d+)?)/);
    if (startMatch) {
      silenceStart = Math.max(0, Number(startMatch[1]));
      return;
    }

    const endMatch = line.match(/silence_end:\s*(-?\d+(?:\.\d+)?)/);
    if (endMatch && silenceStart !== null) {
      const end = Math.min(duration, Number(endMatch[1]));
      if (end > silenceStart) ranges.push({ start: silenceStart, end });
      silenceStart = null;
    }
  });

  if (silenceStart !== null && duration > silenceStart) {
    ranges.push({ start: silenceStart, end: duration });
  }
  return ranges;
}

export function getRetainedAudioRanges(
  duration: number,
  silences: TimeRange[],
  minimumSilenceSeconds: number,
  speechPaddingSeconds = 0.12,
): TimeRange[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const removableSilences = silences
    .filter((silence) => silence.end - silence.start >= minimumSilenceSeconds)
    .map((silence) => ({
      start: Math.max(0, Math.min(duration, silence.start + speechPaddingSeconds)),
      end: Math.max(0, Math.min(duration, silence.end - speechPaddingSeconds)),
    }))
    .filter((silence) => silence.end > silence.start)
    .sort((left, right) => left.start - right.start);

  const retained: TimeRange[] = [];
  let cursor = 0;
  removableSilences.forEach((silence) => {
    if (silence.start > cursor) retained.push({ start: cursor, end: silence.start });
    cursor = Math.max(cursor, silence.end);
  });
  if (cursor < duration) retained.push({ start: cursor, end: duration });
  return retained.filter((range) => range.end - range.start >= 0.04);
}

export function buildTimeRangeExpression(ranges: TimeRange[]) {
  return ranges
    .map(({ start, end }) => `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`)
    .join('+');
}
