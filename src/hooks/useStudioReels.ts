import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StudioReelVideo = {
  id: string;
  video_url: string;
  title?: string;
  description?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  creator?: { name: string; avatar_url?: string };
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  categories?: string[];
  created_at?: string;
};

export type UseStudioReelsOptions = {
  selectedCategory?: string;
  activeTab?: 'all' | 'trending';
  highlightId?: string | null;
  highlightedReelFromState?: any;
  pageSize?: number;
};

const STORAGE_BASE_URL = 'https://pfemdshixllwqqajsxxp.supabase.co/storage/v1/object/public/studio-videos';

const getPublicUrl = (path: string): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${STORAGE_BASE_URL}/${path}`;
};

const normalizeVideo = (
  row: any,
  usersById: Record<string, any>,
  channelsById: Record<string, any>
): StudioReelVideo => {
  const owner = usersById[row.user_id] || usersById[row.creator_id] || null;
  const channel = channelsById[row.channel_id] || null;
  return {
    id: String(row.id),
    video_url: getPublicUrl(row.video_url || row.url || row.src || ''),
    title: row.title || row.name || '' ,
    description: row.description || row.caption || '',
    channel_id: row.channel_id || row.user_id || '',
    channel_name: channel?.name || row.channel_name || '',
    user_id: row.user_id || row.creator_id || '',
    creator: owner ? { name: owner.username || owner.name || 'Unknown', avatar_url: owner.avatar_url || '' } : { name: '', avatar_url: '' },
    views_count: row.views || row.views_count || 0,
    likes_count: row.likes || row.likes_count || 0,
    comments_count: row.comments || row.comments_count || 0,
    categories: row.categories || [],
    created_at: row.created_at || row.createdAt || '',
  };
};

export function useStudioReels({
  selectedCategory,
  activeTab = 'all',
  highlightId,
  highlightedReelFromState,
  pageSize = 15,
}: UseStudioReelsOptions) {
  const queryKey = useMemo(
    () => ['studio-videos', selectedCategory || 'All', activeTab, highlightId],
    [selectedCategory, activeTab, highlightId]
  );

  const queryFn = async ({ pageParam = 0 }): Promise<{ videos: StudioReelVideo[]; nextPage?: number }> => {
    let query = supabase
      .from('studio_videos')
      .select('id, video_url, url, src, user_id, creator_id, channel_id, title, description, caption, views, views_count, likes, likes_count, comments, comments_count, categories, created_at, createdAt')
      .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);

    if (activeTab === 'trending') {
      query = query.order('views', { ascending: false }).order('likes', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (selectedCategory && selectedCategory !== 'All') {
      query = query.contains('categories', [selectedCategory]);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = data || [];
    const ownerIds = Array.from(
      new Set(rows.flatMap((row: any) => [row.user_id, row.creator_id]).filter(Boolean))
    );
    const channelIds = Array.from(new Set(rows.map((row: any) => row.channel_id).filter(Boolean)));

    const [usersResp, channelsResp] = await Promise.all([
      ownerIds.length ? supabase.from('users').select('id, username, avatar_url').in('id', ownerIds) : Promise.resolve({ data: [] }),
      channelIds.length ? supabase.from('studio_channels').select('id, name').in('id', channelIds) : Promise.resolve({ data: [] }),
    ] as any);

    const usersById: Record<string, any> = {};
    (usersResp.data || []).forEach((user: any) => { usersById[user.id] = user; });

    const channelsById: Record<string, any> = {};
    (channelsResp.data || []).forEach((channel: any) => { channelsById[channel.id] = channel; });

    let videos = rows.map((row: any) => normalizeVideo(row, usersById, channelsById));

    if (highlightId && pageParam === 0) {
      const idx = videos.findIndex((video) => String(video.id) === String(highlightId));
      if (idx > -1) {
        const [highlighted] = videos.splice(idx, 1);
        videos.unshift(highlighted);
      }
    }

    if (highlightedReelFromState && pageParam === 0) {
      const exists = videos.some((video) => String(video.id) === String(highlightedReelFromState.id));
      if (!exists) {
        const stateVideo = normalizeVideo(highlightedReelFromState, usersById, channelsById);
        videos.unshift(stateVideo);
      }
    }

    return {
      videos,
      nextPage: rows.length === pageSize ? pageParam + 1 : undefined,
    };
  };

  const query = useInfiniteQuery({
    queryKey,
    queryFn,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const videos = useMemo(
    () => query.data?.pages.flatMap((page) => page.videos) ?? [],
    [query.data]
  );

  return {
    ...query,
    videos,
  };
}
