const COMMON_TERMS = new Set(
  `about after again against also among another any are around away back because been before being between both but can could did does doing down during each either enough even every few for from further had has have having here how into its itself just like made make many may might more most much must news not now off once only other our out over own same says said say several should since some such than that the their them then there these they this those through today under until upon very was were what when where which while who will with within without would you your africa south top latest breaking story stories report reports source sources says according published publisher headlines team teams meet match matches face prepare`.split(
    ' ',
  ),
);

function getStoryTokens(story) {
  const text = `${story.headline || ''} ${getUsableSummary(story)}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (text.match(/[a-z0-9]{4,}/g) || []).map((term) => {
    if (term.length > 5 && term.endsWith('ies')) return `${term.slice(0, -3)}y`;
    if (term.length > 4 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
    return term;
  });
}

function getStoryTerms(story) {
  return new Set(getStoryTokens(story).filter((term) => !COMMON_TERMS.has(term)));
}

function getStoryPhrases(story) {
  const tokens = getStoryTokens(story);
  const phrases = new Set();
  for (const phraseLength of [3, 2]) {
    for (let index = 0; index <= tokens.length - phraseLength; index += 1) {
      const phraseTokens = tokens.slice(index, index + phraseLength);
      const southAfrica = phraseTokens.includes('south') && phraseTokens.includes('africa');
      if (phraseTokens.every((term) =>
        !COMMON_TERMS.has(term) || (southAfrica && ['south', 'africa'].includes(term)))) {
        phrases.add(phraseTokens.join(' '));
      }
    }
  }
  return phrases;
}

function getSharedTerms(first, second) {
  const secondPhrases = getStoryPhrases(second);
  const sharedPhrases = [...getStoryPhrases(first)]
    .filter((phrase) => secondPhrases.has(phrase))
    .sort((a, b) => b.split(' ').length - a.split(' ').length || a.localeCompare(b));
  const selectedPhrases = [];
  for (const phrase of sharedPhrases) {
    if (selectedPhrases.some((selected) => selected.includes(phrase) || phrase.includes(selected))) continue;
    selectedPhrases.push(phrase);
    if (selectedPhrases.length === 2) return selectedPhrases;
  }
  if (selectedPhrases.length) return selectedPhrases;

  const secondTerms = getStoryTerms(second);
  return [...getStoryTerms(first)]
    .filter((term) => secondTerms.has(term))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 2);
}

function getStoryCategory(story) {
  const categories = [...(story.categories || []), story.category].filter(Boolean);
  return (
    categories.find((category) => !/^top stories?$/i.test(String(category))) ||
    categories[0] ||
    'another topic'
  );
}

function getCategoryLabel(story) {
  return String(getStoryCategory(story)).toLowerCase();
}

function formatPublishedDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'date not provided';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' });
}

function getRecurringTerms(stories) {
  const counts = new Map();
  for (const story of stories) {
    for (const phrase of [...getStoryPhrases(story), ...getStoryTerms(story)]) {
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }
  const rankedTerms = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        b[0].split(' ').length - a[0].split(' ').length,
    );
  const recurring = [];
  for (const [phrase] of rankedTerms) {
    if (recurring.some((selected) => selected.includes(phrase) || phrase.includes(selected))) continue;
    recurring.push(phrase);
    if (recurring.length === 2) break;
  }
  return recurring;
}

// --- Conversation Arc Planner ---
function formatSharedTerm(term) {
  return term.replace(/^south africa\b/i, 'South Africa');
}

function getUsableSummary(story) {
  const summary = String(story.summary || '').trim();
  if (!summary) return '';

  const words = (value) => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const knownWords = new Set(words(`${story.headline || ''} ${story.source || ''}`));
  return words(summary).some((word) => !knownWords.has(word)) ? summary : '';
}

function isLowQualityStreamHeadline(headline) {
  const normalized = String(headline || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return /\blive streams?\b/.test(normalized)
    && (/\bfree today\b/.test(normalized) || /\bgames? center\b/.test(normalized));
}

function planConversationArc(stories) {
  if (!stories.length) return { leadTheme: 'the day\u2019s news', threads: [] };

  const ordered = [stories[0]];
  const remaining = stories.slice(1);

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = -1;
    let bestTerms = [];
    let bestFrom = null;
    for (let index = 0; index < remaining.length; index += 1) {
      let localBest = { score: 0, terms: [], from: null };
      for (const prior of ordered) {
        const terms = getSharedTerms(prior, remaining[index]);
        const score = terms.reduce((total, term) => total + (term.includes(' ') ? 3 : 1), 0);
        if (score > localBest.score || (score > 0 && score === localBest.score)) {
          localBest = { score, terms, from: prior };
        }
      }
      if (localBest.score > bestScore) {
        bestScore = localBest.score;
        bestIndex = index;
        bestTerms = localBest.terms;
        bestFrom = localBest.from;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    const priorThread = ordered[ordered.length - 1];
    let link;
    if (bestTerms.length >= 1) {
      link = { type: 'connected', via: bestTerms, from: bestFrom };
    } else if (getCategoryLabel(next) === getCategoryLabel(priorThread)) {
      link = { type: 'contrast', via: [], from: priorThread };
    } else {
      link = { type: 'pivot', via: [], from: priorThread };
    }
    ordered.push({ ...next, _link: link });
  }

  ordered[0] = { ...ordered[0], _link: { type: 'lead' } };
  return { threads: ordered };
}

function orderStoriesForConversation(stories) {
  const plan = planConversationArc(stories);
  return plan.threads;
}

// ---------------------------------------------------------------------------
// Guide formatting helpers
// ---------------------------------------------------------------------------

function formatGuideMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0';
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
}

function getTimeBudget(duration, angleCount) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 20;
  if (angleCount <= 0) {
    return { opening: safeDuration, angle: 0, closing: 0, angleCount: 0 };
  }
  const opening = Math.max(1, Math.round(safeDuration * 0.1 * 10) / 10);
  const closing = Math.max(1, Math.round(safeDuration * 0.15 * 10) / 10);
  const angle = Math.max(1, Math.round(((safeDuration - opening - closing) / angleCount) * 10) / 10);
  return { opening, angle, closing, angleCount };
}

function ensureBullets(rawBullets, fallback) {
  const list = Array.isArray(rawBullets)
    ? rawBullets.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (list.length >= 3) return list.slice(0, 5);
  const merged = [...list];
  for (const bullet of fallback) {
    if (merged.length >= 3) break;
    if (!merged.includes(bullet)) merged.push(bullet);
  }
  return merged.slice(0, 5);
}

function normaliseAngle(rawAngle, index, topic) {
  const fallbackTitle = `Angle ${index + 1}`;
  if (typeof rawAngle === 'string') {
    const title = rawAngle.trim() || fallbackTitle;
    return {
      title,
      synopsis: `Why "${title}" matters to "${topic}".`,
      bullets: ensureBullets([], [
        `What does "${title}" mean to you?`,
        `Where have you seen "${title}" play out?`,
        `What is usually missed when people discuss "${title}"?`,
      ]),
    };
  }

  if (!rawAngle || typeof rawAngle !== 'object') {
    return {
      title: fallbackTitle,
      synopsis: `Open the next layer of the conversation about "${topic}".`,
      bullets: [
        `What is the question we have not asked yet?`,
        `What would change if we are wrong about this?`,
        `What do you want listeners to carry forward?`,
      ],
    };
  }

  const title = String(rawAngle.title || rawAngle.name || fallbackTitle).trim();
  const synopsis = String(
    rawAngle.synopsis || rawAngle.setup || rawAngle.description ||
    `Why "${title}" matters to "${topic}".`,
  ).trim();

  const explicitBullets = Array.isArray(rawAngle.bullets) ? rawAngle.bullets : null;
  const legacyBullets = [rawAngle.question, rawAngle.prompt]
    .filter(Boolean)
    .map((value) => String(value).trim());

  const bullets = ensureBullets(
    explicitBullets || legacyBullets,
    [
      `What does "${title}" look like in real life?`,
      `Which assumption about "${title}" deserves to be challenged?`,
      `What is the follow-up question this raises?`,
    ],
  );

  const followUp = rawAngle.followUp && !explicitBullets
    ? String(rawAngle.followUp).trim()
    : undefined;

  return { title, synopsis, bullets, followUp };
}

function buildGuideOpening(showTitle, topic, budgetMinutes) {
  return [
    'INTRO',
    `Opening frame (~${formatGuideMinutes(budgetMinutes)} min)`,
    `Synopsis: Open "${topic}" as a live, unresolved conversation, not a lecture and not a reported news story.`,
    'Prompts:',
    `- Introduce the show (${showTitle}) and the topic in one sentence.`,
    '- Say plainly: this is a conversation, not a verdict.',
    `- Opening question to the room: What does "${topic}" mean to you?`,
    '- Set the tone: stories over statistics, questions over certainty.',
  ];
}

function buildGuideAngle(angle, index, budgetMinutes) {
  return [
    '',
    `ANGLE ${index + 1}: ${angle.title} (~${formatGuideMinutes(budgetMinutes)} min)`,
    `Synopsis: ${angle.synopsis}`,
    'Prompts:',
    ...angle.bullets.map((bullet) => `- ${bullet}`),
    ...(angle.followUp ? [`Follow-up if time allows: ${angle.followUp}`] : []),
  ];
}

function buildGuideClosing(topic, budgetMinutes) {
  return [
    '',
    'OUTRO',
    `Wrap-up (~${formatGuideMinutes(budgetMinutes)} min)`,
    '- Recap one idea that landed, without forcing agreement.',
    `- Bring it back to the opening question: "${topic}" — has the answer shifted?`,
    '- Final prompt: What is one question listeners should carry into their week?',
    '- Thank listeners, name the next episode if known, close clean.',
  ];
}

function buildGuidePresenterNotes() {
  return [
    '',
    'PRESENTER NOTES',
    '- Label personal experience and interpretation; never present them as universal facts.',
    '- Prefer concrete examples over generalisations.',
    '- Leave room for silence; the strongest moments are usually the pauses.',
    '- If a claim is disputed, say so on air rather than smoothing it over.',
    '- Factual claims must be checkable; if not, frame as a personal view rather than a fact.',
  ];
}

function buildCreatorTopicGuide({
  hostOne,
  hostTwo,
  showTitle,
  duration,
  customTopic,
  customAngles,
}) {
  const rawAngles = Array.isArray(customAngles) ? customAngles : [];
  const angles = rawAngles.length
    ? rawAngles.map((angle, index) => normaliseAngle(angle, index, customTopic))
    : [normaliseAngle(undefined, 0, customTopic)];

  const budget = getTimeBudget(duration, angles.length);
  const presenters = hostOne === hostTwo ? hostOne : `${hostOne} and ${hostTwo}`;

  const lines = [
    showTitle,
    `Target runtime: ${formatGuideMinutes(duration)} minutes`,
    `Topic: ${customTopic}`,
    `Presenters: ${presenters}`,
    'Format: presenter guide — short synopsis, time budget, and bullet prompts per angle.',
    '',
    ...buildGuideOpening(showTitle, customTopic, budget.opening),
  ];

  angles.forEach((angle, index) => {
    lines.push(...buildGuideAngle(angle, index, budget.angle));
  });

  lines.push(...buildGuideClosing(customTopic, budget.closing));
  lines.push(...buildGuidePresenterNotes());

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Story (newsroom) guide
// ---------------------------------------------------------------------------

function describeThread(story) {
  const category = getStoryCategory(story);
  return `${category} — ${story.headline}`;
}

function summariseStory(story) {
  const source = story.source || 'the linked publisher';
  const summary = getUsableSummary(story);
  return summary
    ? `${source} reports: ${summary}`
    : `${source} provides a headline but no usable summary. Verify the linked report before adding context or drawing conclusions.`;
}

function getStoryTalkingPoints(story, index, leadStory) {
  const category = getCategoryLabel(story);
  const summary = getUsableSummary(story);
  const headline = story.headline || 'this report';

  const points = [
    `Headline: "${headline}" (${story.source || 'source unlisted'}, published ${formatPublishedDate(story.publishedAt)}).`,
    summary
      ? `What the source reports: ${summary}`
      : 'The source provides a headline but no usable summary. Read the linked article before stating facts.',
  ];

  if (category.includes('politic')) {
    points.push('What decision or process is confirmed here, and who is affected?');
    points.push('What is still unresolved, and what happens next?');
  } else if (category.includes('sport')) {
    points.push('What is confirmed about the result or decision?');
    points.push('What should listeners watch for next?');
  } else if (category.includes('geopolitic')) {
    points.push('What do sources confirm about the parties involved?');
    points.push('What remains unresolved between them?');
  } else if (category.includes('entertainment')) {
    points.push('What does the report confirm, and whose perspective is missing?');
    points.push('Is this a one-off story or the top of a trend?');
  } else {
    points.push('What context would listeners need to understand why this matters now?');
    points.push('What question does this report leave open?');
  }

  if (index > 0 && leadStory) {
    const shared = getSharedTerms(leadStory, story);
    if (shared.length) {
      points.push(`Connected to the lead via: ${shared.map((term) => `"${formatSharedTerm(term)}"`).join(' and ')} — a segue, not proof of cause.`);
    }
  }

  return points.slice(0, 5);
}

function buildStoryGuide(hostOne, hostTwo, story, index, leadStory, budgetMinutes) {
  const category = getStoryCategory(story);
  const talkingPoints = getStoryTalkingPoints(story, index, leadStory);
  const sourceName = story.source || 'the linked publisher';
  const publishedDate = formatPublishedDate(story.publishedAt);
  const sourceUrl = story.url || 'no url';
  return [
    '',
    `SEGMENT ${index + 1}: ${category} | ${story.headline}`,
    `Time budget: ~${formatGuideMinutes(budgetMinutes)} min`,
    `Synopsis: ${summariseStory(story)}`,
    'Talking points:',
    ...talkingPoints.map((point) => `- ${point}`),
    `[SOURCE NOTE — NOT FOR READ-OUT: ${sourceName} | Published ${publishedDate} | ${sourceUrl}]`,
    `${hostOne} opens; ${hostTwo} probes. Keep the source note on screen only.`,
  ];
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

function createDailyPodcastRundown({
  stories,
  hostOne,
  hostTwo,
  showTitle,
  duration,
  customTopic,
  customCategory,
  customAngles,
}) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 20;
  const { threads } = planConversationArc(stories || []);

  // Topic-only mode: nothing but the guide.
  if (customTopic && !threads.length) {
    return buildCreatorTopicGuide({
      hostOne,
      hostTwo,
      showTitle,
      duration: safeDuration,
      customTopic,
      customAngles,
    });
  }

  // Stories mode: newsroom guide, then optional topic guide appended.
  const angleCount = Array.isArray(customAngles) && customAngles.length ? customAngles.length : 0;
  const topicBudgetShare = customTopic ? 0.35 : 0;
  const storyBudgetTotal = safeDuration * (1 - topicBudgetShare);
  const storyBudget = threads.length ? storyBudgetTotal / threads.length : 0;

  const lines = [
    showTitle,
    `Target runtime: ${formatGuideMinutes(safeDuration)} minutes`,
    '[EDITORIAL NOTE — NOT FOR READ-OUT: Use the linked publisher reports for facts. Shared words are a segue, not proof of cause and effect. Do not add details that are absent from the source summaries.]',
    '',
    'INTRO',
    `Time budget: ~${formatGuideMinutes(Math.max(1, Math.round(storyBudget * 0.15 * 10) / 10))} min`,
    `Synopsis: Open the show by naming ${threads.length} report${threads.length === 1 ? '' : 's'} on the rundown and telling listeners you will separate reported facts from open questions.`,
    'Prompts:',
    `- Welcome to ${showTitle}.`,
    `- Today we are following ${threads.length} report${threads.length === 1 ? '' : 's'}. We will stay with what each source supports.`,
    '- Set the rule: reported facts first, open questions flagged as such.',
    '- Hand off to the lead story.',
  ];

  threads.forEach((story, index) => {
    lines.push(...buildStoryGuide(hostOne, hostTwo, story, index, threads[0], storyBudget));
  });

  if (customTopic) {
    lines.push(
      '',
      '================================================================',
      'STUDIO DISCUSSION GUIDE',
      '================================================================',
      '',
      buildCreatorTopicGuide({
        hostOne,
        hostTwo,
        showTitle,
        duration: safeDuration * topicBudgetShare,
        customTopic,
        customAngles,
      }),
    );
  }

  const recurring = getRecurringTerms(threads);
  lines.push(
    '',
    'OUTRO',
    `Time budget: ~${formatGuideMinutes(Math.max(1, Math.round(safeDuration * 0.08 * 10) / 10))} min`,
    'Prompts:',
    recurring.length
      ? `- Note the recurring phrase${recurring.length > 1 ? 's' : ''}: ${recurring.map((term) => `"${formatSharedTerm(term)}"`).join(' and ')} — a thread worth following, not proof of one event.`
      : '- Note that the reports stay distinct; no single cause was established.',
    '- One open question to carry into next week.',
    `- Thanks for listening to ${showTitle}.`,
  );

  return lines.join('\n');
}

module.exports = {
  createDailyPodcastRundown,
  orderStoriesForConversation,
  getUsableSummary,
  isLowQualityStreamHeadline,
  // Exposed for testing / reuse:
  normaliseAngle,
  ensureBullets,
  getTimeBudget,
  buildCreatorTopicGuide,
};