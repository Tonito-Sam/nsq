import React from 'react';
import { Switch } from '@/components/ui/switch';

interface MonetizationCardProps {
  channel: any;
  totalChannelViews: number;
  subscriberCounts: Record<string, number>;
  handleToggleMonetization: (type: 'donation' | 'subscription', checked: boolean) => void;
}

const MonetizationCard: React.FC<MonetizationCardProps> = ({ channel, totalChannelViews, subscriberCounts, handleToggleMonetization }) => {
  const minViews = 10000;
  const minSubscribers = 2000;
  const viewsOk = totalChannelViews >= minViews;
  const subsOk = (subscriberCounts[channel.id] ?? 0) >= minSubscribers;
  const monetizationEnabled = viewsOk && subsOk;

  return (
    <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
      <h3 className="text-lg font-bold mb-3">Monetization</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span>Enable Donations (Live)</span>
          <Switch
            checked={channel?.donation_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('donation', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Enable Subscriptions (Series)</span>
          <Switch
            checked={channel?.subscription_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('subscription', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        {!monetizationEnabled && (
          <div className="text-xs text-gray-400 mt-2">
            Get <b>10,000 views</b> & <b>2,000 subscribers</b> to enable monetization features.
          </div>
        )}
      </div>
    </div>
  );
};

export default MonetizationCard;
