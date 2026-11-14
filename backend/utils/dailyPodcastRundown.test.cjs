const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createDailyPodcastRundown,
  getUsableSummary,
  isLowQualityStreamHeadline,
} = require('./dailyPodcastRundown.cjs');

const story = (headline, summary, category, coverageCount = 1) => ({
  headline,
  summary,
  category,
  categories: [category],
  source: 'Example News',
  publishedAt: '2026-11-13T08:00:00Z',
  url: 'https://example.com/story',
  coverageCount,
});

const createScript = (stories) => createDailyPodcastRundown({
  stories,
  hostOne: 'Maya',
  hostTwo: 'Sam',
  showTitle: 'Africa Today',
  duration: 20,
  customTopic: '',
  customCategory: 'General topic',
  customAngles: [],
});

test('orders a related story next to the lead and pivots clearly to an unrelated story', () => {
  const script = createScript([
    story('Central bank weighs a rate decision', 'Officials are considering the next rate decision.', 'Politics', 4),
    story('Coastal club wins championship', 'The coastal club won the final.', 'Sports', 1),
    story('New rate decision puts central bank in focus', 'The central bank decision is under review.', 'Business', 1),
  ]);

  assert.ok(
    script.indexOf('New rate decision puts central bank in focus')
      < script.indexOf('Coastal club wins championship'),
  );
  assert.match(script, /shared detail .*That is a point of overlap, not evidence that one development caused the other/i);
  assert.match(script, /change subject to Sports/);
  assert.ok(script.indexOf('\nINTRO\n') < script.indexOf('SEGMENT 1:'));
  assert.ok(script.lastIndexOf('\nOUTRO') > script.indexOf('SEGMENT 1:'));
});

test('keeps unrelated stories separate and preserves source notes', () => {
  const script = createScript([
    story('Parliament opens a new session', 'Lawmakers opened the session on Monday.', 'Politics'),
    story('Singer announces a new album', 'The artist announced an album release date.', 'Entertainment'),
  ]);

  assert.match(script, /reports so far don’t establish a connection/);
  assert.match(script, /\[SOURCE NOTE — NOT FOR READ-OUT: Example News/);
  assert.match(script, /https:\/\/example\.com\/story/);
});

test('connects singular and plural topics and distinguishes a shared location from a shared event', () => {
  const script = createScript([
    story('Nearly 168 million voters and three elections', 'Voters face three elections.', 'Politics', 3),
    story('Coastal club wins championship', 'The coastal club won the final.', 'Sports'),
    story('South Africa election result puts ANC under pressure', 'The election result is still developing.', 'Politics'),
    story('France vs South Africa match preview', 'The teams meet in the Nations Championship.', 'Sports'),
    story('Harambee Stars prepare for South Africa match', 'The teams meet in Johannesburg.', 'Sports'),
  ]);

  assert.ok(
    script.indexOf('South Africa election result puts ANC under pressure')
      < script.indexOf('Coastal club wins championship'),
  );
  assert.match(script, /election thread carries over/);
  assert.match(script, /South Africa comes up again, but the focus shifts from politics to sport/);
  assert.match(script, /South Africa appears in both headlines/);
  assert.equal((script.match(/focus shifts from politics to sport/g) || []).length, 1);
  assert.match(script, /“South Africa” and “election”/);
});

test('does not present a headline duplicated as an RSS summary as reported context', () => {
  const headline = 'Parliament opens a new session';
  const duplicateSummary = `${headline} Example News`;
  const script = createScript([
    story(headline, duplicateSummary, 'Politics'),
  ]);

  assert.equal(getUsableSummary({
    headline,
    source: 'Example News',
    summary: duplicateSummary,
  }), '');
  assert.match(script, /no usable summary/);
  assert.doesNotMatch(script, /reports: Parliament opens a new session Example News/);
});

test('does not treat a repeated publisher name as a story connection', () => {
  const script = createScript([
    story('Parliament opens a new session', 'Parliament opens a new session Example News', 'Politics'),
    story('Singer announces a new album', 'Singer announces a new album Example News', 'Entertainment'),
  ]);

  assert.doesNotMatch(script, /“example news”/i);
  assert.match(script, /change subject to Entertainment/);
});

test('filters stylized promotional live-stream headlines without rejecting ordinary coverage', () => {
  assert.equal(
    isLowQualityStreamHeadline('[LIVE.𝐒𝐭𝐫𝐞𝐚𝐦𝐬]^* South Africa vs Kenya LIVE Football 2026 Games Center Free Today'),
    true,
  );
  assert.equal(isLowQualityStreamHeadline('Live stream coverage of the South Africa match'), false);
});

test('places an optional studio topic in its own clearly labeled discussion', () => {
  const script = createDailyPodcastRundown({
    stories: [story('Parliament opens a new session', 'Lawmakers opened the session.', 'Politics')],
    hostOne: 'Maya',
    hostTwo: 'Sam',
    showTitle: 'Africa Today',
    duration: 20,
    customTopic: 'Finding purpose after a setback',
    customCategory: 'Inspiration',
    customAngles: [{
      title: 'The turning point',
      setup: 'Start with the specific obstacle.',
      question: 'What changed first?',
      followUp: 'What support helped?',
    }],
  });

  assert.match(script, /STUDIO DISCUSSION/);
  assert.match(script, /isn’t a reported news story/);
  assert.match(script, /What changed first\?/);
});
