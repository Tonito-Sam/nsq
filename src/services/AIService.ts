import { ContentOptimizationAI } from './ContentOptimizationAI';
import { VisualAI } from './VisualAI';
import { TextAI } from './TextAI';
import { RecommendationAI } from './RecommendationAI';
import { ModerationAI } from './ModerationAI';

export class AIService {
  // Content Optimization
  static async optimizePost(content: string, userActivity: any[] = []) {
    const [bestTime, engagementScore, performance] = await Promise.all([
      ContentOptimizationAI.getBestPostingTime(userActivity),
      ContentOptimizationAI.predictEngagement(content),
      ContentOptimizationAI.analyzeContentPerformance(userActivity)
    ]);

    return {
      bestPostingTime: bestTime,
      engagementScore,
      performance,
      recommendations: performance.recommendations || []
    };
  }

  // Visual AI
  static async processImage(imageFile: File, operation: string) {
    switch (operation) {
      case 'removeBackground':
        return await VisualAI.removeBackground(imageFile);
      case 'smartCrop':
        return await VisualAI.smartCrop(imageFile);
      case 'generateAltText':
        return await VisualAI.generateAltText(imageFile);
      case 'enhance':
        return await VisualAI.enhanceImage(imageFile, 'brightness');
      default:
        throw new Error(`Unknown image operation: ${operation}`);
    }
  }

  // Text AI
  static async enhanceText(text: string, operation: string) {
    switch (operation) {
      case 'grammar':
        return await TextAI.checkGrammar(text);
      case 'readability':
        return TextAI.analyzeReadability(text);
      case 'tone':
        return await TextAI.adjustTone(text, 'professional');
      case 'keywords':
        return TextAI.extractKeywords(text);
      default:
        throw new Error(`Unknown text operation: ${operation}`);
    }
  }

  // Smart Recommendations
  static async getRecommendations(user: any, context: any) {
    const [friendSuggestions, contentDiscovery, trendingTopics] = await Promise.all([
      RecommendationAI.suggestFriends(user, context.allUsers || []),
      RecommendationAI.discoverContent(user.preferences || {}, context.allContent || []),
      RecommendationAI.predictTrendingTopics(context.recentPosts || [])
    ]);

    return {
      friendSuggestions,
      contentDiscovery,
      trendingTopics
    };
  }

  // Moderation
  static async moderateContent(content: string) {
    const [moderation, misinformation, cyberbullying] = await Promise.all([
      ModerationAI.moderateContent(content),
      ModerationAI.detectMisinformation(content),
      ModerationAI.detectCyberbullying(content)
    ]);

    return {
      moderation,
      misinformation,
      cyberbullying,
      isAppropriate: moderation.isAppropriate && 
                     misinformation.likelihood < 0.7 && 
                     !cyberbullying.isBullying
    };
  }

  // Personalization
  static async personalizeUserExperience(user: any, content: any[], userBehavior: any) {
    const personalizedContent = await RecommendationAI.personalizeContent(content, userBehavior);
    
    return {
      personalizedFeed: personalizedContent,
      optimalNotificationTime: this.calculateOptimalNotificationTime(userBehavior),
      contentFilters: this.generateContentFilters(user.preferences || {})
    };
  }

  // Accessibility
  static async enhanceAccessibility(content: any) {
    const enhancements = [];

    // Auto-generate alt text for images
    if (content.images && content.images.length > 0) {
      for (const image of content.images) {
        const altText = await VisualAI.generateAltText(image);
        enhancements.push({
          type: 'altText',
          element: image,
          enhancement: altText
        });
      }
    }

    // Readability analysis
    if (content.text) {
      const readability = TextAI.analyzeReadability(content.text);
      if (readability.score < 60) {
        enhancements.push({
          type: 'readability',
          element: 'text',
          enhancement: readability.suggestions
        });
      }
    }

    return enhancements;
  }

  private static calculateOptimalNotificationTime(userBehavior: any): string {
    const activityTimes = userBehavior.loginTimes || [];
    const timeFrequency: { [key: number]: number } = {};

    activityTimes.forEach((time: string) => {
      const hour = new Date(time).getHours();
      timeFrequency[hour] = (timeFrequency[hour] || 0) + 1;
    });

    const optimalHour = Object.entries(timeFrequency)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '9';

    return `${optimalHour}:00`;
  }

  private static generateContentFilters(preferences: any): string[] {
    const filters = [];
    
    if (preferences.interests) {
      filters.push(...preferences.interests.map((interest: string) => `#${interest}`));
    }
    
    if (preferences.blockedTopics) {
      filters.push(...preferences.blockedTopics.map((topic: string) => `!${topic}`));
    }
    
    return filters;
  }
}
