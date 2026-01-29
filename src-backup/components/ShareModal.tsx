import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { X, Share2, Copy, Users, MessageCircle, Facebook, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareToGroupModal } from './ShareToGroupModal';
import { ShareWithFriendModal } from './ShareWithFriendModal';

interface ShareModalProps {
  postId: string;
  postContent: string;
  authorName: string;
  open: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ postId, postContent, authorName, open, onClose }) => {
  const { toast } = useToast();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);

  if (!open) return null;

  const postUrl = `${window.location.origin}/post/${postId}`;
  const shareText = `Check out this post by ${authorName}: "${postContent.slice(0, 100)}${postContent.length > 100 ? '...' : ''}"`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl);
    toast({
      description: "Post link copied to clipboard!"
    });
  };

  const handleShareToWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${postUrl}`)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleShareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    window.open(facebookUrl, '_blank');
  };

  const handleShareToGroup = () => {
    toast({
      description: "Group sharing feature coming soon!"
    });
  };

  const handleShareToFriends = () => {
    toast({
      description: "Friends sharing feature coming soon!"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700 shadow-lg text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Share2 className="h-5 w-5 mr-2" />
            Share Post
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Share options */}
        <div className="space-y-3">
          {/* Copy Link */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4 mr-3" />
            Copy post link
          </Button>

          {/* Share to Groups */}
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowGroupModal(true)}
          >
            <Users className="h-4 w-4 mr-3" />
            Share to groups
          </Button>

          {/* Share to Friends */}
          <Button
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white dark:bg-pink-700 dark:hover:bg-pink-800 dark:text-white"
            onClick={() => setShowFriendModal(true)}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 10v-1c0-1.1-3.58-2-6-2s-6 .9-6 2v1h12z"/></svg>
            Share with Friend
          </Button>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

          {/* Social Media Platforms */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Share on social media
            </p>
            
            <Button 
              variant="outline" 
              className="w-full justify-start bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/60 dark:border-green-800"
              onClick={handleShareToWhatsApp}
            >
              <MessageCircle className="h-4 w-4 mr-3 text-green-600 dark:text-green-400" />
              Share on WhatsApp
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 dark:border-blue-800"
              onClick={handleShareToTwitter}
            >
              <Twitter className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400" />
              Share on Twitter
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 dark:border-blue-800"
              onClick={handleShareToFacebook}
            >
              <Facebook className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400" />
              Share on Facebook
            </Button>
          </div>
        </div>

        {/* Post preview */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sharing:</p>
          <p className="text-sm text-gray-900 dark:text-white">
            "{postContent.slice(0, 100)}{postContent.length > 100 ? '...' : ''}"
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">by {authorName}</p>
        </div>
        <ShareToGroupModal postId={postId} open={showGroupModal} onClose={() => setShowGroupModal(false)} />
        <ShareWithFriendModal postId={postId} open={showFriendModal} onClose={() => setShowFriendModal(false)} />
      </Card>
    </div>
  );
};
