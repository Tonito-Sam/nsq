export type SharedFeedPostPayload = {
  user_id: string;
  content?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
  post_type?: string;
  share_to_feed: boolean;
  audience?: string;
  categories?: string[] | null;
  created_at: string;
};

export function buildSharedFeedPostPayload({
  userId,
  caption,
  mediaUrl,
  categories,
  audience,
  sourceType = 'video',
}: {
  userId: string;
  caption?: string | null;
  mediaUrl?: string | null;
  categories?: string[] | null;
  audience?: string | null;
  sourceType?: string;
}): SharedFeedPostPayload {
  const normalizedMediaUrl = mediaUrl && mediaUrl.trim() ? mediaUrl.trim() : null;
  const normalizedCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];

  return {
    user_id: userId,
    content: caption?.trim() ?? '',
    media_url: normalizedMediaUrl,
    media_urls: normalizedMediaUrl ? [normalizedMediaUrl] : [],
    post_type: sourceType,
    share_to_feed: true,
    audience: audience || 'public',
    categories: normalizedCategories,
    created_at: new Date().toISOString(),
  };
}

export async function insertSharedFeedPost({
  supabaseClient,
  userId,
  caption,
  mediaUrl,
  categories,
  audience,
  sourceType,
}: {
  supabaseClient: {
    from: (table: string) => {
      insert: (payload: Record<string, any>) => {
        select: () => ({
          single: () => PromiseLike<{ data: any; error: any }>;
        });
      };
    };
  };
  userId: string;
  caption?: string | null;
  mediaUrl?: string | null;
  categories?: string[] | null;
  audience?: string | null;
  sourceType?: string;
}) {
  const payload = buildSharedFeedPostPayload({
    userId,
    caption,
    mediaUrl,
    categories,
    audience,
    sourceType,
  });

  const response = await supabaseClient.from('posts').insert(payload).select().single();
  if (!response.error) {
    return response;
  }

  const fallbackPayload: Record<string, any> = { ...payload };
  delete fallbackPayload.audience;
  delete fallbackPayload.categories;
  delete fallbackPayload.media_urls;

  return supabaseClient.from('posts').insert(fallbackPayload).select().single();
}

export async function insertVideoMoment({
  supabaseClient,
  userId,
  caption,
  description,
  mediaUrl,
}: {
  supabaseClient: {
    from: (table: string) => {
      insert: (payload: Record<string, any>) => {
        select: () => ({
          single: () => PromiseLike<{ data: any; error: any }>;
        });
      };
    };
  };
  userId: string;
  caption?: string | null;
  description?: string | null;
  mediaUrl: string;
}) {
  const content = [caption?.trim(), description?.trim()].filter(Boolean).join('\n\n');
  const response = await supabaseClient.from('posts').insert({
    user_id: userId,
    content,
    media_url: mediaUrl,
    post_type: 'moment',
    moment_type: 'video',
    privacy: 'public',
    share_to_feed: false,
    created_at: new Date().toISOString(),
  }).select().single();

  if (response.error) throw response.error;
  return response.data;
}
