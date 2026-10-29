import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, UserCheck, Sparkles, TrendingUp, Users, Award, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  channel: any;
  totalChannelViews: number;
  subscriberCounts: Record<string, number>;
  canPersonalize: boolean;
  navigate: any;
  handleCreateChannel: () => void;
}

const RightYourStudio: React.FC<Props> = ({ 
  channel, 
  totalChannelViews, 
  subscriberCounts, 
  canPersonalize, 
  navigate, 
  handleCreateChannel 
}) => {
  const { toast } = useToast();
  const subs = subscriberCounts[channel.id] ?? 0;
  const viewsProgress = Math.min(100, (totalChannelViews / 1000) * 100);
  const subsProgress = Math.min(100, (subs / 200) * 100);
  const overallProgress = Math.min(100, (viewsProgress + subsProgress) / 2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-purple-50 p-6 shadow-sm transition-all duration-300 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 dark:border-white/10 dark:from-gray-900/90 dark:via-gray-800/90 dark:to-purple-900/50 dark:backdrop-blur-xl dark:hover:border-purple-500/30">
      {/* Background glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400">
            Your Studio
          </h3>
          <button
            type="button"
            onClick={() => navigate('/studio/settings')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-purple-100 hover:text-purple-700 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-purple-300"
            aria-label="Studio settings"
            title="Studio settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Channel Info */}
          <div>
            <h4 className="text-xl font-bold text-gray-900 mb-1 truncate dark:text-white">{channel.name}</h4>
            <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{channel.description || 'No description yet'}</p>
          </div>

          {/* Channel Link */}
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/5">
            <p className="text-xs text-purple-800 mb-1 dark:text-purple-300">Channel Link</p>
            <a 
              href={`https://nexsq.com/studio/${channel.id}`} 
              className="text-xs text-purple-700 hover:text-purple-900 truncate block dark:text-purple-400 dark:hover:text-purple-300"
              target="_blank" 
              rel="noopener noreferrer"
            >
              nexsq.com/studio/{channel.id.substring(0, 12)}...
            </a>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Views</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1 dark:text-white">
                {totalChannelViews.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Subscribers</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1 dark:text-white">
                {subs.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Progress Section - Scrollable content */}
          {!canPersonalize && (
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 dark:from-purple-500/10 dark:to-pink-500/10 dark:border-purple-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Progress to Personalization</span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">{Math.round(overallProgress)}%</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Views: {totalChannelViews}/1,000</span>
                    <span>{Math.round(viewsProgress)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${viewsProgress}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Subscribers: {subs}/200</span>
                    <span>{Math.round(subsProgress)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                      style={{ width: `${subsProgress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Award className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <span className="leading-tight">Unlock custom link at 1,000 views & 200 subs</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          {canPersonalize ? (
            <Button 
              size="sm" 
              onClick={() => navigate('/studio/settings')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg shadow-purple-500/25"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Personalize Studio
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleCreateChannel}
              className="w-full border-purple-700/30 text-purple-700 hover:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Grow Your Studio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightYourStudio;