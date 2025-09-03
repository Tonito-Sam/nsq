import axios from 'axios';
import nlp from 'compromise';

export class TextAI {
  // HuggingFace Inference API endpoints
  static grammarEndpoint = 'https://api-inference.huggingface.co/models/vennify/t5-base-grammar-correction';
  static textGenEndpoint = 'https://api-inference.huggingface.co/models/gpt2';

  static async grammarCheckAPI(text: string) {
    try {
      const response = await axios.post(this.grammarEndpoint, { inputs: text }, {
        headers: { Authorization: '' } // Add your HuggingFace token if needed
      });
      return response.data;
    } catch (e) {
      return null;
    }
  }

  static async textGenAPI(text: string) {
    try {
      const response = await axios.post(this.textGenEndpoint, { inputs: text }, {
        headers: { Authorization: '' }
      });
      return response.data;
    } catch (e) {
      return null;
    }
  }

  static async checkGrammar(text: string): Promise<{ corrected: string; suggestions: string[] }> {
    try {
      const result = await this.grammarCheckAPI(text);
      return {
        corrected: result && result[0]?.generated_text ? result[0].generated_text : text,
        suggestions: ['Consider using active voice', 'Check punctuation', 'Verify verb tenses']
      };
    } catch (error) {
      console.error('Grammar check error:', error);
      return { corrected: text, suggestions: [] };
    }
  }

  static analyzeReadability(text: string): { score: number; level: string; suggestions: string[] } {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    // Flesch Reading Ease Score
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

    let level: string;
    let suggestions: string[] = [];

    if (score >= 90) {
      level = 'Very Easy';
    } else if (score >= 80) {
      level = 'Easy';
    } else if (score >= 70) {
      level = 'Fairly Easy';
    } else if (score >= 60) {
      level = 'Standard';
    } else if (score >= 50) {
      level = 'Fairly Difficult';
      suggestions.push('Consider shorter sentences');
    } else if (score >= 30) {
      level = 'Difficult';
      suggestions.push('Use simpler words', 'Break up long sentences');
    } else {
      level = 'Very Difficult';
      suggestions.push('Significantly simplify language', 'Use shorter sentences', 'Replace complex words');
    }

    return { score: Math.round(score), level, suggestions };
  }

  static async adjustTone(text: string, targetTone: 'professional' | 'casual' | 'friendly'): Promise<string> {
    const doc = nlp(text);
    
    switch (targetTone) {
      case 'professional':
        return doc.contractions().expand().text()
          .replace(/\b(gonna|wanna|gotta)\b/gi, (match) => {
            const replacements: { [key: string]: string } = {
              'gonna': 'going to',
              'wanna': 'want to',
              'gotta': 'have to'
            };
            return replacements[match.toLowerCase()] || match;
          })
          .replace(/!+/g, '.');
          
      case 'casual':
        return text.replace(/\b(going to)\b/gi, 'gonna')
          .replace(/\b(want to)\b/gi, 'wanna')
          .replace(/\b(have to)\b/gi, 'gotta');
          
      case 'friendly':
        return text.replace(/\.$/, '!')
          .replace(/\b(Hello)\b/gi, 'Hey')
          .replace(/\b(Thank you)\b/gi, 'Thanks');
          
      default:
        return text;
    }
  }

  static extractKeywords(text: string): string[] {
    const doc = nlp(text);
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    const verbs = doc.verbs().out('array');
    
    return [...new Set([...nouns, ...adjectives, ...verbs])]
      .filter(word => word.length > 2)
      .slice(0, 10);
  }

  private static countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    if (word.endsWith('e')) count--;
    return Math.max(1, count);
  }
}
