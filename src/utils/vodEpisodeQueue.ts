export interface VodQueueEpisode {
  id: string;
  created_at: string;
  video_url?: string | null;
  scheduled_time?: string | null;
  air_time?: string | null;
  published_at?: string | null;
  is_live?: boolean;
  is_active?: boolean;
}

function hasAired(episode: VodQueueEpisode, nowMs: number): boolean {
  if (episode.is_live || episode.is_active === false || !episode.video_url?.trim()) return false;
  const dateValue = episode.scheduled_time
    || episode.air_time
    || episode.published_at
    || episode.created_at;
  const episodeTime = Date.parse(dateValue);
  return !Number.isFinite(episodeTime) || episodeTime <= nowMs;
}

export function getVodEpisodeQueue<T extends VodQueueEpisode>(
  episodes: readonly T[],
  selectedEpisodeId?: string,
  nowMs = Date.now(),
): T[] {
  const uniqueEpisodes = new Map<string, T>();
  episodes.filter((episode) => hasAired(episode, nowMs)).forEach((episode) => {
    if (!uniqueEpisodes.has(episode.id)) uniqueEpisodes.set(episode.id, episode);
  });

  const orderedEpisodes = Array.from(uniqueEpisodes.values()).sort((first, second) =>
    Date.parse(first.created_at) - Date.parse(second.created_at)
    || first.id.localeCompare(second.id),
  );
  const selectedIndex = selectedEpisodeId
    ? orderedEpisodes.findIndex((episode) => episode.id === selectedEpisodeId)
    : 0;
  return selectedIndex < 0 ? [] : orderedEpisodes.slice(selectedIndex);
}
