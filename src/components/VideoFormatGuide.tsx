import { AlertCircle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VideoFormatGuideProps {
  detectedAspectRatio: 'portrait' | 'landscape' | 'square';
}

export function VideoFormatGuide({ detectedAspectRatio }: VideoFormatGuideProps) {
  const isLandscape = detectedAspectRatio === 'landscape';
  
  if (!isLandscape) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                🖥️ Landscape Detected
              </Badge>
              <span className="text-sm text-muted-foreground">Your video will be cropped to fit reels</span>
            </div>
            
            <div className="text-xs text-amber-700 bg-amber-100/50 p-2 rounded">
              <Info className="h-3 w-3 inline mr-1" />
              <strong>How it works:</strong> Reels use portrait format (9:16). Landscape videos are automatically <strong>center-cropped</strong> to fit.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}