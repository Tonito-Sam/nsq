import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface FloatingHeart {
  id: string;
  x: number;
  y: number;
}

interface HeartAnimationProps {
  triggerAnimation: boolean;
  onAnimationComplete: () => void;
}

export const HeartAnimation: React.FC<HeartAnimationProps> = ({
  triggerAnimation,
  onAnimationComplete
}) => {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  useEffect(() => {
    if (!triggerAnimation) return;

    // Create multiple hearts
    const newHearts = Array.from({ length: 5 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      x: Math.random() * 100 - 50, // Random x offset
      y: 0
    }));

    setHearts(newHearts);

    // Remove hearts after animation
    const timer = setTimeout(() => {
      setHearts([]);
      onAnimationComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [triggerAnimation, onAnimationComplete]);

  if (!triggerAnimation || hearts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {hearts.map((heart, index) => (
        <div
          key={heart.id}
          className="absolute animate-floating-heart"
          style={{
            left: '50%',
            bottom: '40%',
            transform: `translateX(${heart.x}px)`,
            animationDelay: `${index * 0.1}s`,
            animationDuration: '2s'
          }}
        >
          <Heart 
            className="w-8 h-8 text-red-500 fill-current drop-shadow-lg" 
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        </div>
      ))}
    </div>
  );
};