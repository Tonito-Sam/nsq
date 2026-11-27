const express = require('express');

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const VIDEO_EXTENSION = /\.(mp4|webm|mov|ogg|m4v|m3u8|mpd)(?:$|[?#])/i;
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)(?:$|[?#])/i;

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeMediaUrls(post) {
  let urls = post.media_urls;
  if (typeof urls === 'string') {
    try {
      urls = JSON.parse(urls);
    } catch {
      urls = urls.split(',');
    }
  }
  const candidates = Array.isArray(urls) ? [...urls] : [];
  if (post.media_url) candidates.unshift(post.media_url);
  return [...new Set(candidates)]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(isHttpsUrl);
}

function getVideoType(videoUrl) {
  const pathname = new URL(videoUrl).pathname.toLowerCase();
  if (pathname.endsWith('.webm')) return 'video/webm';
  if (pathname.endsWith('.mov')) return 'video/quicktime';
  if (pathname.endsWith('.ogg')) return 'video/ogg';
  if (pathname.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (pathname.endsWith('.mpd')) return 'application/dash+xml';
  return 'video/mp4';
}

function buildPostMetadata(post, postId, siteBase = 'https://www.nexsq.com') {
  if (!post || !['public', ''].includes(String(post.privacy || '').toLowerCase())) return null;

  const mediaUrls = normalizeMediaUrls(post);
  const videoUrl = mediaUrls.find((url) => VIDEO_EXTENSION.test(url))
    || (post.post_type === 'video' ? mediaUrls[0] : null);
  const videoThumbnail = isHttpsUrl(post.video_thumbnail_url) ? post.video_thumbnail_url : null;
  const postImage = mediaUrls.find((url) => IMAGE_EXTENSION.test(url))
    || mediaUrls.find((url) => url !== videoUrl && !VIDEO_EXTENSION.test(url));
  const imageUrl = (videoUrl && videoThumbnail)
    || postImage
    || `${siteBase.replace(/\/$/, '')}/og-nexsq.png`;
  const content = String(post.content || '').replace(/\s+/g, ' ').trim();
  const description = content.slice(0, 300) || 'View this post on NexSq.';

  return {
    title: content.slice(0, 90) || 'Post on NexSq',
    description,
    imageUrl,
    videoUrl,
    videoType: videoUrl ? getVideoType(videoUrl) : null,
    canonicalUrl: `${siteBase.replace(/\/$/, '')}/post/${postId}`,
  };
}

function buildEventMetadata(event, eventSlug, siteBase = 'https://www.nexsq.com') {
  if (
    !event
    || event.post_type !== 'event'
    || !['public', ''].includes(String(event.privacy || '').toLowerCase())
  ) return null;

  const baseUrl = siteBase.replace(/\/$/, '');
  const title = String(event.content || '').replace(/\s+/g, ' ').trim();
  const description = String(event.event_description || '').replace(/\s+/g, ' ').trim();
  const bannerUrl = isHttpsUrl(event.event_banner) ? event.event_banner : null;
  const logoUrl = isHttpsUrl(event.event_logo) ? event.event_logo : null;

  return {
    title: title.slice(0, 90) || 'Event on NexSq',
    description: description.slice(0, 300) || 'View event details and register on NexSq.',
    imageUrl: bannerUrl || logoUrl || `${baseUrl}/og-nexsq.png`,
    canonicalUrl: `${baseUrl}/event/${eventSlug}`,
  };
}

async function loadPost(postId) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceKey) throw new Error('Post OG endpoint requires Supabase server configuration.');

  const url = new URL('/rest/v1/posts', supabaseUrl);
  url.searchParams.set('select', 'content,media_url,media_urls,post_type,privacy,video_thumbnail_url');
  url.searchParams.set('id', `eq.${postId}`);
  url.searchParams.set('limit', '1');
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase posts request failed with status ${response.status}.`);
  const posts = await response.json();
  return posts[0] || null;
}

async function loadEvent(eventSlug) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceKey) throw new Error('Event OG endpoint requires Supabase server configuration.');

  const url = new URL('/rest/v1/posts', supabaseUrl);
  url.searchParams.set('select', 'content,event_slug,event_banner,event_logo,event_description,post_type,privacy');
  url.searchParams.set('event_slug', `eq.${eventSlug}`);
  url.searchParams.set('post_type', 'eq.event');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase event request failed with status ${response.status}.`);
  const events = await response.json();
  return events[0] || null;
}

router.get('/event/:eventSlug/meta', async (req, res) => {
  const { eventSlug } = req.params;
  if (!EVENT_SLUG_PATTERN.test(eventSlug)) return res.status(400).json({ error: 'Invalid event slug.' });

  try {
    const event = await loadEvent(eventSlug);
    const metadata = buildEventMetadata(
      event,
      eventSlug,
      process.env.PUBLIC_SITE_URL || 'https://www.nexsq.com',
    );
    if (!metadata) return res.status(404).json({ error: 'Public event not found.' });
    return res
      .set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      .json(metadata);
  } catch (error) {
    console.error('Event OG metadata request failed:', error);
    return res.status(500).json({ error: 'Could not load event share metadata.' });
  }
});

router.get('/:postId/meta', async (req, res) => {
  const { postId } = req.params;
  if (!UUID_PATTERN.test(postId)) return res.status(400).json({ error: 'Invalid post ID.' });

  try {
    const post = await loadPost(postId);
    const metadata = buildPostMetadata(
      post,
      postId,
      process.env.PUBLIC_SITE_URL || 'https://www.nexsq.com',
    );
    if (!metadata) return res.status(404).json({ error: 'Public post not found.' });
    return res
      .set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      .json(metadata);
  } catch (error) {
    console.error('Post OG metadata request failed:', error);
    return res.status(500).json({ error: 'Could not load post share metadata.' });
  }
});

module.exports = router;
module.exports.buildPostMetadata = buildPostMetadata;
module.exports.buildEventMetadata = buildEventMetadata;
