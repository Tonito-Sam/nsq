import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { X, Repeat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface Post {
  id: string;
  content: string;
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
  };
  media_url?: string;
  created_at: string;
}

interface RepostModalProps {
  post: Post;
  onClose: () => void;
  onRepost: () => void;
}

export const RepostModal: React.FC<RepostModalProps> = ({ post, onClose, onRepost }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRepost = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Create a repost entry in the posts table
      const { error: repostError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim() || null,
          post_type: 'repost',
          media_url: String(post.id), // ensure string
        });
      if (repostError) throw new Error('posts insert: ' + repostError.message);

      // Update the original post's repost count
      const { error: updateError } = await supabase.rpc('increment_post_reposts', { 
        post_id: post.id 
      });
      if (updateError) throw new Error('increment_post_reposts: ' + updateError.message);

      // Create repost record
      const { error: repostRecordError } = await supabase
        .from('reposts')
        .insert({
          user_id: user.id,
          original_post_id: post.id
        });
      if (repostRecordError) throw new Error('reposts insert: ' + repostRecordError.message);

      toast({
        title: "Success",
        description: "Post echoed successfully"
      });
      onRepost();
      onClose();
    } catch (error: any) {
      console.error('Error reposting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to echo post",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Repeat className="h-5 w-5 mr-2" />
              Echo this post
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Textarea
            placeholder="Add a comment to your echo..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mb-4"
            rows={3}
          />

          {/* Original Post Preview */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {post.user?.first_name?.[0] || post.user?.username?.[0] || 'U'}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {`${post.user?.first_name || ''} ${post.user?.last_name || ''}`.trim() || 'Anonymous'}
                </p>
                <p className="text-gray-500 text-xs">@{post.user?.username || 'user'}</p>
              </div>
            </div>
            <p className="text-gray-900 dark:text-gray-100">{post.content}</p>
            {post.media_url && (
              <img 
                src={post.media_url} 
                alt="Post media" 
                className="mt-3 rounded-lg max-w-full h-auto"
              />
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleRepost} disabled={isLoading}>
              {isLoading ? 'Echoing...' : 'Echo'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
