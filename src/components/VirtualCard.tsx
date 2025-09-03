import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CreditCard, Lock } from "lucide-react";

interface VirtualCardProps {
  cardNumber: string;
  expiryDate: string;
  cardHolderName: string;
  cvv: string;
  pin: string;
  isActive: boolean;
}

const VirtualCard: React.FC<VirtualCardProps & { showSensitive?: boolean; onFlip?: () => void; isBack?: boolean; userId?: string }> = ({
  cardNumber,
  expiryDate,
  cardHolderName,
  cvv,
  pin,
  isActive,
  showSensitive = false,
  onFlip,
  isBack = false,
  userId
}) => {
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const formatCardNumber = (number: string, masked = false) => {
    if (!number) return '';
    if (masked) {
      // Show only last 6 digits, rest as asterisks
      const clean = number.replace(/\s+/g, '');
      const last6 = clean.slice(-6);
      return '**** **** **** ' + last6;
    }
    return number.replace(/(\d{4})/g, '$1 ').trim();
  };

  // Generate a unique serial code for the card (e.g., hash of userId + cardNumber)
  const serialCode = userId && cardNumber ? btoa(`${userId}-${cardNumber}`).slice(0, 16) : '';

  return (
    <div className="relative w-full max-w-xs mx-auto sm:max-w-sm" style={{ aspectRatio: '1.586 / 1', minWidth: 220, maxWidth: 400 }}>
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#2a2133] to-[#151c2b] text-white shadow-xl rounded-2xl flex flex-col justify-between"
        style={{ aspectRatio: '1.586 / 1', minHeight: 140, maxHeight: 260 }}>
        {/* Watermark Logo (front: faded, back: favicon) */}
        {isBack ? (
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none select-none">
            <img src="/favicon.ico" alt="Card Logo" className="w-16 h-16 object-contain" />
          </div>
        ) : (
          <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
            <img src="/favicon.ico" alt="Card Logo" className="w-full h-full object-contain opacity-20" style={{ position: 'absolute', inset: 0 }} />
          </div>
        )}
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1 flex flex-col justify-between">
          {!isBack ? (
            <>
              {/* Top Row: Chip, Virtual Card, Active, Logo */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-8 h-6 sm:w-12 sm:h-8 bg-yellow-300 rounded-md shadow-inner" />
                  <span className="text-xs sm:text-sm font-semibold text-white/90 ml-1 sm:ml-2">Virtual Card</span>
                  <span className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${isActive ? 'bg-green-200 text-green-800' : 'bg-gray-300 text-gray-700'}`}>{isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <img src="/favicon.ico" alt="Card Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
              </div>
              {/* Card Number */}
              <div className="space-y-1 sm:space-y-2">
                <p className="text-xs sm:text-sm text-white/80">Card Number</p>
                <p className="text-lg sm:text-2xl tracking-wider font-mono break-all">
                  {formatCardNumber(cardNumber, true)}
                </p>
              </div>
              {/* Card Details */}
              <div className="flex flex-row justify-between items-end w-full gap-2 sm:gap-0">
                <div className="flex flex-col">
                  <p className="text-xs sm:text-sm text-white/80">Card Holder</p>
                  <p className="text-sm sm:text-lg font-medium break-all">{cardHolderName}</p>
                </div>
                <div className="flex flex-col items-end sm:items-start">
                  <p className="text-xs sm:text-sm text-white/80">Expires</p>
                  <p className="text-sm sm:text-lg font-medium">{expiryDate}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center h-full gap-4 sm:gap-6">
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-xs sm:text-sm text-white/80">CVV</p>
                  <p className="text-lg sm:text-2xl font-mono">
                    {showSensitive ? cvv : '•••'}
                  </p>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-xs sm:text-sm text-white/80">PIN</p>
                  <p className="text-lg sm:text-2xl font-mono">
                    {showSensitive ? pin : '••••'}
                  </p>
                </div>
                {/* Serial barcode */}
                {serialCode && (
                  <div className="mt-2 sm:mt-4 flex flex-col items-center">
                    <div className="w-24 sm:w-32 h-6 bg-white rounded-sm flex items-center justify-center">
                      <span className="text-[10px] sm:text-xs font-mono text-gray-800 tracking-widest">{serialCode}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-white/70 mt-1">Serial</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {/* Flip Card Button - always visible, centered below card */}
      <div className="flex justify-center mt-3">
        <Button variant="outline" size="sm" onClick={onFlip}>
          {isBack ? 'Show Front' : 'Show Back'}
        </Button>
      </div>
    </div>
  );
};

export default VirtualCard; 