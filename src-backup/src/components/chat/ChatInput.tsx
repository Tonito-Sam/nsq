
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  message: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  message,
  onChange,
  onSend,
  onKeyPress,
  disabled
}) => {
  return (
    <div className="border-t dark:border-gray-700 p-4">
      <div className="flex space-x-2">
        <Input
          value={message}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Type your message..."
          className="flex-1"
          disabled={disabled}
        />
        <Button
          onClick={onSend}
          disabled={!message.trim() || disabled}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
