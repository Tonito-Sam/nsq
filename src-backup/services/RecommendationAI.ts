
import axios from 'axios';

export class RecommendationAI {
  // HuggingFace Inference API endpoints
  static embedderEndpoint = 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2';
  static classifierEndpoint = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';

  static async classifyText(endpoint: string, content: string, labels?: string[]) {
    try {
      const payload: any = { inputs: content };
      if (labels) payload.parameters = { candidate_labels: labels };
      const response = await axios.post(endpoint, payload, {
        headers: { Authorization: '' } // Add your HuggingFace token if needed
      });
      return response.data;
    } catch (e) {
      return null;
    }
  }

  static async suggestFriends(user: any, allUsers: any[]): Promise<any[]> {
    // No model needed for this logic
    
    const userInterests = user.interests || [];
    const suggestions = [];

    for (const otherUser of allUsers) {
      if (otherUser.id === user.id) continue;

      const otherInterests = otherUser.interests || [];
      const commonInterests = userInterests.filter((interest: string) => 
        otherInterests.includes(interest)
      );

      if (commonInterests.length > 0) {
        const mutualFriends = this.findMutualFriends(user, otherUser);
        
        suggestions.push({
          user: otherUser,
          score: commonInterests.length + mutualFriends.length * 0.5,
          reason: `${commonInterests.length} common interests`,
          mutualFriends: mutualFriends.length
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  static async discoverContent(userPreferences: any, allContent: any[]): Promise<any[]> {
    const userTopics = userPreferences.topics || [];
    const discoveries = [];

    for (const content of allContent) {
      try {
        // Use HuggingFace zero-shot-classification API
        const result = await this.classifyText(this.classifierEndpoint, content.text, userTopics);
        if (result && result.scores && result.scores[0] > 0.5) {
          discoveries.push({
            content,
            relevanceScore: result.scores[0],
            matchedTopic: result.labels[0]
          });
        }
      } catch (error) {
        console.error('Content classification error:', error);
      }
    }

    return discoveries
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }

  static async predictTrendingTopics(recentPosts: any[]): Promise<string[]> {
    const topicFrequency: { [key: string]: number } = {};
    const timeWeight = 0.5; // Recent posts get higher weight

    recentPosts.forEach(post => {
      const age = Date.now() - new Date(post.created_at).getTime();
      const ageInHours = age / (1000 * 60 * 60);
      const weight = Math.max(0.1, 1 - (ageInHours * timeWeight / 24));

      // Extract hashtags and mentions
      const hashtags = post.content.match(/#\w+/g) || [];
      const mentions = post.content.match(/@\w+/g) || [];
      
      [...hashtags, ...mentions].forEach(tag => {
        const cleanTag = tag.substring(1).toLowerCase();
        topicFrequency[cleanTag] = (topicFrequency[cleanTag] || 0) + weight;
      });
    });

    return Object.entries(topicFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic]) => topic);
  }

  static async personalizeContent(content: any[], userBehavior: any): Promise<any[]> {
    const engagementHistory = userBehavior.engagements || [];
    const contentScores = new Map();

    // Analyze user engagement patterns
    const preferredContentTypes = this.analyzePreferredContentTypes(engagementHistory);
    const preferredTimes = this.analyzePreferredTimes(engagementHistory);
    const preferredTopics = this.analyzePreferredTopics(engagementHistory);

    content.forEach(item => {
      let score = 0;
      
      // Content type preference
      if (preferredContentTypes[item.type]) {
        score += preferredContentTypes[item.type] * 0.3;
      }
      
      // Time relevance
      const postHour = new Date(item.created_at).getHours();
      if (preferredTimes[postHour]) {
        score += preferredTimes[postHour] * 0.2;
      }
      
      // Topic relevance
      preferredTopics.forEach(topic => {
        if (item.content.toLowerCase().includes(topic.toLowerCase())) {
          score += 0.5;
        }
      });
      
      // Recency boost
      const age = Date.now() - new Date(item.created_at).getTime();
      const ageInHours = age / (1000 * 60 * 60);
      score += Math.max(0, 1 - (ageInHours / 24)) * 0.2;
      
      contentScores.set(item.id, score);
    });

    return content.sort((a, b) => 
      (contentScores.get(b.id) || 0) - (contentScores.get(a.id) || 0)
    );
  }

  private static findMutualFriends(user1: any, user2: any): any[] {
    const user1Friends = user1.friends || [];
    const user2Friends = user2.friends || [];
    
    return user1Friends.filter((friend: any) => 
      user2Friends.some((f: any) => f.id === friend.id)
    );
  }

  private static analyzePreferredContentTypes(engagements: any[]): { [key: string]: number } {
    const typeFrequency: { [key: string]: number } = {};
    
    engagements.forEach(engagement => {
      const type = engagement.content_type || 'text';
      typeFrequency[type] = (typeFrequency[type] || 0) + 1;
    });
    
    return typeFrequency;
  }

  private static analyzePreferredTimes(engagements: any[]): { [key: number]: number } {
    const timeFrequency: { [key: number]: number } = {};
    
    engagements.forEach(engagement => {
      const hour = new Date(engagement.created_at).getHours();
      timeFrequency[hour] = (timeFrequency[hour] || 0) + 1;
    });
    
    return timeFrequency;
  }

  private static analyzePreferredTopics(engagements: any[]): string[] {
    const topicFrequency: { [key: string]: number } = {};
    
    engagements.forEach(engagement => {
      const content = engagement.content || '';
      const hashtags = content.match(/#\w+/g) || [];
      
      hashtags.forEach(tag => {
        const topic = tag.substring(1).toLowerCase();
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
      });
    });
    
    return Object.entries(topicFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
  }
}
