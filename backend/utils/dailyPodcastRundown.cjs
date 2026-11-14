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
// Produces a narrative plan: { leadTheme, threads: [{ story, link }] }
// link = { type: 'lead' | 'connected' | 'contrast' | 'pivot', via?: string[], from?: story }

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
      link = {
        type: 'contrast',
        via: [],
        from: priorThread,
      };
    } else {
      link = { type: 'pivot', via: [], from: priorThread };
    }
    ordered.push({ ...next, _link: link });
  }

  // First story is always the lead
  ordered[0] = { ...ordered[0], _link: { type: 'lead' } };

  return { threads: ordered };
}

function orderStoriesForConversation(stories) {
  const plan = planConversationArc(stories);
  return plan.threads;
}

// --- Host voice helpers ---
// hostOne: analytical / contextual / sets up the frame
// hostTwo: probing / challenges / draws out stakes

function describeThread(story) {
  const category = getStoryCategory(story);
  return `${category} — “${story.headline}”`;
}

function summariseStory(story) {
  const source = story.source || 'the linked publisher';
  const summary = getUsableSummary(story);
  return summary
    ? `${source} reports: ${summary}`
    : `${source} provides a headline but no usable summary. We should verify the linked report before adding context or drawing conclusions.`;
}

function buildOpening(hostOne, hostTwo, showTitle, threads, customTopic) {
  const lines = [];
  const count = threads.length;

  if (count === 0) {
    lines.push(
      `${hostOne}: Welcome to ${showTitle}. Today we’re opening a focused studio conversation about ${customTopic}.`,
      `${hostTwo}: And we’ll keep it honest — this is a discussion topic, not a reported news story, so we’ll flag what’s reportable and what’s our own analysis.`,
    );
    return lines;
  }

  const recurring = getRecurringTerms(threads);
  const categories = [...new Set(threads.map((story) => getStoryCategory(story).toLowerCase()))];
  const frame = recurring.length
    ? `A detail recurring across the coverage is ${recurring.map((term) => `“${formatSharedTerm(term)}”`).join(' and ')}. That gives us a thread to explore, not proof that the reports describe one event.`
    : `The reports range across ${categories.join(' and ')}, and the source material doesn’t establish one shared event. We’ll make each transition clear rather than force a connection.`;

  lines.push(
    `${hostOne}: Welcome to ${showTitle}. We’re following ${count} report${count === 1 ? '' : 's'} today. ${frame} Let’s begin with the first story and let the reporting set the conversation.`,
    `${hostTwo}: And as we move through the stories, we’ll separate what’s reported from what’s still a question.`,
  );
  return lines;
}

function buildBridge(hostOne, hostTwo, prior, next) {
  const link = next._link || { type: 'pivot' };
  const linkedStory = link.from || prior;
  const category = getStoryCategory(next);
  const lines = [];

  if (link.type === 'connected' && link.via?.length) {
    const shared = link.via.map((term) => `“${formatSharedTerm(term)}”`).join(' and ');
    let transition;
    if (link.via.some((term) => term.startsWith('south africa'))) {
      const previousCategory = getStoryCategory(linkedStory).toLowerCase();
      transition = previousCategory.includes('politic') && category.toLowerCase().includes('sport')
        ? 'South Africa comes up again, but the focus shifts from politics to sport. Same setting, different events; the sources do not establish a direct link.'
        : `South Africa appears in both headlines. It gives us a location to carry forward, not evidence that these are the same event.`;
    } else if (link.via.includes('election')) {
      transition = `The election thread carries over from “${linkedStory.headline}” to this report. They share a topic, but the sources do not establish a direct link.`;
    } else {
      transition = `The shared detail from “${linkedStory.headline}” is ${shared}. That is a point of overlap, not evidence that one development caused the other.`;
    }
    lines.push(
      `${hostOne}: ${transition} What does this report add?`,
      `${hostTwo}: The next report is “${next.headline}.” ${summariseStory(next)}`,
    );
  } else if (link.type === 'contrast') {
    lines.push(
      `${hostOne}: We have another ${category} report, but it’s a separate story. Let’s hear what this one adds on its own terms.`,
      `${hostTwo}: The report is “${next.headline}.” ${summariseStory(next)}`,
      `${hostOne}: What question does this report raise that the earlier one didn’t?`,
    );
  } else {
    lines.push(
      `${hostOne}: Let’s change subject to ${category}. The reports so far don’t establish a connection to this story, so we’ll let it stand on its own.`,
      `${hostTwo}: The report is “${next.headline}.” ${summariseStory(next)}`,
      `${hostOne}: Given that this is a separate thread, what context would a listener need to understand why it matters on its own terms?`,
    );
  }
  return lines;
}

function buildFollowUp(hostOne, hostTwo, story, index) {
  const category = getCategoryLabel(story);
  let question;
  if (category.includes('politic')) {
    question = 'what decision or process is confirmed here, who is affected, and what happens next?';
  } else if (category.includes('sport')) {
    question = 'what is confirmed about the result or decision, and what should listeners watch for next?';
  } else if (category.includes('geopolitic')) {
    question = 'what do the sources confirm about the parties involved, and what remains unresolved?';
  } else if (category.includes('entertainment')) {
    question = 'what does the report confirm, and whose perspective may still be missing?';
  } else {
    question = 'what context would listeners need to understand why this matters now?';
  }

  const responses = [
    `Right. The summary gives us the reported detail, but it doesn’t settle that question. Let’s keep the distinction clear rather than turn an open question into a claim.`,
    `And the source excerpt doesn’t answer that yet. We should leave it open instead of filling the gap with a guess.`,
    `That remains unresolved in the material we have, so it belongs in our follow-up questions — not in the facts we state.`,
  ];

  return [
    `${hostOne}: The follow-up I’d put to the reporting is: ${question}`,
    `${hostTwo}: ${getUsableSummary(story)
      ? responses[index % responses.length]
      : 'The headline alone doesn’t answer that. Let’s keep it as a reporting question until we verify the linked article.'}`,
    `[SOURCE NOTE — NOT FOR READ-OUT: ${story.source || 'the linked publisher'} | Published ${formatPublishedDate(story.publishedAt)} | ${story.url}]`,
  ];
}

function buildStudioDiscussion(hostOne, hostTwo, { customTopic, customCategory, customAngles }) {
  const lines = [
    '',
    'STUDIO DISCUSSION',
    `${hostOne}: Before we close, there’s a studio topic worth its own conversation: ${customCategory} — ${customTopic}. This isn’t a reported news story, so we’ll flag it as analysis rather than reporting.`,
    `${hostTwo}: And we’ll keep it honest — no invented facts, just angles to think with.`,
  ];
  customAngles.forEach((angle, index) => {
    const first = index % 2 === 0 ? hostTwo : hostOne;
    const second = first === hostOne ? hostTwo : hostOne;
    lines.push(
      `${first}: One way into it is ${angle.title}: ${angle.setup}`,
      `${second}: ${angle.question}`,
      `${first}: ${angle.followUp}`,
    );
  });
  return lines;
}

function buildClosing(hostOne, hostTwo, showTitle, threads) {
  const recurring = getRecurringTerms(threads);
  const lines = ['', 'OUTRO'];
  if (recurring.length) {
    lines.push(
      `${hostOne}: As we step back, the phrases ${recurring
        .map((term) => `“${formatSharedTerm(term)}”`)
        .join(' and ')} recurred across multiple headlines and summaries. That’s a thread worth following — but it doesn’t mean every story is part of the same event, and we’ve kept that distinction clear throughout.`,
    );
  } else {
    lines.push(
      `${hostOne}: These reports don’t establish one shared cause, so we’ve treated them as distinct developments and stayed with what each source supports.`,
    );
  }
  lines.push(
    `${hostTwo}: We’ll keep following the questions the reporting leaves open. Check the source notes for the full reports, and join us next time.`,
    `${hostOne}: Thanks for listening to ${showTitle}.`,
  );
  return lines;
}

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
  const { threads } = planConversationArc(stories);
  const lines = [
    showTitle,
    `Target runtime: ${duration} minutes`,
    '[EDITORIAL NOTE — NOT FOR READ-OUT: Use the linked publisher reports for facts. Shared words are a segue, not proof of cause and effect; do not add details that are absent from the source summaries.]',
    '',
    'INTRO',
    ...buildOpening(hostOne, hostTwo, showTitle, threads, customTopic),
  ];

  if (threads.length) {
    lines.push(
      '',
      `SEGMENT 1: ${getStoryCategory(threads[0])} | ${threads[0].headline}`,
      `${hostOne}: Let’s start with “${threads[0].headline}.”`,
      `${hostTwo}: ${summariseStory(threads[0])}`,
    );
    lines.push(...buildFollowUp(hostOne, hostTwo, threads[0], 0));
  }

  for (let index = 1; index < threads.length; index += 1) {
    lines.push(
      '',
      `SEGMENT ${index + 1}: ${getStoryCategory(threads[index])} | ${threads[index].headline}`,
      ...buildBridge(hostOne, hostTwo, threads[index - 1], threads[index]),
    );
    lines.push(...buildFollowUp(hostOne, hostTwo, threads[index], index));
  }

  if (customTopic) {
    lines.push(...buildStudioDiscussion(hostOne, hostTwo, { customTopic, customCategory, customAngles }));
  }

  lines.push(...buildClosing(hostOne, hostTwo, showTitle, threads));

  return lines.join('\n');
}

module.exports = {
  createDailyPodcastRundown,
  orderStoriesForConversation,
  getUsableSummary,
  isLowQualityStreamHeadline,
};