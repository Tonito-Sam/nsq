import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone, Video } from 'lucide-react';

export const MessagesSidebar = ({ conversations, selectedConversation, setSelectedConversation }: any) => {
  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-0 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-purple-500" />
          Messages
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {conversations && conversations.length > 0 ? (
          conversations.map((conv: any) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-gray-900 transition-colors ${selectedConversation?.id === conv.id ? 'bg-purple-100 dark:bg-gray-900' : ''}`}
            >
              <img src={conv.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.name}</div>
                <div className="text-xs text-gray-500 truncate">{conv.lastMessage}</div>
              </div>
              {conv.unread > 0 && (
                <span className="ml-2 bg-purple-500 text-white text-xs rounded-full px-2 py-0.5">{conv.unread}</span>
              )}
            </button>
          ))
        ) : (
          <div className="p-4 text-gray-500 text-center">No conversations yet.</div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <Button variant="outline" className="flex-1 flex items-center gap-2">
          <Phone className="h-4 w-4" /> Call
        </Button>
        <Button variant="outline" className="flex-1 flex items-center gap-2">
          <Video className="h-4 w-4" /> Video
        </Button>
      </div>
    </Card>
  );
};
