import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  channel: any;
}

const RightInviteFriends: React.FC<Props> = ({ channel }) => {
  const { toast } = useToast();

  return (
    <div className="bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
      <h3 className="text-lg font-bold mb-3">Invite Friends</h3>
      <div className="text-sm mb-3">Share your channel link to invite friends to subscribe!</div>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={`https://nexsq.com/studio/${channel.id}`}
          className="flex-1 bg-gray-800 text-white border-none focus:ring-0 focus:outline-none text-xs px-2 py-1 rounded"
          style={{ minWidth: 0 }}
        />
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(`https://nexsq.com/studio/${channel.id}`);
            toast({ description: 'Link copied to clipboard!' });
          }}
          className="text-xs"
        >
          Copy Link
        </Button>
      </div>
    </div>
  );
};

export default RightInviteFriends;
