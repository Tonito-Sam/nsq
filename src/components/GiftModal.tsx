import React from "react";
import { FaTimes } from "react-icons/fa";

interface GiftModalProps {
  showGifts: boolean;
  setShowGifts: (show: boolean) => void;
  sendGift: (giftName: string) => void;
}

const GIFTS = [
  { name: "Rose", emoji: "🌹", price: "1" },
  { name: "Heart", emoji: "💖", price: "5" },
  { name: "Diamond", emoji: "💎", price: "10" },
  { name: "Crown", emoji: "👑", price: "25" },
  { name: "Rocket", emoji: "🚀", price: "50" },
  { name: "Star", emoji: "⭐", price: "100" },
];

export const GiftModal: React.FC<GiftModalProps> = ({
  showGifts,
  setShowGifts,
  sendGift,
}) => {
  if (!showGifts) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => setShowGifts(false)} 
      />
      
      <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-t-3xl w-full max-w-md p-6 transform animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Send a Gift</h3>
          <button 
            onClick={() => setShowGifts(false)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <FaTimes />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {GIFTS.map((gift) => (
            <button
              key={gift.name}
              onClick={() => sendGift(gift.name)}
              className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-center hover:bg-white/20 hover:scale-105 transition-all duration-200"
            >
              <div className="text-3xl mb-2">{gift.emoji}</div>
              <div className="text-white font-semibold text-sm">{gift.name}</div>
              <div className="text-purple-300 text-xs">{gift.price} coins</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
