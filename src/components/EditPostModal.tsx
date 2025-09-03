import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface EditPostModalProps {
  open: boolean;
  onClose: () => void;
  post: any;
  onPostUpdated: (updated: any) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({ open, onClose, post, onPostUpdated }) => {
  const [content, setContent] = useState(post.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync content state with post prop
  React.useEffect(() => {
    setContent(post.content || '');
  }, [post]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const { error: updateError, data } = await supabase
      .from('posts')
      .update({ content })
      .eq('id', post.id)
      .select()
      .single();
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      onPostUpdated(data);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        <textarea
          className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[120px]"
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={1000}
        />
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="default" onClick={handleSave} disabled={loading || !content.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
