export interface PlatformCelebrationSource {
  id: string;
  created_at: string;
  is_platform_celebration?: boolean | null;
  moment_special_name?: string | null;
  moment_special_message?: string | null;
  moment_special_icon?: string | null;
  moment_special_bg?: string | null;
  moment_bg?: string | null;
  platform_special_day?: PlatformSpecialDayRelation | null;
}

export interface PlatformSpecialDayRelation {
  event_date?: string | null;
  country_code?: string | null;
  name?: string | null;
  local_name?: string | null;
  description?: string | null;
  icon?: string | null;
  background?: string | null;
}

export interface PlatformCelebrationSlide {
  id: string;
  name: string;
  description: string;
  icon: string;
  background: string | null;
  countryCode: string | null;
}

export type GroupedPlatformCelebration<T> = T & {
  special_day_events?: PlatformCelebrationSlide[];
};

function getSpecialDay(post: PlatformCelebrationSource) {
  const relation = post.platform_special_day;
  return Array.isArray(relation) ? relation[0] : relation;
}

export function groupPlatformCelebrations<T extends PlatformCelebrationSource>(
  posts: readonly T[],
): GroupedPlatformCelebration<T>[] {
  const grouped: GroupedPlatformCelebration<T>[] = [];
  const groupIndexByDate = new Map<string, number>();
  const seenEventIdsByDate = new Map<string, Set<string>>();

  for (const post of posts) {
    if (!post.is_platform_celebration) {
      grouped.push(post);
      continue;
    }

    const specialDay = getSpecialDay(post);
    const eventDate = specialDay?.event_date || post.created_at.slice(0, 10);
    if (!eventDate) {
      grouped.push(post);
      continue;
    }

    const seenEventIds = seenEventIdsByDate.get(eventDate) || new Set<string>();
    if (seenEventIds.has(post.id)) continue;
    seenEventIds.add(post.id);
    seenEventIdsByDate.set(eventDate, seenEventIds);

    const slide: PlatformCelebrationSlide = {
      id: post.id,
      name: post.moment_special_name || specialDay?.local_name || specialDay?.name || 'Special day',
      description: post.moment_special_message || specialDay?.description || '',
      icon: post.moment_special_icon || specialDay?.icon || '🎉',
      background: post.moment_special_bg || post.moment_bg || specialDay?.background || null,
      countryCode: specialDay?.country_code || null,
    };

    const groupIndex = groupIndexByDate.get(eventDate);
    if (groupIndex === undefined) {
      groupIndexByDate.set(eventDate, grouped.length);
      grouped.push({ ...post, special_day_events: [slide] });
      continue;
    }

    const existing = grouped[groupIndex];
    grouped[groupIndex] = {
      ...existing,
      special_day_events: [...(existing.special_day_events || []), slide],
    };
  }

  return grouped;
}