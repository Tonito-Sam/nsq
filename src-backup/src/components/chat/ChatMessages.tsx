import React from 'react';
import { Package } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    first_name?: string;
    last_name?: string;
    username: string;
    avatar_url?: string;
  };
}

interface ChatMessagesProps {
  messages: Message[];
  userId?: string;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, userId }) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-20">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Start a conversation about this product</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex mb-2 ${
            message.sender_id === userId ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[90vw] sm:max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words whitespace-pre-line ${
              message.sender_id === userId
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            <p className="text-sm">{message.content}</p>
            <p className={`text-xs mt-1 ${
              message.sender_id === userId
                ? 'text-purple-200'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      ))}
    </>
  );
};
