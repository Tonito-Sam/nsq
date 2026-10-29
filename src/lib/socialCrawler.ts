import type { CrawlerConfig, CrawlerResponse, CrawlerStoryItem, SocialPlatform } from './crawler.types';

const defaultConfig: CrawlerConfig = {
  platforms: ['twitter', 'tiktok', 'facebook', 'youtube', 'instagram'],
  categories: ['Sports Update', 'Lifestyle', 'Entertainment Segment', 'Current Affairs'],
  maxItemsPerPlatform: 3,
  refreshInterval: 30,
  keywords: ['Africa', 'trending', 'today'],
  location: 'South Africa',
};

const buildStories = (): CrawlerStoryItem[] => [
  {
    id: 'twitter-1',
    platform: 'twitter',
    category: 'Sports Update',
    headline: 'World Cup buzz is climbing across Africa',
    summary: 'Football fans are reacting to the latest tournament build-up and next-match talk.',
    source: 'Twitter',
    angle: 'Build a sports segment around fan excitement and likely outcomes.',
    pollSuggestion: 'Poll: Who do you think will win the next big match?',
  },
  {
    id: 'tiktok-1',
    platform: 'tiktok',
    category: 'Lifestyle',
    headline: 'Cost-of-living pressure is trending across social video',
    summary: 'Audiences are sharing everyday pressure around transport, food, and power costs.',
    source: 'TikTok',
    angle: 'Turn the trend into a relatable lifestyle update for the morning audience.',
    pollSuggestion: 'Poll: Which issue is hitting you hardest this week?',
  },
  {
    id: 'instagram-1',
    platform: 'instagram',
    category: 'Entertainment Segment',
    headline: 'Festival season clips are driving conversation online',
    summary: 'Short-form entertainment content is dominating attention as festival culture spikes.',
    source: 'Instagram',
    angle: 'Keep the segment light, shareable, and built around what people are already watching.',
    pollSuggestion: 'Poll: Which entertainment headline should we unpack first?',
  },
];

export const crawlStories = async (
  config: Partial<CrawlerConfig> = {}
): Promise<CrawlerResponse> => {
  const mergedConfig = { ...defaultConfig, ...config };
  const stories = buildStories()
    .filter((story) => mergedConfig.platforms.includes(story.platform as SocialPlatform))
    .slice(0, mergedConfig.maxItemsPerPlatform);

  return {
    generatedAt: new Date().toISOString(),
    items: stories,
    focus: mergedConfig.keywords?.join(', '),
    audience: mergedConfig.location,
  };
};
