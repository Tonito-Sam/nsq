import { describe, expect, it } from 'vitest';
import { buildEventRegistrationsCsv } from './eventRegistrationCsv';

describe('buildEventRegistrationsCsv', () => {
  it('escapes CSV fields and includes organizer questions and answers', () => {
    const csv = buildEventRegistrationsCsv(
      ['Dietary preference'],
      [{
        full_name: 'Ada, "Ace" Lovelace',
        username: 'ada',
        email: 'ada@example.com',
        phone: null,
        custom_answers: ['Vegetarian'],
        created_at: '2026-11-26T12:00:00.000Z',
      }],
    );

    expect(csv).toBe([
      '"Full name","Username","Email","Phone","Registered at","Dietary preference"',
      '"Ada, ""Ace"" Lovelace","ada","ada@example.com","","2026-11-26T12:00:00.000Z","Vegetarian"',
    ].join('\r\n'));
  });
});
