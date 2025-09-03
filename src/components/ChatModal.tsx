
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
import { useChatModal } from './chat/useChatModal';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  user_id: string;
  store?: {
    store_name: string;
    verification_status: string;
  };
}

interface ChatModalProps {
  product: Product;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({ product, onClose }) => {
  const { user } = useAuth();
  const {
    messages,
    newMessage,
    setNewMessage,
    loading,
    sending,
    sendMessage,
    handleKeyPress,
    messagesEndRef
  } = useChatModal(product, user);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl h-[600px] dark:bg-[#161616] flex items-center justify-center">
          <div className="text-gray-600 dark:text-gray-400">Loading chat...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] dark:bg-[#161616] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
              {product.images?.[0] ? (
                <img 
                  src={product.images[0]} 
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {product.title}
              </h3>
              <p className="text-sm text-gray-500">
                Chat with {product.store?.store_name || 'Seller'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ChatMessages messages={messages} userId={user?.id} />
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <ChatInput
          message={newMessage}
          onChange={setNewMessage}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          disabled={sending}
        />
      </Card>
    </div>
  );
};
