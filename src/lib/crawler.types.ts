export type SocialPlatform = 'twitter' | 'tiktok' | 'facebook' | 'youtube' | 'instagram';

export interface CrawlerStoryItem {
  id: string;
  platform: SocialPlatform;
  category: string;
  headline: string;
  summary: string;
  source: string;
  angle: string;
  publishedAt?: string;
  url?: string;
  engagement?: number;
  tags?: string[];
  pollSuggestion?: string;
}

export interface CrawlerConfig {
  platforms: SocialPlatform[];
  categories: string[];
  maxItemsPerPlatform: number;
  refreshInterval: number;
  keywords?: string[];
  location?: string;
}

export interface CrawlerResponse {
  generatedAt: string;
  items: CrawlerStoryItem[];
  focus?: string;
  audience?: string;
}
