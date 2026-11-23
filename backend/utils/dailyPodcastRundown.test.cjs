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
  assert.match(script, /Connected to the lead via: "central bank" and "rate decision" — a segue, not proof of cause/i);
  assert.match(script, /SEGMENT 3: Sports/);
  assert.ok(script.indexOf('\nINTRO\n') < script.indexOf('SEGMENT 1:'));
  assert.ok(script.lastIndexOf('\nOUTRO') > script.indexOf('SEGMENT 1:'));
});

test('keeps unrelated stories separate and preserves source notes', () => {
  const script = createScript([
    story('Parliament opens a new session', 'Lawmakers opened the session on Monday.', 'Politics'),
    story('Singer announces a new album', 'The artist announced an album release date.', 'Entertainment'),
  ]);

  assert.match(script, /SEGMENT 1: Politics/);
  assert.match(script, /SEGMENT 2: Entertainment/);
  assert.doesNotMatch(script, /Connected to the lead via/);
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
  assert.match(script, /Connected to the lead via: "election" — a segue, not proof of cause/);
  assert.doesNotMatch(script, /Connected to the lead via: "South Africa"/);
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
  assert.match(script, /SEGMENT 2: Entertainment/);
  assert.doesNotMatch(script, /Connected to the lead via/);
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
  assert.match(script, /not a reported news story/);
  assert.match(script, /What changed first\?/);
});

test('formats a creator topic as a paced presenter guide, not read-aloud dialogue', () => {
  const script = createDailyPodcastRundown({
    stories: [],
    hostOne: 'Tonito Samuel',
    hostTwo: 'Tonito Samuel',
    showTitle: 'Let’s Talk',
    duration: 10,
    customTopic: 'The Nigerian Spirit',
    customCategory: 'Creator topic',
    customAngles: [{
      title: 'Meaning and lived experience',
      setup: 'Explore what the topic means to people in different contexts.',
      question: 'What does the topic mean to you?',
      followUp: 'Which claims would need a source?',
    }],
  });

  assert.match(script, /Format: presenter guide — short synopsis, time budget, and bullet prompts per angle/);
  assert.match(script, /ANGLE 1: Meaning and lived experience/);
  assert.match(script, /Synopsis: Explore what the topic means/);
  assert.match(script, /- What does the topic mean to you\?/);
  assert.match(script, /PRESENTER NOTES/);
  assert.doesNotMatch(script, /EDITORIAL NOTE|reports don’t establish|Tonito Samuel:/);
  assert.equal((script.match(/Which claims would need a source\?/g) || []).length, 1);
});
