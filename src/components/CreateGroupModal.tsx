import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: (group: any) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onOpenChange, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Group name required', description: 'Please enter a group name.' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('groups')
      .insert({ name, description })
      .select('*')
      .single();
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Group created', description: `Group "${name}" created successfully!` });
    setName('');
    setDescription('');
    onOpenChange(false);
    if (onGroupCreated) onGroupCreated(data);
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name *
              </label>
              <Input
                placeholder="Enter group name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={loading}
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                placeholder="Brief description of your group"
                className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={200}
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end space-x-3 mt-6">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              {loading ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
