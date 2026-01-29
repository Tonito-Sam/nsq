
import React, { useState, useEffect, useRef } from 'react';
import { Heart, Music, Brain, MessageCircle, HandHeart, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReactionPickerProps {
  onReact: (reactionType: string) => void;
  currentReaction?: string;
  reactionCounts?: { [key: string]: number };
  totalReactions: number;
}

const reactionConfig = {
  like: { icon: Heart, label: 'Like', color: 'text-red-500' },
  applause: { icon: HandHeart, label: 'Well Done', color: 'text-green-500' },
  thinking: { icon: Brain, label: 'Thoughtful', color: 'text-purple-500' },
  'speak-up': { icon: MessageCircle, label: 'Louder', color: 'text-blue-500' },
  melody: { icon: Music, label: 'Sweet Vibes', color: 'text-pink-500' },
  'shut-up': { icon: VolumeX, label: 'Shut Up', color: 'text-gray-500' }
};

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onReact,
  currentReaction,
  reactionCounts = {},
  totalReactions
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        pickerRef.current && 
        buttonRef.current &&
        !pickerRef.current.contains(target) &&
        !buttonRef.current.contains(target)
      ) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  type ReactionKey = keyof typeof reactionConfig;

  const getCurrentIcon = () => {
    if (currentReaction && (reactionConfig as any)[currentReaction]) {
      const config = reactionConfig[currentReaction as ReactionKey];
      return { icon: config.icon, color: config.color };
    }
    return { icon: Heart, color: 'text-gray-500' };
  };

  const handleReactionClick = (type: string) => {
    onReact(type);
    setShowPicker(false);
  };

  const currentIcon = getCurrentIcon();
  const CurrentIcon = currentIcon.icon;

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker(!showPicker);
        }}
        className={`hover:bg-red-50 dark:hover:bg-red-950 ${currentReaction ? currentIcon.color : 'text-gray-500'} flex items-center space-x-1 px-1.5 py-0.5 md:space-x-1.5 md:px-2 md:py-1 rounded-lg transition-all duration-200 hover:scale-105`}
      >
        <CurrentIcon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${currentReaction ? 'fill-current' : ''}`} />
        <span className="text-xs md:text-sm font-medium">{totalReactions > 0 ? totalReactions : ''}</span>
      </Button>

      {showPicker && (
        <div 
          ref={pickerRef}
          className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#161616] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {(Object.entries(reactionConfig) as Array<[ReactionKey, any]>).map(([type, config]) => {
            const Icon = config.icon;
            const count = reactionCounts?.[type] || 0;
            
            return (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReactionClick(type);
                }}
                className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${config.color} relative group p-2 md:p-2`}
                title={`${config.label} (${count})`}
              >
                <Icon className="h-4 w-4 md:h-5 md:w-5" />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {config.label} ({count})
                </div>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};
