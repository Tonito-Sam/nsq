import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  channel: any;
  totalChannelViews: number;
  subscriberCounts: Record<string, number>;
  canPersonalize: boolean;
  navigate: any;
  handleCreateChannel: () => void;
}

const RightYourStudio: React.FC<Props> = ({ channel, totalChannelViews, subscriberCounts, canPersonalize, navigate, handleCreateChannel }) => {
  const { toast } = useToast();

  return (
    <div className="bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
      <h3 className="text-xl font-bold mb-3">Your Studio</h3>
      <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{channel.name}</div>
      <div className="text-base text-gray-800 dark:text-gray-200 mb-3 font-medium">{channel.description}</div>
      <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">
        Link: <a href={`https://nexsq.com/studio/${channel.id}`} className="underline text-purple-600 dark:text-purple-400" target="_blank" rel="noopener noreferrer">https://nexsq.com/studio/{channel.id}</a>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Eye className="w-4 h-4 text-purple-500" />
        <span className="text-base text-gray-900 dark:text-white font-semibold">Total Views: <span className="font-bold">{totalChannelViews}</span></span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="w-4 h-4 text-purple-500" />
        <span className="text-base text-gray-900 dark:text-white font-semibold">Subscribers: <span className="font-bold">{subscriberCounts[channel.id] ?? 0}</span></span>
      </div>
      {!canPersonalize && (
        <div className="mb-2">
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-fuchsia-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.floor(((totalChannelViews / 1000) + ((subscriberCounts[channel.id] ?? 0) / 200)) / 2 * 100))}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 font-semibold">
            <span>{totalChannelViews}/1000 views</span>
            <span>{subscriberCounts[channel.id] ?? 0}/200 subs</span>
          </div>
        </div>
      )}
      {canPersonalize ? (
        <Button size="sm" variant="outline" onClick={() => navigate('/studio/settings')}>Personalize Studio Link</Button>
      ) : (
        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-semibold">Get 1000 views & 200 subscribers to customize your studio link!</div>
      )}
    </div>
  );
};

export default RightYourStudio;
