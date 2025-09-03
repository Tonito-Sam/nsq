import axios from 'axios';


export class ContentOptimizationAI {
  static HF_API_URL = 'https://api-inference.huggingface.co/models';
  static HF_API_TOKEN = '<YOUR_HUGGINGFACE_API_TOKEN>'; // Replace with your token or use env

  // Analyze user's posting patterns and engagement
  static async getBestPostingTime(userActivity: any[]): Promise<string> {
    const hourlyEngagement = new Array(24).fill(0);
    const hourlyPosts = new Array(24).fill(0);
    userActivity.forEach(activity => {
      const hour = new Date(activity.created_at).getHours();
      hourlyEngagement[hour] += activity.engagement || 0;
      hourlyPosts[hour] += 1;
    });
    const avgEngagement = hourlyEngagement.map((eng, i) => hourlyPosts[i] > 0 ? eng / hourlyPosts[i] : 0);
    const bestHour = avgEngagement.indexOf(Math.max(...avgEngagement));
    return `${bestHour}:00`;
  }

  static async predictEngagement(content: string): Promise<number> {
    // Use HuggingFace sentiment analysis API
    try {
      const response = await axios.post(
        `${this.HF_API_URL}/cardiffnlp/twitter-roberta-base-sentiment-latest`,
        { inputs: content },
        {
          headers: {
            Authorization: `Bearer ${this.HF_API_TOKEN}`,
            'Accept': 'application/json',
          },
        }
      );
      const sentiment = response.data && response.data[0] ? response.data[0] : { label: 'NEUTRAL' };
      // Calculate engagement score based on multiple factors
      const factors = {
        length: Math.min(content.length / 280, 1),
        sentiment: sentiment.label === 'POSITIVE' ? 1 : sentiment.label === 'NEUTRAL' ? 0.7 : 0.4,
        hashtags: (content.match(/#\w+/g) || []).length * 0.1,
        mentions: (content.match(/@\w+/g) || []).length * 0.15,
        questions: (content.match(/\?/g) || []).length * 0.2,
        emojis: (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length * 0.1
      };
      const engagementScore = Math.min(
        (factors.length * 0.2 + factors.sentiment * 0.3 + factors.hashtags + factors.mentions + factors.questions + factors.emojis) * 100,
        100
      );
      return Math.round(engagementScore);
    } catch (error) {
      return 50; // fallback
    }
  }

  static async analyzeContentPerformance(posts: any[]): Promise<any> {
    const analytics = {
      averageEngagement: 0,
      topPerformingTimes: [],
      contentTypes: {},
      sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
      recommendations: []
    };

    let totalEngagement = 0;
    const timePerformance: { [key: string]: number[] } = {};

    for (const post of posts) {
      totalEngagement += post.engagement || 0;
      
      // Track performance by hour
      const hour = new Date(post.created_at).getHours();
      if (!timePerformance[hour]) timePerformance[hour] = [];
      timePerformance[hour].push(post.engagement || 0);

      // Analyze sentiment
      try {
        await this.initializeModels();
        const sentiment = await this.sentimentAnalyzer(post.content);
        analytics.sentimentDistribution[sentiment[0].label.toLowerCase()]++;
      } catch (error) {
        console.error('Sentiment analysis error:', error);
      }
    }

    analytics.averageEngagement = totalEngagement / posts.length;

    // Find top performing times
    analytics.topPerformingTimes = Object.entries(timePerformance)
      .map(([hour, engagements]) => ({
        hour: parseInt(hour),
        avgEngagement: engagements.reduce((a, b) => a + b, 0) / engagements.length
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    // Generate recommendations
    if (analytics.sentimentDistribution.positive > analytics.sentimentDistribution.negative) {
      analytics.recommendations.push("Your positive content performs well! Continue sharing uplifting posts.");
    }
    if (analytics.averageEngagement < 50) {
      analytics.recommendations.push("Try asking more questions to increase engagement.");
    }

    return analytics;
  }
}
