import type { CrawlerStoryItem } from '@/lib/crawler.types';

export type PresenterStoryPlanItem = {
  label: string;
  story: string;
  priority: string;
};

export type SegmentFormat = 'Panel Discussion' | 'Report' | 'Analysis' | 'Interactive' | 'Podcast Interview';

export type PresenterTimeSlot = {
  start: string;
  end: string;
  duration: number;
  day?: string;
  timezone?: string;
};

export type PresenterBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  backgroundClass: string;
  accentClass: string;
  scheduleLabel: string;
  timezone: string;
  day: string;
};

export type PresenterSegmentContent = {
  opening: string;
  mainSegment: string[];
  keyPoints: string[];
  analysis: string;
  closing: string;
};

export type PresenterAudienceInteraction = {
  pollSuggestion: string;
  callToAction: string;
  socialMediaPrompt: string;
};

export type PresenterSegment = {
  id: string;
  title: string;
  subtitle?: string;
  host: string;
  coHost?: string;
  guest?: string;
  category: string;
  format: SegmentFormat;
  content: string;
  contentBlocks: PresenterSegmentContent;
  hostDialogue: string;
  timeSlot: PresenterTimeSlot;
  totalDuration: number;
  duration: number;
  cue: string;
  audioCue: string;
  videoCue: string;
  slidePrompt: string;
  graphicSuggestion: string;
  visual: string;
  audienceInteraction?: PresenterAudienceInteraction;
  banner: PresenterBanner;
  sources?: string[];
  credits?: string[];
  productionNotes?: string;
};

export type PresenterSlide = {
  title: string;
  caption: string;
  imageHint: string;
};

export type PresenterCrawlerItem = {
  category: string;
  source: string;
  headline: string;
  summary: string;
  angle: string;
  pollSuggestion?: string;
};

export type PresenterPreview = {
  title: string;
  runtime: string;
  opening: string;
  hostExchange: string[];
  closing: string;
  pollPrompt?: string;
};

export type PresenterScheduleSegment = {
  category: string;
  startTime: string;
  endTime: string;
  host: string;
  duration: number;
  day: string;
  timezone: string;
  broadcastLabel: string;
};

export type PresenterBroadcastBranding = {
  parentShowTitle: string;
  channelName: string;
  broadcastWindow: string;
  timezone: string;
};

export type PresenterBlueprint = {
  showTitle: string;
  theme: string;
  audience: string;
  focus: string;
  intro: string;
  branding: PresenterBroadcastBranding;
  schedule: {
    date: string;
    showTitle: string;
    totalDuration: number;
    segments: PresenterScheduleSegment[];
  };
  segments: PresenterSegment[];
  slides: PresenterSlide[];
  showPlanner: {
    selectedTopics: string[];
    storyPlan: PresenterStoryPlanItem[];
    segmentTopics?: Record<string, string[]>;
  };
  sourceFeed: PresenterCrawlerItem[];
  preview: PresenterPreview;
  opening: string;
  closing: string;
};

export type PresenterSettings = {
  showTitle: string;
  topics: string;
  focus: string;
  audience: string;
  tone: string;
  hostNames: string;
  segmentCount: string;
};

export const defaultPresenterSettings: PresenterSettings = {
  showTitle: "Mic'd",
  topics: "Politics, Global News, Sports, Markets & Business, Technology, Education, Health, Entertainment, Gossip/Celebrity",
  focus: "African and global news with a sharp broadcast-ready energy",
  audience: "Africa",
  tone: "energetic",
  hostNames: "Maya, Kofi",
  segmentCount: "8"
};

export const buildShowDraftFromBlueprint = (blueprint: PresenterBlueprint) => ({
  title: blueprint.showTitle,
  description: [
    blueprint.intro,
    '',
    `Planner: ${blueprint.showPlanner.storyPlan.map((item) => `${item.label}: ${item.story}`).join(' | ')}`,
    '',
    `Schedule: ${blueprint.schedule.segments.map((segment) => `${segment.category} ${segment.startTime}-${segment.endTime}`).join(' | ')}`,
    '',
    `Crawler feed: ${blueprint.sourceFeed.map((item) => `${item.category} :: ${item.headline}`).join(' | ')}`,
    '',
    `Preview: ${blueprint.preview.opening} ${blueprint.preview.hostExchange.join(' ')} ${blueprint.preview.closing}`,
    '',
    `Live poll prompt: ${blueprint.preview.pollPrompt || 'No poll prompt generated yet.'}`,
    '',
    ...blueprint.segments.map((segment) => `• ${segment.title} (${segment.category}) [${segment.timeSlot.start}-${segment.timeSlot.end}, ${segment.totalDuration / 60}m]: ${segment.content}`),
    '',
    blueprint.closing,
  ].join('\n\n'),
  category: blueprint.theme.includes('breakfast') ? "Mic'd Breakfast Show" : 'News',
  show_type: 'show' as const,
  is_live: true,
  is_active: true,
});

const buildTopicLine = (topic: string, focus: string, audience: string, tone: string) => {
  const normalized = topic.trim();
  const regionalAngle = audience.toLowerCase().includes('africa')
    ? `and how it affects audiences across Africa`
    : 'and why it matters right now';

  return `${normalized} is trending ${regionalAngle}. The ${tone} angle is to unpack the headline, give listeners the context, and move the conversation forward with a clear takeaway for the morning crowd. ${focus}`;
};

const buildSportsLine = (topic: string, focus: string, audience: string, tone: string) => {
  const normalized = topic.trim();
  return `${normalized} is shaping the conversation around the current competition. The ${tone} angle is to talk through who has qualified, who is out, who is playing next, who could still win, and what the likely score line and performance outlook might be. ${focus} ${audience.toLowerCase().includes('africa') ? 'This is especially relevant for football fans across Africa.' : ''}`;
};

const getTimelyStoryBank = (topics: string[]) => {
  const normalized = topics.join(' ').toLowerCase();
  const platforms = ['Twitter', 'TikTok', 'Facebook', 'YouTube', 'Instagram'];
  const stories = [
    {
      topic: 'Planned protest over African migrants in South Africa',
      category: 'Politics',
      headline: 'Social conversation spikes around the planned protest over African migrants in South Africa',
      summary: 'The issue is generating a major social-media storm as users debate migration, public order, and the human impact of the protest.',
      angle: 'Use the trend to explain why the story is breaking across both traditional media and social platforms.',
      source: platforms[0],
      pollSuggestion: 'Poll: Do you think the protest will change public opinion or escalate further this week?',
    },
    {
      topic: 'FIFA World Cup build-up and African football momentum',
      category: 'Sports',
      headline: 'Football fans are pushing FIFA World Cup talk across Twitter, TikTok, and YouTube',
      summary: 'The World Cup is trending online as fans compare teams, share highlights, and react to every update in real time.',
      angle: 'Turn the social buzz into a sports segment with context and audience energy.',
      source: platforms[1],
      pollSuggestion: 'Poll: Who do you think will win the next big match and what score line do you expect?',
    },
    {
      topic: 'Cost-of-living pressure and commuter frustration',
      category: 'Markets & Business',
      headline: 'Cost-of-living pressure is trending across Facebook and Instagram as everyday consumers speak up',
      summary: 'Users are sharing stories about transport costs, food prices, and everyday pressure, making it a strong lifestyle and public-affairs conversation.',
      angle: 'Translate online frustration into an everyday conversation that feels relatable and timely.',
      source: platforms[3],
      pollSuggestion: 'Poll: Which daily issue is hurting you most right now — transport, food prices, or power costs?',
    },
    {
      topic: 'Entertainment and festival season headlines',
      category: 'Entertainment',
      headline: 'Festival season and entertainment clips are driving engagement across Instagram and TikTok',
      summary: 'Short-form entertainment content is dominating attention as users react to releases, celebrity moments, and festival culture.',
      angle: 'Keep the segment light, shareable, and built around what people are already talking about online.',
      source: platforms[4],
      pollSuggestion: 'Poll: Which entertainment headline do you think will trend the most this week?',
    },
  ];

  const selected = [] as typeof stories;

  if (normalized.includes('politic') || normalized.includes('news') || normalized.includes('current')) {
    selected.push(stories[0]);
  }
  if (normalized.includes('sport') || normalized.includes('football') || normalized.includes('world cup')) {
    selected.push(stories[1]);
  }
  if (normalized.includes('market') || normalized.includes('business') || normalized.includes('economy')) {
    selected.push(stories[2]);
  }
  if (normalized.includes('entertain') || normalized.includes('music') || normalized.includes('culture')) {
    selected.push(stories[3]);
  }

  if (selected.length === 0) {
    return stories.slice(0, 3);
  }

  return selected;
};

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return (hours || 0) * 60 + (minutes || 0);
};

const formatMinutes = (value: number) => {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const DEFAULT_SEGMENT_ORDER = ['Politics', 'The Outlook', 'Global News', 'Sports', 'Markets & Business', 'Technology', 'Education', 'Health', 'Entertainment', 'Gossip/Celebrity'] as const;

const SEGMENT_DURATION_BY_CATEGORY: Record<string, number> = {
  Politics: 45,
  'The Outlook': 60,
  'Global News': 30,
  Sports: 45,
  'Markets & Business': 30,
  Technology: 30,
  Education: 30,
  Health: 30,
  Entertainment: 30,
  'Gossip/Celebrity': 30,
};

const SEGMENT_FORMAT_BY_CATEGORY: Record<string, SegmentFormat> = {
  Politics: 'Panel Discussion',
  'The Outlook': 'Podcast Interview',
  'Global News': 'Report',
  Sports: 'Report',
  'Markets & Business': 'Analysis',
  Technology: 'Analysis',
  Education: 'Analysis',
  Health: 'Analysis',
  Entertainment: 'Interactive',
  'Gossip/Celebrity': 'Interactive',
};

const DEFAULT_SEGMENT_TOPICS: Record<string, string[]> = {
  Politics: ['Government policy', 'Election updates', 'Public accountability'],
  'The Outlook': ['Critical topics across Africa', 'Trending issues', 'Guest interviews'],
  'Global News': ['International diplomacy', 'World headlines', 'Humanitarian updates'],
  Sports: ['Matchday updates', 'Player form', 'Tournament outlook'],
  'Markets & Business': ['Market movement', 'Business headlines', 'Economic outlook'],
  Technology: ['AI developments', 'Cybersecurity', 'Digital trends'],
  Education: ['Policy changes', 'Student support', 'Learning innovation'],
  Health: ['Public health', 'Wellness news', 'Medical research'],
  Entertainment: ['Streaming releases', 'Live events', 'Celeb updates'],
  'Gossip/Celebrity': ['Social buzz', 'Fan reactions', 'Celebrity headlines'],
};

const buildSegmentContent = (category: string, topic: string, focus: string, audience: string, tone: string) => {
  const opening = `${category} coverage is live and we are opening with ${topic.toLowerCase()}.`;
  const relevantKeyPoints = [topic, `${category} context for today`, `${focus}`];
  const analysis = category === 'Sports'
    ? buildSportsLine(topic, focus, audience, tone)
    : buildTopicLine(topic, focus, audience, tone);

  return {
    opening,
    mainSegment: [
      `We are unpacking the biggest developments around ${topic.toLowerCase()} for the audience.`,
      `We will keep the conversation sharp, current, and useful for the morning audience.`,
      `This segment is designed to give listeners the facts, context, and a clear takeaway.`,
    ],
    keyPoints: relevantKeyPoints.slice(0, 3),
    analysis,
    closing: `That wraps up our ${category.toLowerCase()} segment. Stay with us for the next update.`,
  };
};

const buildHostDialogue = (topic: string, hostA: string, hostB: string, tone: string) => {
  const opener = `${hostA}: “We are watching ${topic.toLowerCase()} closely today.”`;
  const response = `${hostB}: “And the ${tone} takeaway is simple: this matters because it changes the conversation.”`;
  return `${opener} ${response}`;
};

const buildBannerForSegment = (
  category: string,
  topic: string,
  startTime: string,
  day: string,
  timezone: string,
  parentShowTitle: string,
  channelName: string,
  broadcastWindow: string,
): PresenterBanner => {
  const label = category === 'The Outlook' ? 'The Outlook' : category;
  const scheduleLabel = `${startTime} ${timezone}`;

  switch (category) {
    case 'Politics':
      return {
        id: 'banner-politics',
        title: `${parentShowTitle} • Politics`,
        subtitle: 'Policy, power, and accountability',
        description: `${parentShowTitle} on ${channelName} runs from ${broadcastWindow}; ${topic} is unpacked with sharp context and direct analysis.`,
        badge: `${parentShowTitle} • ${channelName} • Live`,
        backgroundClass: 'from-slate-900 via-indigo-800 to-violet-700',
        accentClass: 'border-indigo-300 text-indigo-100',
        scheduleLabel,
        timezone,
        day,
      };
    case 'The Outlook':
      return {
        id: 'banner-outlook',
        title: `${parentShowTitle} • The Outlook`,
        subtitle: 'Wednesday talk-show interview',
        description: `${parentShowTitle} on ${channelName} brings a Wednesday spotlight to critical topics and trending issues across Africa, with room for a guest interview.`,
        badge: `Wednesday • 10:00 ${timezone}`,
        backgroundClass: 'from-amber-500 via-orange-600 to-rose-700',
        accentClass: 'border-amber-200 text-amber-50',
        scheduleLabel: '10:00 SAST',
        timezone: 'SAST',
        day: 'Wednesday',
      };
    case 'Sports':
      return {
        id: 'banner-sports',
        title: `${parentShowTitle} • Sports`,
        subtitle: 'Scoreline, form, and momentum',
        description: `${parentShowTitle} on ${channelName} brings ${topic} to life with matchday context, performance outlook, and the latest talking points.`,
        badge: `${parentShowTitle} • ${channelName} • Live`,
        backgroundClass: 'from-emerald-600 via-green-700 to-lime-700',
        accentClass: 'border-emerald-200 text-emerald-50',
        scheduleLabel,
        timezone,
        day,
      };
    default:
      return {
        id: `banner-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: `${parentShowTitle} • ${label}`,
        subtitle: 'Current updates and live context',
        description: `${parentShowTitle} on ${channelName} covers ${topic} with clear, polished broadcast framing.`,
        badge: `${label} • Live`,
        backgroundClass: 'from-purple-700 via-slate-900 to-blue-700',
        accentClass: 'border-purple-200 text-purple-50',
        scheduleLabel,
        timezone,
        day,
      };
  }
};

export const generatePresenterBlueprint = (
  {
    showTitle,
    topics,
    focus,
    audience,
    tone,
    hostNames,
    segmentCount,
  }: PresenterSettings,
  crawlerStories: CrawlerStoryItem[] = []
): PresenterBlueprint => {
  const parsedTopics = topics
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean);

  const parsedCount = Number.parseInt(segmentCount, 10);
  const totalSegments = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.min(Math.max(parsedCount, 2), DEFAULT_SEGMENT_ORDER.length) : 8;
  const selectedCategories = DEFAULT_SEGMENT_ORDER.slice(0, totalSegments);
  const parsedHosts = hostNames
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const resolvedHosts = parsedHosts.length > 0 ? parsedHosts : ['Host A', 'Host B'];

  const topicSeed = crawlerStories[0]?.headline;
  const selectedTopics = [...(topicSeed ? [topicSeed] : []), ...(parsedTopics.length > 0 ? parsedTopics : selectedCategories)];
  const channelName = '1Studio';
  const parentShowTitle = 'Mic\'d';
  const broadcastWindow = '06:00-12:00 SAST';
  const branding = { parentShowTitle, channelName, broadcastWindow, timezone: 'SAST' };
  const crawlerTopics = crawlerStories.map((story) => story.headline).filter(Boolean);
  const mergedTopics = [...selectedTopics, ...crawlerTopics].filter(Boolean).slice(0, Math.max(selectedTopics.length, 4));

  let currentStart = parseTimeToMinutes('06:00');
  const segmentEntries = selectedCategories.map((category, index) => {
    const seededStory = crawlerStories.find((story) => story.category.toLowerCase() === category.toLowerCase() || story.category.toLowerCase().includes(category.toLowerCase().split(' ')[0])) || crawlerStories[index % Math.max(crawlerStories.length, 1)] || getTimelyStoryBank(selectedTopics)[index % 4];
    const fallbackTopic = DEFAULT_SEGMENT_TOPICS[category][0] || 'today’s top headlines';
    const topic = seededStory?.headline || fallbackTopic;
    const summary = seededStory?.summary || `Today’s ${category.toLowerCase()} update is being shaped by the breaking conversation.`;
    const source = seededStory?.source || 'Live newsroom feed';
    const pollSuggestion = seededStory?.pollSuggestion || `Poll: What matters most in today’s ${category.toLowerCase()} coverage?`;
    const duration = SEGMENT_DURATION_BY_CATEGORY[category] || 30;
    const format = SEGMENT_FORMAT_BY_CATEGORY[category] || 'Report';
    const host = resolvedHosts[index % resolvedHosts.length];
    const coHost = resolvedHosts.length > 1 ? resolvedHosts[(index + 1) % resolvedHosts.length] : undefined;
    const guest = category === 'The Outlook' ? 'guest interview with an AI agent or real human' : undefined;
    const day = category === 'The Outlook' ? 'Wednesday' : 'Daily';
    const timezone = 'SAST';
    const start = category === 'The Outlook' ? parseTimeToMinutes('10:00') : currentStart;
    const end = category === 'The Outlook' ? start + duration : currentStart + duration;
    if (category !== 'The Outlook') {
      currentStart = end;
    }
    const startTime = formatMinutes(start);
    const endTime = formatMinutes(end);
    const banner = buildBannerForSegment(category, topic, startTime, day, timezone, parentShowTitle, channelName, broadcastWindow);

    return {
      category,
      title: category === 'The Outlook' ? 'The Outlook: Critical conversations across Africa' : `${category}: ${topic}`,
      subtitle: category === 'The Outlook'
        ? 'Weekly Wednesday podcast-style interview for critical topics and trending issues across Africa'
        : `Live ${duration}-minute segment with ${format.toLowerCase()} coverage`,
      host,
      coHost,
      guest,
      format,
      contentBlocks: buildSegmentContent(category, topic, focus, audience, tone),
      content: buildSegmentContent(category, topic, focus, audience, tone).analysis,
      hostDialogue: buildHostDialogue(topic, host, coHost || resolvedHosts[0], tone),
      timeSlot: {
        start: startTime,
        end: endTime,
        duration,
        day,
        timezone,
      },
      totalDuration: duration * 60,
      duration: duration * 60,
      cue: `Bridge into ${category.toLowerCase()} coverage with a clear handoff.`,
      audioCue: `News bed and transition sting for ${category.toLowerCase()} coverage.`,
      videoCue: `Switch to ${category.toLowerCase()} graphics and branded lower-third.`,
      slidePrompt: `Create a clean slide for ${category.toLowerCase()} with the biggest headline and three key points.`,
      graphicSuggestion: `Use branded ${category.toLowerCase()} lower-thirds, a ticker, and a full-screen stat card.`,
      visual: `Animated ${category.toLowerCase()} board with a polished broadcast overlay.`,
      banner,
      audienceInteraction: {
        pollSuggestion: category === 'The Outlook' ? 'Poll: What critical issue should our guest unpack next?' : pollSuggestion,
        callToAction: `Share your thoughts on ${category.toLowerCase()} using #${showTitle.replace(/\s+/g, '').toLowerCase()}`,
        socialMediaPrompt: category === 'The Outlook'
          ? 'Invite the audience to suggest a guest or topic for the next Wednesday interview.'
          : `Ask the audience to join the conversation on ${category.toLowerCase()} updates.`,
      },
      sources: [source],
      credits: ['Produced by the newsroom desk'],
      productionNotes: category === 'The Outlook'
        ? 'Weekly Wednesday podcast-style interview with room for a live guest or AI agent.'
        : `${format} format for a ${duration}-minute slot.`,
      summary,
      pollSuggestion,
      source,
    };
  });

  const storyPlan = segmentEntries.map((entry, index) => ({
    label: entry.category,
    story: `${entry.title} — ${entry.contentBlocks.analysis}`,
    priority: index === 0 ? 'Lead' : index === 1 ? 'Follow-up' : 'Support',
  }));

  const segments: PresenterSegment[] = segmentEntries.map((entry) => ({
    id: `segment-${entry.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: entry.title,
    subtitle: entry.subtitle,
    host: entry.host,
    coHost: entry.coHost,
    guest: entry.guest,
    category: entry.category,
    format: entry.format,
    content: entry.content,
    contentBlocks: entry.contentBlocks,
    hostDialogue: entry.hostDialogue,
    timeSlot: entry.timeSlot,
    totalDuration: entry.totalDuration,
    duration: entry.duration,
    cue: entry.cue,
    audioCue: entry.audioCue,
    videoCue: entry.videoCue,
    slidePrompt: entry.slidePrompt,
    graphicSuggestion: entry.graphicSuggestion,
    visual: entry.visual,
    banner: entry.banner,
    audienceInteraction: entry.audienceInteraction,
    sources: entry.sources,
    credits: entry.credits,
    productionNotes: entry.productionNotes,
  }));

  const slides: PresenterSlide[] = segments.map((segment) => ({
    title: segment.title,
    caption: `${segment.contentBlocks.keyPoints.slice(0, 2).join(' • ')}`,
    imageHint: `${segment.category} visual board for ${showTitle}`,
  }));

  const sourceFeed: PresenterCrawlerItem[] = segmentEntries.map((entry) => ({
    category: entry.category,
    source: entry.source,
    headline: entry.title,
    summary: entry.summary,
    angle: entry.contentBlocks.analysis,
    pollSuggestion: entry.pollSuggestion,
  }));

  const preview: PresenterPreview = {
    title: `${showTitle} broadcast preview`,
    runtime: `${segments.reduce((total, segment) => total + segment.totalDuration, 0) / 60} minutes`,
    opening: `Good morning, Africa — this is ${parentShowTitle} on ${channelName}, and we are opening with ${segments[0]?.title || 'today’s top headlines'} as the first scheduled conversation of the breakfast show from 06:00 to 12:00 SAST.`,
    hostExchange: [
      `${segments[0]?.host}: “We are starting with ${segments[0]?.category.toLowerCase()} and will move through the full news hour with direct, clear coverage.”`,
      `${segments[1]?.host || resolvedHosts[0]}: “The next segment follows at the same pace, with the same focus on facts and context.”`,
    ],
    closing: `That brings us to the end of today’s structured broadcast. Stay with us as the next update begins.`,
    pollPrompt: segments[0]?.audienceInteraction?.pollSuggestion || 'Poll: What matters most in today’s news? ',
  };

  return {
    showTitle,
    theme: `Structured breakfast flow for ${parentShowTitle}`,
    audience,
    focus,
    branding,
    intro: `Good morning, Africa — this is ${parentShowTitle} on ${channelName}. We are bringing you a structured breakfast show from ${broadcastWindow} with ${segments.length} dedicated segments, each designed for a focused, broadcast-ready conversation around ${mergedTopics.join(', ')}.`,
    schedule: {
      date: new Date().toISOString().split('T')[0],
      showTitle,
      totalDuration: segments.reduce((total, segment) => total + segment.totalDuration, 0) / 60,
      segments: segments.map((segment) => ({
        category: segment.category,
        startTime: segment.timeSlot.start,
        endTime: segment.timeSlot.end,
        host: segment.host,
        duration: segment.totalDuration / 60,
        day: segment.timeSlot.day || 'Daily',
        timezone: segment.timeSlot.timezone || 'SAST',
        broadcastLabel: `${segment.timeSlot.start} ${segment.timeSlot.timezone || 'SAST'}${segment.category === 'The Outlook' ? ' • Wednesday' : ''}`,
      })),
    },
    segments,
    slides,
    showPlanner: {
      selectedTopics: selectedTopics,
      storyPlan,
      segmentTopics: Object.fromEntries(segmentEntries.map((entry) => [entry.category, [entry.contentBlocks.analysis, entry.summary]])),
    },
    sourceFeed,
    preview,
    opening: `Welcome to ${parentShowTitle} on ${channelName}. We have ${segments.length} dedicated segments covering politics, the weekly Outlook interview, global news, sports, markets, technology, education, health, entertainment, and gossip inside the breakfast window from ${broadcastWindow}.`,
    closing: `That concludes today’s ${parentShowTitle} breakfast show. Join us again for the next update and keep your voice in the conversation.`,
  };
};
