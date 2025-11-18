import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useProductEnquiryMessages } from './useProductEnquiryMessages';
import { supabase } from '@/integrations/supabase/client';

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

interface ConversationItemProps {
  conversation: ConversationWithDetails;
  userId?: string;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({ 
  conversation, 
  userId 
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 3600);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getCustomerName = (customer: any) => {
    if (customer?.first_name || customer?.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    return customer?.username || 'Customer';
  };

  const [showReply, setShowReply] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { messages, loading, fetchMessages } = useProductEnquiryMessages(conversation.id);

  const handleSend = async () => {
    if (!replyMessage.trim()) return;
    setSending(true);
    // Store message in DB
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: userId,
      content: replyMessage
    });
    setReplyMessage('');
    setSending(false);
    fetchMessages();
  };

  return (
    <div className="p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-full">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full cursor-pointer" onClick={() => setShowReply((v) => !v)}>
        <div className="flex justify-center sm:block w-full sm:w-auto">
          <Avatar className="h-12 w-12 mx-auto sm:mx-0">
            <AvatarImage src={conversation.customer?.avatar_url} />
            <AvatarFallback>
              {getCustomerName(conversation.customer).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 w-full">
            <p className="font-medium text-gray-900 dark:text-gray-100 text-center sm:text-left w-full sm:w-auto truncate break-words">
              {getCustomerName(conversation.customer)}
            </p>
            <div className="flex items-center justify-center sm:justify-end space-x-2 mt-1 sm:mt-0 w-full sm:w-auto">
              {conversation.unread_count! > 0 && (
                <Badge className="bg-purple-600">
                  {conversation.unread_count}
                </Badge>
              )}
              <span className="text-xs text-gray-500">
                {formatTime(conversation.last_message_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start w-full">
            <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center overflow-hidden">
              {conversation.product?.images?.[0] ? (
                <img 
                  src={conversation.product.images[0]} 
                  alt={conversation.product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-3 w-3 text-gray-400" />
              )}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate break-words max-w-[60vw] sm:max-w-xs">
              Re: {conversation.product?.title}
            </span>
          </div>
          {conversation.last_message && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate break-words text-center sm:text-left w-full">
              {conversation.last_message.sender_id === userId ? 'You: ' : ''}
              {conversation.last_message.content}
            </p>
          )}
        </div>
      </div>
      {/* Animated reply form */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${showReply ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
      >
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 sm:p-4 shadow-inner w-full">
          <div className="mb-2 max-h-48 overflow-y-auto">
            <ChatMessages messages={messages} userId={userId} />
          </div>
          <ChatInput
            message={replyMessage}
            onChange={setReplyMessage}
            onSend={handleSend}
            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={sending}
          />
        </div>
      </div>
    </div>
  );
};
