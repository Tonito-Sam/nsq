import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

interface ShareToGroupModalProps {
  postId: string;
  open: boolean;
  onClose: () => void;
  onShared?: () => void;
}

export const ShareToGroupModal: React.FC<ShareToGroupModalProps> = ({ postId, open, onClose, onShared }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('groups (id, name, avatar_url)')
        .eq('user_id', user.id);
      if (error) setError('Failed to fetch groups.');
      else setGroups((data || []).map((m: any) => m.groups));
    };
    fetchGroups();
  }, [user]);

  const handleShare = async () => {
    if (!selectedGroup) return;
    setLoading(true);
    setError(null);
    try {
      // Create a new post in the selected group referencing the original post
      const { error: postError } = await supabase.from('posts').insert({
        user_id: user?.id,
        group_id: selectedGroup,
        content: comment.trim() || null,
        post_type: 'repost',
        media_url: postId, // reference to the original post
      });
      if (postError) throw postError;
      if (onShared) onShared();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to share to group.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Share to Group</h2>
        {error && <div className="text-red-500 dark:text-red-400 mb-2">{error}</div>}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-800 dark:text-gray-200">Select Group</label>
          <select
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
          >
            <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">-- Select a group --</option>
            {groups.map(group => (
              <option key={group.id} value={group.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">{group.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-800 dark:text-gray-200">Add a comment (optional)</label>
          <Textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add your thoughts..."
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleShare} disabled={loading || !selectedGroup}>
            {loading ? 'Sharing...' : 'Share'}
          </Button>
        </div>
      </Card>
    </div>
  );
};