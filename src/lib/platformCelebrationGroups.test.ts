import { describe, expect, it } from 'vitest';
import { groupPlatformCelebrations } from './platformCelebrationGroups';

describe('groupPlatformCelebrations', () => {
  it('combines platform celebrations on the same event date in feed order', () => {
    const grouped = groupPlatformCelebrations([
      {
        id: 'post-1',
        created_at: '2026-10-15T08:00:00Z',
        is_platform_celebration: true,
        moment_special_name: 'Community Day',
        moment_special_message: 'Celebrate together',
        platform_special_day: { event_date: '2026-10-15', country_code: 'ZA' },
      },
      {
        id: 'post-2',
        created_at: '2026-10-15T08:01:00Z',
        is_platform_celebration: true,
        moment_special_name: 'Culture Day',
        platform_special_day: { event_date: '2026-10-15', country_code: 'GH' },
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].id).toBe('post-1');
    expect(grouped[0].special_day_events).toMatchObject([
      { id: 'post-1', name: 'Community Day', countryCode: 'ZA' },
      { id: 'post-2', name: 'Culture Day', countryCode: 'GH' },
    ]);
  });

  it('keeps different event dates and ordinary posts separate', () => {
    const grouped = groupPlatformCelebrations([
      {
        id: 'post-1',
        created_at: '2026-10-15T08:00:00Z',
        is_platform_celebration: true,
        platform_special_day: { event_date: '2026-10-15' },
      },
      {
        id: 'ordinary',
        created_at: '2026-10-15T08:01:00Z',
      },
      {
        id: 'post-2',
        created_at: '2026-10-16T08:00:00Z',
        is_platform_celebration: true,
        platform_special_day: { event_date: '2026-10-16' },
      },
    ]);

    expect(grouped.map((post) => post.id)).toEqual(['post-1', 'ordinary', 'post-2']);
    expect(grouped[0].special_day_events).toHaveLength(1);
    expect(grouped[2].special_day_events).toHaveLength(1);
  });

  it('does not add duplicate event posts to a carousel', () => {
    const post = {
      id: 'post-1',
      created_at: '2026-10-15T08:00:00Z',
      is_platform_celebration: true,
      platform_special_day: { event_date: '2026-10-15' },
    };

    const grouped = groupPlatformCelebrations([post, post]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].special_day_events).toHaveLength(1);
  });
});