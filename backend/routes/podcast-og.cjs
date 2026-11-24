const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const router = express.Router();
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function querySupabase(table, filters) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceKey) throw new Error('Podcast OG endpoint requires Supabase server configuration.');

  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} request failed with status ${response.status}.`);
  }
  return response.json();
}

async function loadPublishedChannel(showId) {
  const [brands, shows] = await Promise.all([
    querySupabase('studio_podcast_branding', {
      select: 'show_id,podcast_name,podcast_description,cover_url,logo_url,channel_status',
      show_id: `eq.${showId}`,
      limit: '1',
    }),
    querySupabase('studio_shows', {
      select: 'id,show_source,publication_status,is_active',
      id: `eq.${showId}`,
      limit: '1',
    }),
  ]);
  const brand = brands[0];
  const show = shows[0];
  if (
    !brand
    || !show
    || brand.channel_status !== 'active'
    || show.show_source !== 'creator'
    || show.publication_status !== 'published'
    || show.is_active !== true
  ) return null;
  return brand;
}

async function loadEpisode(showId, episodeId) {
  if (!UUID_PATTERN.test(episodeId || '')) return null;
  const episodes = await querySupabase('studio_episodes', {
    select: 'title,description,topic',
    id: `eq.${episodeId}`,
    show_id: `eq.${showId}`,
    is_active: 'eq.true',
    limit: '1',
  });
  return episodes[0] || null;
}

async function fetchChannelImage(imageUrl) {
  if (!imageUrl) return null;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : '';
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== supabaseHost) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsedUrl, { signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_SOURCE_IMAGE_BYTES) return null;
    const image = Buffer.from(await response.arrayBuffer());
    if (!image.length || image.length > MAX_SOURCE_IMAGE_BYTES) return null;
    return image;
  } finally {
    clearTimeout(timeout);
  }
}

async function createPodcastOgImage(brand) {
  let channelImage = null;
  for (const imageUrl of [brand.cover_url, brand.logo_url]) {
    try {
      channelImage = await fetchChannelImage(imageUrl);
      if (channelImage) break;
    } catch (error) {
      console.warn('Could not fetch podcast channel artwork for OG image:', error.message);
    }
  }

  const background = channelImage
    ? await sharp(channelImage)
      .rotate()
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover', position: 'attention' })
      .png()
      .toBuffer()
    : Buffer.from(
      `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#5423a8"/><stop offset="1" stop-color="#07110f"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/></svg>`,
    );

  let platformLogo;
  const logoPath = path.resolve(__dirname, '../../public/nezsq-logo-white-removebg-preview.png');
  try {
    platformLogo = await fs.readFile(logoPath);
  } catch {
    const logoUrl = process.env.PODCAST_OG_PLATFORM_LOGO_URL
      || 'https://www.nexsq.com/nezsq-logo-white-removebg-preview.png';
    const response = await fetch(logoUrl);
    if (!response.ok) throw new Error(`Could not load the NexSq logo (HTTP ${response.status}).`);
    platformLogo = Buffer.from(await response.arrayBuffer());
  }
  const logo = await sharp(platformLogo)
    .trim()
    .resize(270, 68, { fit: 'contain' })
    .png()
    .toBuffer();
  const badgeWidth = 320;
  const badgeHeight = 100;
  const badgeLeft = IMAGE_WIDTH - badgeWidth - 36;
  const badgeTop = IMAGE_HEIGHT - badgeHeight - 32;
  const darkOverlay = Buffer.from(
    `<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#05060a" stop-opacity=".12"/><stop offset="1" stop-color="#05060a" stop-opacity=".55"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/></svg>`,
  );
  const badge = Buffer.from(
    `<svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${badgeWidth - 2}" height="${badgeHeight - 2}" rx="22" fill="#08090d" fill-opacity=".86" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></svg>`,
  );
  return sharp(background)
    .composite([
      { input: darkOverlay },
      { input: badge, left: badgeLeft, top: badgeTop },
      { input: logo, left: badgeLeft + 25, top: badgeTop + 16 },
    ])
    .png()
    .toBuffer();
}

router.get('/:showId/meta', async (req, res) => {
  const { showId } = req.params;
  if (!UUID_PATTERN.test(showId)) return res.status(400).json({ error: 'Invalid Podcast channel ID.' });

  try {
    const brand = await loadPublishedChannel(showId);
    if (!brand) return res.status(404).json({ error: 'Podcast channel not found.' });
    const episode = await loadEpisode(showId, String(req.query.episode || ''));
    const podcastName = brand.podcast_name?.trim() || 'Podcast channel';
    const episodeTitle = episode?.title?.trim();
    return res.json({
      title: episodeTitle ? `${episodeTitle} | ${podcastName}` : `${podcastName} | NexSq`,
      description: episode?.description?.trim()
        || episode?.topic?.trim()
        || brand.podcast_description?.trim()
        || `Listen to ${podcastName} on NexSq.`,
      imageAlt: `${podcastName} podcast cover with NexSq branding`,
    });
  } catch (error) {
    console.error('Podcast OG metadata request failed:', error);
    return res.status(500).json({ error: 'Could not load Podcast share metadata.' });
  }
});

router.get('/:showId', async (req, res) => {
  const { showId } = req.params;
  if (!UUID_PATTERN.test(showId)) return res.status(400).send('Invalid Podcast channel ID.');

  try {
    const brand = await loadPublishedChannel(showId);
    if (!brand) return res.status(404).send('Podcast channel not found.');
    const image = await createPodcastOgImage(brand);
    res
      .status(200)
      .set('Content-Type', 'image/png')
      .set('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400')
      .send(image);
  } catch (error) {
    console.error('Podcast OG image generation failed:', error);
    res.status(500).send('Could not generate Podcast share image.');
  }
});

module.exports = router;
