import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

export function LandscapeSolutions() {
  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">How to Fix Landscape Videos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Solution 1 */}
          <div className="p-4 rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <span>📱</span>
              </div>
              <h4 className="font-semibold">Re-record in portrait</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              For best results, record directly in portrait mode (9:16 aspect ratio).
            </p>
          </div>
          
          {/* Solution 2 */}
          <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span>✂️</span>
              </div>
              <h4 className="font-semibold">Use editing apps</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Add vertical letterboxing using editing apps before uploading.
            </p>
          </div>
        </div>
        
        {/* App recommendations */}
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <h4 className="font-medium mb-2">Recommended Editing Apps:</h4>
          <div className="flex flex-wrap gap-2">
            <a 
              href="https://www.capcut.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
            >
              <span>🎬</span>
              CapCut
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
            <a 
              href="https://inshot.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
            >
              <span>🎥</span>
              InShot
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
            <a 
              href="https://www.adobe.com/express/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
            >
              <span>✨</span>
              Adobe Express
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </div>
        
        {/* Quick tip */}
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <p className="text-sm">
            <strong>Tip:</strong> If you must upload landscape, ensure important content 
            is in the <span className="text-primary font-medium">center third</span> of the frame.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}