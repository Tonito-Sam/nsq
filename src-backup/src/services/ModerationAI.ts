
import axios from 'axios';

export class ModerationAI {
  // HuggingFace Inference API endpoints
  static toxicityEndpoint = 'https://api-inference.huggingface.co/models/unitary/toxic-bert';
  static cyberbullyingEndpoint = 'https://api-inference.huggingface.co/models/martin-ha/toxic-comment-model';
  static factCheckerEndpoint = 'https://api-inference.huggingface.co/models/roberta-base-openai-detector';

  static async classifyText(endpoint: string, content: string) {
    try {
      const response = await axios.post(endpoint, { inputs: content }, {
        headers: { Authorization: '' } // Add your HuggingFace token if needed
      });
      return response.data;
    } catch (e) {
      return null;
    }
  }

  static async moderateContent(content: string): Promise<{
    isAppropriate: boolean;
    issues: string[];
    confidence: number;
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let totalConfidence = 0;
    let checks = 0;

    try {
      // Check for toxicity
      const toxicityResult = await this.classifyText(this.toxicityEndpoint, content);
      if (toxicityResult && Array.isArray(toxicityResult) && toxicityResult[0]) {
        if ((toxicityResult[0].label === 'TOXIC' || toxicityResult[0].label === 'toxic') && toxicityResult[0].score > 0.7) {
          issues.push('Toxic content detected');
          suggestions.push('Consider rephrasing to be more respectful');
        }
        totalConfidence += toxicityResult[0].score;
        checks++;
      }

      // Check for cyberbullying
      const bullyingResult = await this.classifyText(this.cyberbullyingEndpoint, content);
      if (bullyingResult && Array.isArray(bullyingResult) && bullyingResult[0]) {
        if ((bullyingResult[0].label === 'TOXIC' || bullyingResult[0].label === 'toxic') && bullyingResult[0].score > 0.6) {
          issues.push('Potential cyberbullying detected');
          suggestions.push('Avoid targeting individuals or groups');
        }
        totalConfidence += bullyingResult[0].score;
        checks++;
      }

      // Check for spam patterns
      if (this.detectSpamPatterns(content)) {
        issues.push('Spam-like content detected');
        suggestions.push('Avoid excessive repetition or promotional language');
      }

      // Check for misinformation indicators
      if (this.detectMisinformationPatterns(content)) {
        issues.push('Potential misinformation detected');
        suggestions.push('Verify facts before sharing');
      }

    } catch (error) {
      console.error('Content moderation error:', error);
    }

    const avgConfidence = checks > 0 ? totalConfidence / checks : 0;

    return {
      isAppropriate: issues.length === 0,
      issues,
      confidence: avgConfidence,
      suggestions
    };
  }

  static async detectMisinformation(content: string): Promise<{
    likelihood: number;
    indicators: string[];
    factCheckSuggestions: string[];
  }> {
    const indicators: string[] = [];
    const factCheckSuggestions: string[] = [];
    
    // Check for misinformation patterns
    const misinfoPatterns = [
      /\b(breaking|urgent|shocking|unbelievable)\b/gi,
      /\b(they don't want you to know|hidden truth|secret)\b/gi,
      /\b(100% effective|guaranteed|miracle)\b/gi,
      /\b(doctors hate this|one weird trick)\b/gi
    ];

    misinfoPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        indicators.push('Sensational language detected');
        factCheckSuggestions.push('Verify claims with reliable sources');
      }
    });

    // Check for unverified medical claims
    if (/\b(cure|treatment|prevents|causes)\b/gi.test(content) && 
        /\b(cancer|covid|virus|disease)\b/gi.test(content)) {
      indicators.push('Medical claims detected');
      factCheckSuggestions.push('Consult medical professionals for health information');
    }

    // Check for conspiracy theory indicators
    if (/\b(conspiracy|cover-up|illuminati|deep state)\b/gi.test(content)) {
      indicators.push('Conspiracy theory language detected');
      factCheckSuggestions.push('Consider multiple credible sources');
    }

    const likelihood = Math.min(indicators.length * 0.3, 1);

    return {
      likelihood,
      indicators,
      factCheckSuggestions
    };
  }

  static async detectCyberbullying(content: string, context?: any): Promise<{
    isBullying: boolean;
    severity: 'low' | 'medium' | 'high';
    patterns: string[];
    interventions: string[];
  }> {
    await this.initializeModels();
    
    const patterns: string[] = [];
    const interventions: string[] = [];
    
    try {
      const result = await this.cyberbullyingDetector(content);
      
      if (result && result[0] && result[0].label === 'TOXIC') {
        const score = result[0].score;
        
        // Check for specific bullying patterns
        if (/\b(ugly|stupid|loser|worthless|kill yourself)\b/gi.test(content)) {
          patterns.push('Personal attacks');
          interventions.push('Remove personal attacks and insults');
        }
        
        if (/\b(nobody likes you|you should die|go away)\b/gi.test(content)) {
          patterns.push('Exclusion and threats');
          interventions.push('Avoid exclusionary or threatening language');
        }
        
        if (content.includes('@') && /\b(embarrassing|humiliating)\b/gi.test(content)) {
          patterns.push('Public humiliation');
          interventions.push('Avoid publicly targeting individuals');
        }
        
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (score > 0.8) severity = 'high';
        else if (score > 0.6) severity = 'medium';
        
        return {
          isBullying: true,
          severity,
          patterns,
          interventions
        };
      }
    } catch (error) {
      console.error('Cyberbullying detection error:', error);
    }
    
    return {
      isBullying: false,
      severity: 'low',
      patterns,
      interventions
    };
  }

  private static detectSpamPatterns(content: string): boolean {
    const spamIndicators = [
      /(.)\1{10,}/, // Repeated characters
      /\b(buy now|click here|limited time|act now)\b/gi,
      /\b(free money|make money fast|work from home)\b/gi,
      /(http|www\.)\S+/g // Multiple URLs
    ];

    return spamIndicators.some(pattern => pattern.test(content));
  }

  private static detectMisinformationPatterns(content: string): boolean {
    const misinfoIndicators = [
      /\b(fake news|mainstream media lies|they're hiding)\b/gi,
      /\b(research shows|studies prove)\b/gi, // Without citations
      /\b(definitely|absolutely|guaranteed)\b/gi // Absolute claims
    ];

    return misinfoIndicators.some(pattern => pattern.test(content));
  }
}
