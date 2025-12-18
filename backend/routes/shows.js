const express = require('express');
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  try {
    const nf = require('node-fetch');
    fetchFn = nf && nf.default ? nf.default : nf;
  } catch (e) {
    fetchFn = undefined;
    console.warn('node-fetch is not available; shows route requires fetch.');
  }
}

const router = express.Router();

// Helper to build order param
const sortMap = {
  newest: 'created_at.desc',
  oldest: 'created_at.asc',
  'most-viewed': 'views.desc',
  longest: 'duration.desc',
  shortest: 'duration.asc',
};

// GET /api/shows/past/all?page=&limit=&sort=&filter=&search=
router.get('/past/all', async (req, res) => {
  try {
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!SUPABASE_URL) return res.status(500).json({ error: 'missing SUPABASE_URL on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(req.query.limit || '12', 10)), 100);
    const offset = (page - 1) * limit;
    const sort = (req.query.sort && sortMap[req.query.sort]) ? sortMap[req.query.sort] : sortMap['newest'];
    const search = req.query.search ? String(req.query.search).trim() : '';

    // Basic filter: only non-live (past) and active episodes
    // Also allow filtering by "recent" which will return last 7 days
    const filter = req.query.filter || 'all';

    let url = `${SUPABASE_URL}/rest/v1/studio_episodes?select=*`;
    // Only active episodes
    url += `&is_active=eq.true`;

    // Search across title and description if provided (best-effort)
    if (search) {
      try {
        const s = encodeURIComponent(`title.ilike.*${search}* ,description.ilike.*${search}*`);
        url += `&or=(${s})`;
      } catch (e) {
        // ignore search building errors and fall back to no server-side search
      }
    }

    // Ordering, limit and offset
    url += `&order=${encodeURIComponent(sort)}`;
    url += `&limit=${limit}&offset=${offset}`;

    const resp = await fetchFn(url, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      }
    });

    const text = await resp.text();
    if (!resp.ok) return res.status(502).json({ error: 'supabase read failed', status: resp.status, body: text });
    let episodes = JSON.parse(text || '[]');

    // Filter out known "live" rows if the column exists, and filter future-scheduled items
    try {
      const now = Date.now();
      episodes = episodes.filter(ep => {
        if (ep.is_live === true) return false;
        const dateStr = ep.scheduled_time || ep.air_time || ep.published_at || ep.created_at;
        if (!dateStr) return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        // only include items that are not in the future
        return d.getTime() <= now;
      });
    } catch (e) {
      // if anything goes wrong, leave episodes as-is
    }

    // Collect show ids to fetch show metadata
    const showIds = Array.from(new Set(episodes.map(e => e.show_id).filter(Boolean)));
    let showsMap = {};
    if (showIds.length > 0) {
      const ids = showIds.map(id => encodeURIComponent(id)).join(',');
      // Include video_url so we can fall back to the show's video when episode has none
      const showsUrl = `${SUPABASE_URL}/rest/v1/studio_shows?id=in.(${ids})&select=id,title,thumbnail_url,video_url,category`;
      const sresp = await fetchFn(showsUrl, {
        method: 'GET',
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
      });
      const stext = await sresp.text();
      if (sresp.ok) {
        const shows = JSON.parse(stext || '[]');
        showsMap = shows.reduce((m, s) => { m[s.id] = s; return m; }, {});
      }
    }

    // Map episodes to frontend shape and attach show metadata
    const mapped = episodes.map(ep => ({
      id: ep.id,
      show_id: ep.show_id,
      show_title: showsMap[ep.show_id]?.title || null,
      show_thumbnail: showsMap[ep.show_id]?.thumbnail_url || null,
      title: ep.title || ep.name || '',
      description: ep.description || null,
      duration: ep.duration || null,
      thumbnail_url: ep.thumbnail_url || ep.cover || null,
      // Prefer episode.video_url, then episode.source_url, then fall back to the show's video_url
      video_url: ep.video_url || ep.source_url || showsMap[ep.show_id]?.video_url || null,
      views: ep.views || 0,
      scheduled_time: ep.scheduled_time || null,
      air_time: ep.air_time || null,
      published_at: ep.published_at || ep.created_at || null,
      created_at: ep.created_at || new Date().toISOString(),
      is_live: !!ep.is_live,
      is_active: !!ep.is_active,
      tags: ep.tags || null,
      category: ep.category || null,
      show_category: showsMap[ep.show_id]?.category || null,
    }));

    // Simple hasMore estimate: if we returned exactly limit items, assume there may be more
    const hasMore = mapped.length === limit;
    return res.json({ episodes: mapped, hasMore });
  } catch (err) {
    console.error('shows.past.all error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// GET /api/shows/:showId/episodes?page=&limit=&sort=&filter=&search=
router.get('/:showId/episodes', async (req, res) => {
  try {
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!SUPABASE_URL) return res.status(500).json({ error: 'missing SUPABASE_URL on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    const showId = req.params.showId;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(req.query.limit || '12', 10)), 100);
    const offset = (page - 1) * limit;
    const sort = (req.query.sort && sortMap[req.query.sort]) ? sortMap[req.query.sort] : sortMap['newest'];
    const search = req.query.search ? String(req.query.search).trim() : '';

    let url = `${SUPABASE_URL}/rest/v1/studio_episodes?select=*`;
    url += `&show_id=eq.${encodeURIComponent(showId)}`;
    url += `&is_active=eq.true`;
    url += `&order=${encodeURIComponent(sort)}`;
    url += `&limit=${limit}&offset=${offset}`;

    if (search) {
      const s = encodeURIComponent(`title.ilike.*${search}* ,description.ilike.*${search}*`);
      url += `&or=(${s})`;
    }

    const resp = await fetchFn(url, {
      method: 'GET',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
    });
    const text = await resp.text();
    if (!resp.ok) return res.status(502).json({ error: 'supabase read failed', status: resp.status, body: text });
    const episodes = JSON.parse(text || '[]');

    // Also fetch show metadata for this show id
    let showMeta = null;
    // Include video_url in show metadata so episodes can inherit it when needed
    const showUrl = `${SUPABASE_URL}/rest/v1/studio_shows?id=eq.${encodeURIComponent(showId)}&select=id,title,thumbnail_url,category,video_url`;
    const sresp = await fetchFn(showUrl, { method: 'GET', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (sresp.ok) {
      const stext = await sresp.text();
      const arr = JSON.parse(stext || '[]');
      showMeta = arr[0] || null;
    }

    const mapped = episodes.map(ep => ({
      id: ep.id,
      show_id: ep.show_id,
      show_title: showMeta?.title || null,
      show_thumbnail: showMeta?.thumbnail_url || null,
      title: ep.title || ep.name || '',
      description: ep.description || null,
      duration: ep.duration || null,
      thumbnail_url: ep.thumbnail_url || ep.cover || null,
      // Use episode video_url first, then source_url, then show's video_url
      video_url: ep.video_url || ep.source_url || showMeta?.video_url || null,
      views: ep.views || 0,
      scheduled_time: ep.scheduled_time || null,
      air_time: ep.air_time || null,
      published_at: ep.published_at || ep.created_at || null,
      created_at: ep.created_at || new Date().toISOString(),
      is_live: !!ep.is_live,
      is_active: !!ep.is_active,
      tags: ep.tags || null,
      category: ep.category || null,
      show_category: showMeta?.category || null,
    }));

    const hasMore = mapped.length === limit;
    return res.json({ episodes: mapped, hasMore });
  } catch (err) {
    console.error('shows.episodes error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;
