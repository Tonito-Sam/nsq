import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AIService } from '@/services/AIService';
import { Brain, Image, Type, Users, Shield, Sparkles } from 'lucide-react';

export const AIToolkit = () => {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleContentOptimization = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const optimization = await AIService.optimizePost(content);
      setResults({ ...results, optimization });
      toast({
        title: "Content Optimized",
        description: `Engagement score: ${optimization.engagementScore}%`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to optimize content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageProcessing = async (operation: string) => {
    if (!imageFile) return;
    
    setLoading(true);
    try {
      const result = await AIService.processImage(imageFile, operation);
      setResults({ ...results, [operation]: result });
      toast({
        title: "Image Processed",
        description: `${operation} completed successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to process image: ${operation}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTextEnhancement = async (operation: string) => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const result = await AIService.enhanceText(content, operation);
      setResults({ ...results, [operation]: result });
      toast({
        title: "Text Enhanced",
        description: `${operation} analysis completed`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to enhance text: ${operation}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModeration = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      const moderation = await AIService.moderateContent(content);
      setResults({ ...results, moderation });
      toast({
        title: "Content Moderated",
        description: moderation.isAppropriate ? "Content approved" : "Issues detected",
        variant: moderation.isAppropriate ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to moderate content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Toolkit</h1>
        <p className="text-gray-600">Comprehensive AI-powered content enhancement tools</p>
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Smart
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Safety
          </TabsTrigger>
          <TabsTrigger value="accessibility" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Optimization AI</CardTitle>
              <CardDescription>Optimize your posts for maximum engagement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter your post content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px]"
              />
              <Button onClick={handleContentOptimization} disabled={loading}>
                {loading ? 'Analyzing...' : 'Optimize Content'}
              </Button>
              
              {results.optimization && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">
                      Best time: {results.optimization.bestPostingTime}
                    </Badge>
                    <Badge variant="outline">
                      Engagement: {results.optimization.engagementScore}%
                    </Badge>
                  </div>
                  <Progress value={results.optimization.engagementScore} className="w-full" />
                  {results.optimization.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recommendations:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {results.optimization.recommendations.map((rec: string, index: number) => (
                          <li key={index} className="text-sm text-gray-600">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visual AI Enhancements</CardTitle>
              <CardDescription>AI-powered image processing and enhancement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleImageProcessing('removeBackground')} disabled={!imageFile || loading}>
                  Remove Background
                </Button>
                <Button onClick={() => handleImageProcessing('smartCrop')} disabled={!imageFile || loading}>
                  Smart Crop
                </Button>
                <Button onClick={() => handleImageProcessing('generateAltText')} disabled={!imageFile || loading}>
                  Generate Alt Text
                </Button>
                <Button onClick={() => handleImageProcessing('enhance')} disabled={!imageFile || loading}>
                  Enhance Image
                </Button>
              </div>
              
              {results.generateAltText && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Generated Alt Text:</h4>
                  <p className="text-sm">{results.generateAltText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Text AI</CardTitle>
              <CardDescription>Grammar, readability, and tone analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter text to analyze..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => handleTextEnhancement('grammar')} disabled={loading}>
                  Check Grammar
                </Button>
                <Button onClick={() => handleTextEnhancement('readability')} disabled={loading}>
                  Analyze Readability
                </Button>
                <Button onClick={() => handleTextEnhancement('tone')} disabled={loading}>
                  Adjust Tone
                </Button>
                <Button onClick={() => handleTextEnhancement('keywords')} disabled={loading}>
                  Extract Keywords
                </Button>
              </div>
              
              {results.readability && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Readability Analysis:</h4>
                  <div className="flex items-center gap-4">
                    <Badge>{results.readability.level}</Badge>
                    <span className="text-sm">Score: {results.readability.score}</span>
                  </div>
                  {results.readability.suggestions.length > 0 && (
                    <ul className="list-disc list-inside space-y-1">
                      {results.readability.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="text-sm text-gray-600">{suggestion}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              
              {results.keywords && (
                <div>
                  <h4 className="font-semibold mb-2">Keywords:</h4>
                  <div className="flex flex-wrap gap-2">
                    {results.keywords.map((keyword: string, index: number) => (
                      <Badge key={index} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Recommendations</CardTitle>
              <CardDescription>AI-powered suggestions and content discovery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Smart recommendations will be available soon!" })}>
                  Get Friend Suggestions
                </Button>
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Content discovery will be available soon!" })}>
                  Discover Content
                </Button>
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Trending topics will be available soon!" })}>
                  Predict Trends
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Moderation AI</CardTitle>
              <CardDescription>Real-time content safety and fact-checking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter content to moderate..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px]"
              />
              <Button onClick={handleModeration} disabled={loading}>
                {loading ? 'Moderating...' : 'Moderate Content'}
              </Button>
              
              {results.moderation && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={results.moderation.isAppropriate ? "default" : "destructive"}>
                      {results.moderation.isAppropriate ? "Approved" : "Flagged"}
                    </Badge>
                    <span className="text-sm">
                      Confidence: {Math.round(results.moderation.moderation.confidence * 100)}%
                    </span>
                  </div>
                  
                  {results.moderation.moderation.issues.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Issues Found:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {results.moderation.moderation.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-sm text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {results.moderation.moderation.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Suggestions:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {results.moderation.moderation.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm text-blue-600">{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility AI</CardTitle>
              <CardDescription>Enhance content accessibility for all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Accessibility features will be available soon!" })}>
                  Generate Captions
                </Button>
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Audio descriptions will be available soon!" })}>
                  Audio Descriptions
                </Button>
                <Button onClick={() => toast({ title: "Feature Coming Soon", description: "Accessibility analysis will be available soon!" })}>
                  Accessibility Check
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
