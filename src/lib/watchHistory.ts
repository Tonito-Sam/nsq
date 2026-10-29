export interface WatchHistoryItem {
  id: string;
  show_id?: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  category?: string;
  lastPlayedAt: string;
}

const WATCH_HISTORY_KEY = 'nexsq-watch-history';

export const getWatchHistory = (): WatchHistoryItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const savedHistory = window.localStorage.getItem(WATCH_HISTORY_KEY);
    if (!savedHistory) return [];

    const parsedHistory: unknown = JSON.parse(savedHistory);
    if (!Array.isArray(parsedHistory)) return [];

    return parsedHistory.filter(
      (item): item is WatchHistoryItem =>
        typeof item?.id === 'string' &&
        typeof item?.title === 'string' &&
        typeof item?.video_url === 'string' &&
        typeof item?.lastPlayedAt === 'string'
    );
  } catch {
    return [];
  }
};

export const recordWatchHistory = (item: Omit<WatchHistoryItem, 'lastPlayedAt'>) => {
  if (typeof window === 'undefined' || !item.video_url) return;

  const historyItem: WatchHistoryItem = {
    ...item,
    lastPlayedAt: new Date().toISOString(),
  };

  try {
    const nextHistory = [
      historyItem,
      ...getWatchHistory().filter((savedItem) => savedItem.id !== item.id),
    ];
    window.localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(nextHistory));
  } catch (error) {
    console.warn('Unable to save watch history', error);
  }
};