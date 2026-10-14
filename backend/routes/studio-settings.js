const express = require('express');
const axios = require('axios');

const router = express.Router();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const SOCIAL_HOSTS = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  linkedin: ['linkedin.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  x: ['x.com', 'twitter.com'],
};

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

router.put('/:channelId/settings', async (req, res) => {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Sign in to update Studio settings' });
  if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(503).json({ error: 'Studio settings are not configured on the server' });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.channelId)) return res.status(400).json({ error: 'Invalid channel id' });

  try {
    const authResponse = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
    const userId = authResponse.data?.id;
    if (!userId) return res.status(401).json({ error: 'Your session is invalid or expired' });

    const channelQuery = new URLSearchParams({
      select: 'id',
      id: `eq.${req.params.channelId}`,
      user_id: `eq.${userId}`,
      limit: '1',
    });
    const channelResponse = await axios.get(`${SUPABASE_URL}/rest/v1/studio_channels?${channelQuery}`, {
      headers: serviceHeaders(),
    });
    if (!channelResponse.data?.length) return res.status(404).json({ error: 'Studio channel not found' });

    const body = req.body || {};
    const patch = {};
    if (Object.hasOwn(body, 'name')) {
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Channel name must be 2 to 80 characters' });
      patch.name = name;
    }
    if (Object.hasOwn(body, 'description')) {
      const description = String(body.description || '').trim();
      if (description.length > 2000) return res.status(400).json({ error: 'Description must be 2,000 characters or fewer' });
      patch.description = description;
    }
    if (Object.hasOwn(body, 'category')) {
      const category = String(body.category || '').trim();
      if (category.length > 80) return res.status(400).json({ error: 'Category is too long' });
      patch.category = category || null;
    }
    for (const key of ['avatar_url', 'cover_url']) {
      if (!Object.hasOwn(body, key)) continue;
      const imageUrl = String(body[key] || '').trim();
      if (!imageUrl) {
        patch[key] = null;
        continue;
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return res.status(400).json({ error: `Invalid Studio ${key === 'avatar_url' ? 'avatar' : 'cover'} URL` });
      }
      const supabaseHost = new URL(SUPABASE_URL).host;
      const requiredPath = `/storage/v1/object/public/studio-videos/${req.params.channelId}/`;
      if (parsedUrl.protocol !== 'https:' || parsedUrl.host !== supabaseHost || !parsedUrl.pathname.startsWith(requiredPath)) {
        return res.status(400).json({ error: `Studio ${key === 'avatar_url' ? 'avatar' : 'cover'} must be uploaded to the Studio media bucket` });
      }
      patch[key] = parsedUrl.toString();
    }
    if (Object.hasOwn(body, 'social_links')) {
      if (!body.social_links || typeof body.social_links !== 'object' || Array.isArray(body.social_links)) {
        return res.status(400).json({ error: 'Social links must be an object' });
      }
      const links = {};
      for (const [platform, value] of Object.entries(SOCIAL_HOSTS)) {
        const rawUrl = String(body.social_links[platform] || '').trim();
        if (!rawUrl) {
          links[platform] = null;
          continue;
        }
        let parsedUrl;
        try {
          parsedUrl = new URL(rawUrl);
        } catch {
          return res.status(400).json({ error: `Enter a valid ${platform} profile URL` });
        }
        const host = parsedUrl.hostname.toLowerCase();
        if (parsedUrl.protocol !== 'https:' || !value.some(domain => host === domain || host.endsWith(`.${domain}`))) {
          return res.status(400).json({ error: `Enter a valid HTTPS ${platform} profile URL` });
        }
        links[platform] = parsedUrl.toString();
      }
      patch.social_links = links;
    }
    for (const key of ['donation_enabled', 'subscription_enabled']) {
      if (Object.hasOwn(body, key)) {
        if (typeof body[key] !== 'boolean') return res.status(400).json({ error: `Invalid ${key} value` });
        if (body[key]) {
          const [videosResponse, subscribersResponse] = await Promise.all([
            axios.get(`${SUPABASE_URL}/rest/v1/studio_videos?select=views&channel_id=eq.${encodeURIComponent(req.params.channelId)}`, {
              headers: serviceHeaders(),
            }),
            axios.get(`${SUPABASE_URL}/rest/v1/studio_channel_subscribers?select=channel_id&channel_id=eq.${encodeURIComponent(req.params.channelId)}`, {
              headers: serviceHeaders({ Prefer: 'count=exact', Range: '0-0' }),
            }),
          ]);
          const totalViews = (videosResponse.data || []).reduce((sum, video) => sum + Number(video.views || 0), 0);
          const subscriberTotal = Number(subscribersResponse.headers['content-range']?.split('/')[1] || 0);
          if (totalViews < 10000 || subscriberTotal < 2000) {
            return res.status(403).json({ error: 'Monetization requires at least 10,000 views and 2,000 subscribers' });
          }
        }
        patch[key] = body[key];
      }
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No settings provided' });

    const updateQuery = new URLSearchParams({
      id: `eq.${req.params.channelId}`,
      user_id: `eq.${userId}`,
      select: '*',
    });
    const updateResponse = await axios.patch(
      `${SUPABASE_URL}/rest/v1/studio_channels?${updateQuery}`,
      patch,
      { headers: serviceHeaders({ Prefer: 'return=representation' }) }
    );
    return res.json({ channel: updateResponse.data?.[0] || null });
  } catch (error) {
    const status = error.response?.status || 500;
    const message = status === 401 ? 'Your session is invalid or expired' : error.response?.data?.message || 'Could not save Studio settings';
    if (status >= 500) console.error('Studio settings error:', error.response?.data || error.message);
    return res.status(status).json({ error: message });
  }
});

module.exports = router;
