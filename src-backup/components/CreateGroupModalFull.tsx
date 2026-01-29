import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface CreateGroupModalFullProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: (group: any) => void;
}

const CreateGroupModalFull: React.FC<CreateGroupModalFullProps> = ({ open, onOpenChange, onGroupCreated }) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleModalClose = () => {
    setNewGroupName('');
    setNewGroupDescription('');
    onOpenChange(false);
  };

  const handleGroupCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name: newGroupName, description: newGroupDescription })
        .select('*')
        .single();
      setLoading(false);
      if (error) return;
      setNewGroupName('');
      setNewGroupDescription('');
      onOpenChange(false);
      if (onGroupCreated) onGroupCreated(data);
    } catch {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleGroupCreate}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name *
              </label>
              <input
                type="text"
                placeholder="Enter group name"
                className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                required
                maxLength={50}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                placeholder="Brief description of your group"
                className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                value={newGroupDescription}
                onChange={e => setNewGroupDescription(e.target.value)}
                rows={3}
                maxLength={200}
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end space-x-3 mt-6">
            <Button type="button" variant="ghost" onClick={handleModalClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModalFull;
