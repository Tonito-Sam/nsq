import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, Copy, Share2, CheckCircle, Facebook, Twitter, Mail, Link2 } from 'lucide-react';

interface Props {
  channel: any;
}

const RightInviteFriends: React.FC<Props> = ({ channel }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const channelUrl = `https://nexsq.com/studio/${channel.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(channelUrl);
      setCopied(true);
      toast({ 
        title: 'Link copied!', 
        description: 'Share it with your friends to grow your channel.' 
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ 
        description: 'Failed to copy link', 
        variant: 'destructive' 
      });
    }
  };

  const shareOptions = [
    { 
      icon: Twitter, 
      label: 'Twitter', 
      color: 'text-[#1DA1F2]',
      bg: 'hover:bg-[#1DA1F2]/10',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my studio on NexSq!')}&url=${encodeURIComponent(channelUrl)}`
    },
    { 
      icon: Facebook, 
      label: 'Facebook', 
      color: 'text-[#1877F2]',
      bg: 'hover:bg-[#1877F2]/10',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(channelUrl)}`
    },
    { 
      icon: Mail, 
      label: 'Email', 
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'hover:bg-gray-100 dark:hover:bg-white/10',
      url: `mailto:?subject=Check out my studio!&body=${encodeURIComponent(channelUrl)}`
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-purple-50 p-6 shadow-sm transition-all duration-300 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/10 dark:border-white/10 dark:from-gray-900/90 dark:via-gray-800/90 dark:to-purple-900/50 dark:backdrop-blur-xl dark:hover:border-purple-500/30">
      {/* Background glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400">
            Invite Friends
          </h3>
          <Users className="w-4 h-4 text-purple-700 dark:text-purple-400" />
        </div>

        <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
          Share your channel link and grow your community! 🚀
        </p>

        {/* Copy Link Section */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-gray-50 border border-gray-200 dark:bg-white/5 dark:border-white/5">
          <div className="flex-1 min-w-0 px-3">
            <p className="text-xs text-gray-600 truncate dark:text-gray-500">{channelUrl}</p>
          </div>
          <Button
            size="sm"
            onClick={handleCopyLink}
            className={cn(
              "flex-shrink-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0",
              copied && "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            )}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Share Buttons */}
        <div className="mt-4">
          <p className="text-xs text-gray-600 mb-2 dark:text-gray-500">Or share directly:</p>
          <div className="grid grid-cols-4 gap-2">
            {shareOptions.map((option) => (
              <a
                key={option.label}
                href={option.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl",
                  "bg-gray-50 border border-gray-200 transition-all duration-200 dark:bg-white/5 dark:border-white/5",
                  option.bg,
                  "hover:border-gray-300 hover:scale-105 dark:hover:border-white/20"
                )}
              >
                <option.icon className={cn("w-4 h-4", option.color)} />
                <span className="text-[11px] leading-tight font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </a>
            ))}
            <button
              onClick={handleCopyLink}
              className="flex min-w-0 flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-gray-50 border border-gray-200 transition-all duration-200 hover:bg-gray-100 hover:border-gray-300 hover:scale-105 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10 dark:hover:border-white/20"
            >
              <Link2 className="w-4 h-4 text-purple-400" />
                <span className="text-[11px] leading-tight font-medium text-gray-700 dark:text-gray-300">
                Link
              </span>
            </button>
          </div>
        </div>

        {/* Stats Counter */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-500">
            <span>Share to grow your channel</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-400" />
              Invite more → 
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility function for className merging
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

export default RightInviteFriends;