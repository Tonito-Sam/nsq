import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ConversationList } from './chat/ConversationList';
import { useChatData } from './chat/useChatData';

export const ChatBoard: React.FC = () => {
  const { user } = useAuth();
  const { conversations, loading } = useChatData(user?.id);

  return (
    <div className="space-y-4 w-full max-w-full px-2 sm:px-0 box-border overflow-x-hidden">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 text-center sm:text-left">
        Customer Messages
      </h2>

      <ConversationList
        conversations={conversations}
        loading={loading}
        userId={user?.id}
      />
    </div>
  );
};
