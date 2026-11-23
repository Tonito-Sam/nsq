const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const originalFetch = global.fetch;
const episodeRows = [
  {
    id: 'podcast-episode',
    show_id: 'podcast-show',
    title: 'Podcast episode',
    thumbnail_url: 'episode-cover.jpg',
    video_url: 'podcast.mp4',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
  },
  {
    id: 'regular-episode',
    show_id: 'regular-show',
    title: 'Regular episode',
    thumbnail_url: 'episode-art.jpg',
    video_url: 'regular.mp4',
    created_at: '2026-01-01T00:00:00Z',
    is_active: true,
  },
];

global.fetch = async (input) => {
  const url = String(input);
  let data = [];
  if (url.includes('/rest/v1/studio_episodes?')) {
    data = url.includes('show_id=eq.podcast-show')
      ? [episodeRows[0]]
      : episodeRows;
  } else if (url.includes('/rest/v1/studio_shows?')) {
    data = [
      { id: 'podcast-show', title: 'TV show', thumbnail_url: 'tv-show.jpg', category: 'Talk' },
      { id: 'regular-show', title: 'Regular show', thumbnail_url: 'regular-show.jpg', category: 'News' },
    ];
  } else if (url.includes('/rest/v1/studio_podcast_branding?')) {
    data = [{ show_id: 'podcast-show', cover_url: 'podcast-cover.jpg', logo_url: 'podcast-logo.png' }];
  } else {
    throw new Error(`Unexpected Supabase request: ${url}`);
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  };
};

const express = require('express');
const showsRouter = require('./shows');
const app = express();
app.use('/api/shows', showsRouter);
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  global.fetch = originalFetch;
});

const getJson = (path) => new Promise((resolve, reject) => {
  const requestUrl = new URL(`${baseUrl}${path}`);
  http.get({
    hostname: requestUrl.hostname,
    port: requestUrl.port,
    path: requestUrl.pathname + requestUrl.search,
    headers: { Connection: 'close' },
  }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve(JSON.parse(body)));
  }).on('error', reject);
});

test('VOD routes prefer Podcast channel cover and logo over TV-show artwork', async () => {
  const allShows = await getJson('/api/shows/past/all');
  const podcastEpisode = allShows.episodes.find(({ id }) => id === 'podcast-episode');
  const regularEpisode = allShows.episodes.find(({ id }) => id === 'regular-episode');

  assert.equal(podcastEpisode.thumbnail_url, 'podcast-cover.jpg');
  assert.equal(podcastEpisode.podcast_cover_url, 'podcast-cover.jpg');
  assert.equal(podcastEpisode.podcast_logo_url, 'podcast-logo.png');
  assert.equal(podcastEpisode.is_podcast, true);
  assert.equal(podcastEpisode.show_thumbnail, 'tv-show.jpg');
  assert.equal(regularEpisode.thumbnail_url, 'episode-art.jpg');
  assert.equal(regularEpisode.is_podcast, false);

  const showEpisodes = await getJson('/api/shows/podcast-show/episodes');
  assert.equal(showEpisodes.episodes[0].thumbnail_url, 'podcast-cover.jpg');
  assert.equal(showEpisodes.episodes[0].podcast_logo_url, 'podcast-logo.png');
  assert.equal(showEpisodes.episodes[0].is_podcast, true);
});
