import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreatePostModal } from './CreatePostModal';
import { useAuth } from '@/hooks/useAuth';

interface CreatePostProps {
  onPostCreated?: () => void;
  groupId?: string;
}

export const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated, groupId }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const handleModalChange = (open: boolean) => {
    setShowModal(open);
    if (!open && onPostCreated) {
      onPostCreated();
    }
  };

  // Robust avatar logic: always show a visible avatar/fallback
  const getUserAvatar = () => {
    const url = user?.user_metadata?.avatar_url;
    if (url && typeof url === 'string' && url.trim() && url !== '/placeholder.svg') return url;
    return "/placeholder.svg";
  };
  const getUserName = () => {
    const first = user?.user_metadata?.first_name;
    const last = user?.user_metadata?.last_name;
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (user?.user_metadata?.username) return user.user_metadata.username;
    if (user?.email) return user.email;
    return "User";
  };
  const getUserInitial = () => {
    const name = getUserName();
    if (name && typeof name === 'string' && name.trim()) return name.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <Card className="mb-4 dark:bg-gray-900 border-gray-100 dark:border-gray-800">
      <div className="p-4">
        <div className="flex space-x-3">
          <Avatar className="w-10 h-10 ring-2 ring-gray-100 dark:ring-gray-800">
            <AvatarImage src={getUserAvatar()} alt={getUserName()} />
            <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm">
              {getUserInitial()}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="outline"
            className="flex-1 justify-start text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
            onClick={() => setShowModal(true)}
          >
            Something worth voicing?
          </Button>
        </div>
      </div>

      <CreatePostModal 
        open={showModal} 
        onOpenChange={handleModalChange}
        groupId={groupId}
      />
    </Card>
  );
};
