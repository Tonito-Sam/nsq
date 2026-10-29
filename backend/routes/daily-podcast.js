const express = require('express');
const axios = require('axios');
const RSSParser = require('rss-parser');

const router = express.Router();
const parser = new RSSParser({ timeout: 10000 });
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const DEFAULT_CATEGORIES = ['top', 'politics', 'sports'];
const OPTIONAL_CATEGORIES = ['geopolitics', 'entertainment'];
const CATEGORY_QUERIES = {
  top: 'Africa top news stories',
  politics: 'Africa politics government election news',
  sports: 'Africa sports football news',
  geopolitics: 'Africa geopolitics international relations news',
  entertainment: 'Africa entertainment music film celebrity news',
};

const serviceHeaders = (extra = {}) => ({
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  ...extra,
});

async function requireAdmin(req, res, next) {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Sign in to use the daily newsroom' });
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: 'Newsroom authentication is not configured on the server' });
  }

  try {
    const { data: user } = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: serviceHeaders({ Authorization: `Bearer ${accessToken}` }),
      timeout: 10000,
    });
    if (!user?.id) return res.status(401).json({ error: 'Your session is invalid or expired' });

    const { data: profiles } = await axios.get(`${SUPABASE_URL}/rest/v1/users`, {
      headers: serviceHeaders(),
      params: { select: 'privilege', id: `eq.${user.id}`, limit: 1 },
      timeout: 10000,
    });
    const privilege = profiles?.[0]?.privilege;
    if (privilege !== 'admin' && privilege !== 'superadmin') {
      return res.status(403).json({ error: 'Only Studio administrators can use the daily newsroom' });
    }

    req.newsroomUser = user;
    return next();
  } catch (error) {
    const status = error.response?.status || 500;
    if (status >= 500) console.error('Daily newsroom authentication failed:', error.message);
    return res.status(status === 401 ? 401 : 503).json({ error: 'Could not verify your admin session' });
  }
}

function cleanText(value, maxLength = 4000) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getStorySource(title, sourceName) {
  if (sourceName) return cleanText(sourceName, 120);
  const parts = title.split(' - ');
  return parts.length > 1 ? cleanText(parts[parts.length - 1], 120) : 'Publisher via Google News';
}

function normalizeHeadline(headline) {
  return headline.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getConversationAngles(category, topic) {
  const subject = `${category} ${topic}`.toLowerCase();
  if (/\b(youth|young people|young adults|gen ?z|generation z|teenagers|students)\b/.test(subject)) {
    return [
      {
        title: 'Identity, belonging, and values',
        setup: 'Avoid treating young people as one voice. Explore how background, community, and personal values can shape different outlooks.',
        question: 'Where do young people feel understood, and where do they feel pressure to fit someone else’s expectations?',
        followUp: 'How might age, location, family, or opportunity change the answer?',
      },
      {
        title: 'Digital life, information, and attention',
        setup: 'Look at how online spaces can create connection and opportunity while also shaping attention, comparison, and trust.',
        question: 'How can a presenter distinguish useful connection from pressure or misinformation online?',
        followUp: 'What habits help people stay informed without letting the feed set their priorities?',
      },
      {
        title: 'Ambition, work, and opportunity',
        setup: 'Put personal ambition beside the practical conditions that affect education, employment, and financial independence.',
        question: 'How do we talk about responsibility and hard work without ignoring unequal access to opportunity?',
        followUp: 'Which barriers are individual, and which need a response from institutions or communities?',
      },
      {
        title: 'Generational expectations',
        setup: 'Explore where younger and older generations may define security, success, respect, or independence differently.',
        question: 'Which disagreements are really about values, and which are about different experiences of change?',
        followUp: 'What could each generation learn by asking before judging?',
      },
      {
        title: 'Youth agency and the future',
        setup: 'Move from describing young people to asking where they already have influence and where they want more of it.',
        question: 'What does meaningful participation look like beyond being invited into the room?',
        followUp: 'Name one practical change that could give young people more voice or opportunity.',
      },
    ];
  }

  if (/\b(inspiration|inspire|motivation|purpose|resilience|hope|setback|overcoming)\b/.test(subject)) {
    return [
      {
        title: 'The turning point behind the story',
        setup: 'Start with a specific obstacle or decision, not a polished success story.',
        question: 'What changed first: the circumstances, the support around the person, or the way they responded?',
        followUp: 'What part of this story should listeners avoid oversimplifying?',
      },
      {
        title: 'Motivation versus everyday habits',
        setup: 'Separate a powerful moment of motivation from the ordinary routines that keep progress moving.',
        question: 'What is one small, repeatable action that matters more than waiting to feel ready?',
        followUp: 'How can someone adapt that step to the time and resources they actually have?',
      },
      {
        title: 'Support, access, and personal agency',
        setup: 'Balance individual effort with the people, resources, and opportunities that make progress possible.',
        question: 'Who helped, and what would be unfair to credit to willpower alone?',
        followUp: 'What support could a friend, family, workplace, or community offer?',
      },
      {
        title: 'Redefining what progress looks like',
        setup: 'Challenge the idea that progress must be fast, public, or easy to measure.',
        question: 'What signs of growth might matter even when nobody else can see them?',
        followUp: 'How do we celebrate progress without dismissing ongoing difficulty?',
      },
      {
        title: 'A practical takeaway for listeners',
        setup: 'Bring the conversation down to one realistic choice rather than a sweeping promise.',
        question: 'What is one action a listener could try this week, and what might get in the way?',
        followUp: 'What is a smaller version of that action for someone having a hard week?',
      },
    ];
  }

  return [
    {
      title: 'What is underneath the topic?',
      setup: `Look beyond the surface of “${topic}” and identify the experiences, conditions, or assumptions shaping it.`,
      question: 'What is the most useful context a listener needs before forming an opinion?',
      followUp: 'Which part is supported by evidence, and which part is interpretation?',
    },
    {
      title: 'People and perspectives',
      setup: 'Bring in the people most affected and notice whose experience is missing from the usual conversation.',
      question: 'Who might experience this differently from the people with the loudest platform?',
      followUp: 'What would we need to hear before speaking on their behalf?',
    },
    {
      title: 'The tension or trade-off',
      setup: 'Find the genuine disagreement, competing priorities, or difficult choice inside the topic.',
      question: 'What are the strongest reasonable arguments on each side?',
      followUp: 'What evidence or experience could change someone’s view?',
    },
    {
      title: 'What could be done?',
      setup: 'Move from describing the issue to considering responses at personal, community, and institutional levels.',
      question: 'Which response is practical, and who has the power to make it happen?',
      followUp: 'What unintended consequence should we consider?',
    },
    {
      title: 'What remains open?',
      setup: 'Close with uncertainty honestly instead of forcing a neat conclusion.',
      question: 'What do we still not know, and what source or conversation would help next?',
      followUp: 'What question should listeners keep thinking about after the episode?',
    },
  ];
}

router.post('/stories', requireAdmin, async (req, res) => {
  const categories = Array.isArray(req.body?.categories)
    ? [...new Set(req.body.categories.map(String))].filter((category) => DEFAULT_CATEGORIES.includes(category) || OPTIONAL_CATEGORIES.includes(category))
    : DEFAULT_CATEGORIES;
  const country = cleanText(req.body?.country, 60);
  if (country && !/^[\p{L}\p{M}\s.'-]+$/u.test(country)) {
    return res.status(400).json({ error: 'Enter a valid country name' });
  }

  const searches = categories.map((category) => ({
    category: category === 'top' ? 'Top stories' : category[0].toUpperCase() + category.slice(1),
    query: `${CATEGORY_QUERIES[category]} when:1d`,
  }));
  if (country) searches.push({ category: `${country} focus`, query: `${country} news when:1d` });

  try {
    const results = await Promise.allSettled(searches.map(async ({ category, query }) => {
      const rssUrl = new URL('https://news.google.com/rss/search');
      rssUrl.searchParams.set('q', query);
      rssUrl.searchParams.set('hl', 'en');
      rssUrl.searchParams.set('gl', 'ZA');
      rssUrl.searchParams.set('ceid', 'ZA:en');
      const response = await axios.get(rssUrl.toString(), {
        timeout: 12000,
        maxContentLength: 2 * 1024 * 1024,
        responseType: 'text',
        headers: { 'User-Agent': 'NexSqDailyNewsroom/1.0' },
      });
      const feed = await parser.parseString(response.data);
      return (feed.items || []).slice(0, 12).map((item) => {
        const title = cleanText(item.title, 300);
        const headline = title.replace(/\s+-\s+[^-]+$/, '').trim() || title;
        const source = getStorySource(title, item.source?.name);
        return {
          id: `${category}-${Buffer.from(normalizeHeadline(headline)).toString('base64url').slice(0, 32)}`,
          category,
          headline,
          summary: cleanText(item.contentSnippet || item.content || item.summary, 700),
          source,
          publishedAt: item.isoDate || item.pubDate || null,
          url: item.link || '',
        };
      });
    }));

    const storiesByHeadline = new Map();
    const feedErrors = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        feedErrors.push(searches[index].category);
        console.warn(`News feed failed for ${searches[index].category}:`, result.reason?.message || result.reason);
        return;
      }
      result.value.forEach((story) => {
        const key = normalizeHeadline(story.headline);
        const existing = storiesByHeadline.get(key);
        if (existing) {
          existing.coverageCount += 1;
          if (!existing.categories.includes(story.category)) existing.categories.push(story.category);
        } else {
          storiesByHeadline.set(key, { ...story, categories: [story.category], coverageCount: 1 });
        }
      });
    });

    const stories = [...storiesByHeadline.values()]
      .sort((a, b) => b.coverageCount - a.coverageCount || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 40);
    return res.json({ generatedAt: new Date().toISOString(), stories, feedErrors });
  } catch (error) {
    console.error('Daily newsroom story fetch failed:', error.message);
    return res.status(502).json({ error: 'Could not retrieve current news feeds. Try again shortly.' });
  }
});

router.post('/script', requireAdmin, async (req, res) => {
  const stories = Array.isArray(req.body?.stories) ? req.body.stories.slice(0, 12) : [];

  const safeStories = stories.map((story) => ({
    category: cleanText(story.category, 80),
    headline: cleanText(story.headline, 300),
    summary: cleanText(story.summary, 700),
    source: cleanText(story.source, 120),
    publishedAt: cleanText(story.publishedAt, 80),
    url: cleanText(story.url, 1000),
    coverageCount: Number(story.coverageCount) || 0,
  }));
  if (safeStories.some((story) => !story.headline || !story.url)) {
    return res.status(400).json({ error: 'Every selected story must include a headline and source link' });
  }
  const customTopic = cleanText(req.body?.customTopic, 500);
  const customCategory = cleanText(req.body?.customCategory || 'General topic', 80);
  if (!safeStories.length && !customTopic) {
    return res.status(400).json({ error: 'Fetch news stories or enter a conversation topic to produce a rundown' });
  }

  const hostNames = cleanText(req.body?.hostNames || 'Host 1, Host 2', 120);
  const hosts = hostNames.split(/,|;|&|\band\b/i).map((name) => name.trim()).filter(Boolean).slice(0, 2);
  const hostOne = hosts[0] || 'Host 1';
  const hostTwo = hosts[1] || hostOne;
  const showTitle = cleanText(req.body?.showTitle || 'Africa Today', 120);
  const duration = Math.min(Math.max(Number(req.body?.duration) || 20, 10), 60);
  const selectedStories = safeStories
    .sort((a, b) => b.coverageCount - a.coverageCount || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, Math.min(safeStories.length, Math.max(3, Math.round(duration / 4))));
  const lines = [
    showTitle,
    `Target runtime: ${duration} minutes`,
    selectedStories.length
      ? 'PRODUCTION NOTE: This rundown is assembled from publisher headlines and RSS summaries. Verify details at the linked sources before recording; do not treat discussion prompts as reported facts.'
      : 'PRODUCTION NOTE: The custom-topic angles are discussion prompts, not reported facts. Add and verify reliable sources before making factual claims.',
    '',
    'OPENING',
    `${hostOne}: Welcome to ${showTitle}. ${selectedStories.length ? 'Here is today’s source-led briefing, beginning with the story receiving the strongest coverage across our selected news feeds.' : 'Today we are opening a focused conversation around the topic you asked us to explore.'}`,
    `${hostTwo}: We will move through the selected stories and discussion beats, separating reported facts from questions, perspectives, and personal reflection.`,
    '',
  ];

  selectedStories.forEach((story, index) => {
    const category = story.categories?.[0] || story.category || 'Top stories';
    const summary = story.summary || story.headline;
    const published = story.publishedAt && !Number.isNaN(Date.parse(story.publishedAt))
      ? new Date(story.publishedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })
      : 'Date not provided';
    lines.push(
      `SEGMENT ${index + 1}: ${category} | ${story.headline}`,
      `${hostOne}: ${index === 0 ? 'Our lead story today' : 'Next in the rundown'}: ${story.headline}.`,
      `${hostTwo}: The available report from ${story.source || 'the linked publisher'} says: ${summary}`,
      `${hostOne}: Let’s separate what this report confirms from what still needs more reporting. What context would listeners need to understand the people and decisions involved?`,
      `${hostTwo}: That is worth discussing, while keeping any conclusions tied to the reporting we have in front of us.`,
      `SOURCE: ${story.source || 'Publisher'} | Published: ${published} | ${story.url}`,
      '',
    );
  });

  if (customTopic) {
    const angles = getConversationAngles(customCategory, customTopic);
    angles.forEach((angle, index) => {
      lines.push(
        `SEGMENT ${selectedStories.length + index + 1}: ${customCategory} | ${customTopic} — ${angle.title}`,
        `ANGLE: ${angle.title}`,
        `${hostOne}: For this part of “${customTopic},” let’s look at it this way: ${angle.setup}`,
        `${hostTwo}: ${angle.question}`,
        `${hostOne}: ${angle.followUp}`,
        `${hostTwo}: Let’s stay with that perspective for a moment, then bring in a different experience or counterpoint before we move on.`,
        '',
      );
    });
  }

  lines.push(
    'CLOSING',
    `${hostOne}: ${selectedStories.length ? 'That is today’s rundown. We have linked the original reports so listeners can read the full coverage and follow developing details.' : 'That is today’s conversation. We have explored several angles, and the questions we could not settle are worth carrying forward.'}`,
    `${hostTwo}: Thanks for listening to ${showTitle}.${selectedStories.length ? ' We will return with another update as the stories develop.' : ' We hope you will keep thinking about the perspectives we explored.'}`,
  );

  return res.json({ script: lines.join('\n'), generator: 'built-in-rundown', generatedAt: new Date().toISOString() });
});

module.exports = router;