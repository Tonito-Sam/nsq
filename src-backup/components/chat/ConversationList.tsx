import React from 'react';
import { Card } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { ConversationItem } from './ConversationItem';

interface ConversationWithDetails {
  id: string;
  customer_id: string;
  seller_id: string;
  product_id: string;
  last_message_at: string;
  created_at: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    username: string;
    avatar_url?: string;
  };
  product?: {
    title: string;
    images: string[];
  };
  last_message?: {
    content: string;
    sender_id: string;
  };
  unread_count?: number;
}

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  loading: boolean;
  userId?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations, 
  loading, 
  userId 
}) => {
  if (loading) {
    return (
      <Card className="dark:bg-[#161616] p-4 sm:p-8 text-center mx-2 sm:mx-0">
        <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Loading conversations...</div>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className="dark:bg-[#161616] p-4 sm:p-8 text-center mx-2 sm:mx-0">
        <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Conversations Yet
        </h3>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 px-2">
          When customers message you about products, they'll appear here
        </p>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-[#161616] p-4 sm:p-8 w-full min-h-[40vh] max-h-[80vh] overflow-y-auto">
      <div className="flex flex-col divide-y dark:divide-gray-700">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            userId={userId}
          />
        ))}
      </div>
    </Card>
  );
};
