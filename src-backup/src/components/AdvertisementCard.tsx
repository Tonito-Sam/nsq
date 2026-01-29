import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, Bolt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdvertisementCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-yellow-600"/> Advertising</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Promote your content — run campaigns or boost individual posts, stores, channels or products.</p>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/campaigns')} className="flex-1">Run Campaign</Button>
          <Button variant="outline" onClick={() => navigate('/campaigns?mode=boost')} className="flex-1"><Bolt className="h-4 w-4 mr-2"/> Boost Post</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvertisementCard;
