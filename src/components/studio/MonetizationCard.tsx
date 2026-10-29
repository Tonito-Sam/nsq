import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { 
  DollarSign, 
  Gift, 
  Users, 
  Eye, 
  Lock, 
  Unlock, 
  TrendingUp,
  Star,
  Sparkles,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonetizationCardProps {
  channel: any;
  totalChannelViews: number;
  subscriberCounts: Record<string, number>;
  handleToggleMonetization: (type: 'donation' | 'subscription', checked: boolean) => void;
}

const MonetizationCard: React.FC<MonetizationCardProps> = ({ 
  channel, 
  totalChannelViews, 
  subscriberCounts, 
  handleToggleMonetization 
}) => {
  const minViews = 10000;
  const minSubscribers = 2000;
  const viewsOk = totalChannelViews >= minViews;
  const subsOk = (subscriberCounts[channel.id] ?? 0) >= minSubscribers;
  const monetizationEnabled = viewsOk && subsOk;
  
  const viewsProgress = Math.min(100, (totalChannelViews / minViews) * 100);
  const subsProgress = Math.min(100, ((subscriberCounts[channel.id] ?? 0) / minSubscribers) * 100);
  const overallProgress = Math.min(100, (viewsProgress + subsProgress) / 2);

  const donationEnabled = channel?.donation_enabled || false;
  const subscriptionEnabled = channel?.subscription_enabled || false;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-purple-50 p-6 shadow-sm transition-all duration-300 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 dark:border-white/10 dark:from-gray-900/90 dark:via-gray-800/90 dark:to-purple-900/50 dark:backdrop-blur-xl dark:hover:border-purple-500/30">
      {/* Background glow effects */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/20">
              <DollarSign className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-yellow-800 to-orange-800 bg-clip-text text-transparent dark:from-yellow-400 dark:to-orange-400">
              Monetization
            </h3>
          </div>
          {monetizationEnabled ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30">
              <Lock className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-400">Locked</span>
            </div>
          )}
        </div>

        {/* Progress Section - Show when not enabled */}
        {!monetizationEnabled && (
          <div className="space-y-3 p-4 mb-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Progress to Monetization</span>
              <span className="text-xs font-bold text-yellow-800 dark:text-yellow-400">{Math.round(overallProgress)}%</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-blue-400" />
                    Views: {totalChannelViews.toLocaleString()}/{minViews.toLocaleString()}
                  </span>
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
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-green-400" />
                    Subscribers: {subscriberCounts[channel.id]?.toLocaleString() || 0}/{minSubscribers.toLocaleString()}
                  </span>
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
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">
                Unlock monetization at <b className="text-yellow-900 dark:text-yellow-400">10,000 views</b> & <b className="text-yellow-900 dark:text-yellow-400">2,000 subscribers</b>
              </span>
            </div>
          </div>
        )}

        {!monetizationEnabled && (
          <div className="mb-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400">
            <div className="mb-1 flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <Lock className="h-3.5 w-3.5" />
              <span className="font-medium">Locked</span>
            </div>
            <p>These settings are disabled until your channel reaches the requirements above.</p>
          </div>
        )}

        {/* Monetization Toggles */}
        <div className="space-y-3">
          {/* Donations Toggle */}
          <div className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-all duration-300",
            monetizationEnabled 
              ? "bg-gray-50 border border-gray-200 hover:border-yellow-500/30 dark:bg-white/5 dark:border-white/10" 
              : "bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed dark:bg-white/5 dark:border-white/5"
          )}>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20">
                <Gift className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Donations (Live)</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Accept live donations during streams</p>
              </div>
            </div>
            <Switch
              checked={donationEnabled}
              onCheckedChange={(checked) => handleToggleMonetization('donation', checked)}
              disabled={!monetizationEnabled}
              className={cn(
                "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-yellow-500 data-[state=checked]:to-orange-500",
                !monetizationEnabled && "cursor-not-allowed"
              )}
            />
          </div>

          {/* Subscriptions Toggle */}
          <div className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-all duration-300",
            monetizationEnabled 
              ? "bg-gray-50 border border-gray-200 hover:border-purple-500/30 dark:bg-white/5 dark:border-white/10" 
              : "bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed dark:bg-white/5 dark:border-white/5"
          )}>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                <Star className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Subscriptions (Series)</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Offer premium series subscriptions</p>
              </div>
            </div>
            <Switch
              checked={subscriptionEnabled}
              onCheckedChange={(checked) => handleToggleMonetization('subscription', checked)}
              disabled={!monetizationEnabled}
              className={cn(
                "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500",
                !monetizationEnabled && "cursor-not-allowed"
              )}
            />
          </div>
        </div>

        {/* Status Message when enabled */}
        {monetizationEnabled && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-400 animate-pulse" />
              <p className="text-xs text-green-400">
                <span className="font-medium">Monetization enabled!</span> You can now accept donations and subscriptions.
              </p>
            </div>
          </div>
        )}

        {/* Revenue Stats Preview (Optional) */}
        {monetizationEnabled && (donationEnabled || subscriptionEnabled) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-center dark:bg-white/5 dark:border-white/5">
              <p className="text-xs text-gray-600 dark:text-gray-400">Donations</p>
              <p className="text-sm font-bold text-yellow-400">$0.00</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-center dark:bg-white/5 dark:border-white/5">
              <p className="text-xs text-gray-600 dark:text-gray-400">Subscriptions</p>
              <p className="text-sm font-bold text-purple-400">$0.00</p>
            </div>
          </div>
        )}

        {/* Learn More Link */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/5">
          <button 
            onClick={() => window.open('/help/monetization', '_blank')}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-purple-600 transition-colors group dark:text-gray-500 dark:hover:text-purple-400"
          >
            <TrendingUp className="w-3 h-3 group-hover:text-purple-400" />
            <span>Learn more about monetization</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonetizationCard;