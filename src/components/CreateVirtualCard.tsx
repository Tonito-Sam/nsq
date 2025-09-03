import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, AlertCircle } from "lucide-react";
import VirtualCard from './VirtualCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const generateCardNumber = () => {
  // Generate a 16-digit card number starting with 4 (Visa-like)
  const prefix = '4';
  const remaining = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
  return prefix + remaining;
};

const generateExpiryDate = () => {
  const now = new Date();
  const year = now.getFullYear() + 4; // 4 years from now
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${month}/${year.toString().slice(-2)}`;
};

const generateCVV = () => {
  return Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
};

const generatePIN = () => {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
};

const CreateVirtualCard = ({ storeName, storeId }: { storeName?: string; storeId?: string }) => {
  const { user } = useAuth();
  const [showCard, setShowCard] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    pin: '',
    isActive: true
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isBack, setIsBack] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [otpModal, setOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [hasCard, setHasCard] = useState(false);

  useEffect(() => {
    const fetchFullName = async () => {
      if (!user) return;
      // Try to get from users table first
      const { data: dbUser } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      if (dbUser && (dbUser.first_name || dbUser.last_name)) {
        setFullName(`${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim());
      } else {
        // Fallback to user_metadata or email
        const meta = user.user_metadata || {};
        setFullName(
          [meta.first_name, meta.last_name].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'User'
        );
      }
    };
    fetchFullName();
  }, [user]);

  useEffect(() => {
    // Check if user/store already has a card (simulate with localStorage for now)
    const key = storeId ? `virtual_card_store_${storeId}` : user ? `virtual_card_${user.id}` : null;
    if (key) {
      const stored = localStorage.getItem(key);
      if (stored) {
        setCardDetails(JSON.parse(stored));
        setShowCard(true);
        setHasCard(true);
      }
    }
  }, [user, storeId]);

  const handleCreateCard = () => {
    const newCard = {
      cardNumber: generateCardNumber(),
      expiryDate: generateExpiryDate(),
      cvv: generateCVV(),
      pin: generatePIN(),
      isActive: true
    };
    setCardDetails(newCard);
    setShowCard(true);
    setShowSuccess(true);
    setHasCard(true);
    const key = storeId ? `virtual_card_store_${storeId}` : user ? `virtual_card_${user.id}` : null;
    if (key) localStorage.setItem(key, JSON.stringify(newCard));
  };

  // OTP logic
  const handleFlip = () => {
    if (!showSensitive) {
      setOtpModal(true);
    } else {
      setIsBack((b) => !b);
    }
  };
  const sendOtp = async () => {
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(code);
    setOtpSent(true);
    setOtpError('');
    // Send OTP to user email (simulate with toast)
    toast({ title: 'OTP Sent', description: `OTP sent to ${user?.email}. (Simulated: ${code})` });
    // In production, send via backend/email provider
  };
  const checkOtp = () => {
    if (otpInput === otp) {
      setShowSensitive(true);
      setOtpModal(false);
      setIsBack(true);
      setOtpError('');
      setOtp('');
      setOtpInput('');
    } else {
      setOtpError('Invalid OTP. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="dark:bg-[#161616]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Virtual Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showCard ? (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Create a virtual card for secure online transactions. Your card details will be generated securely.
              </p>
              <Button 
                onClick={handleCreateCard}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
                disabled={hasCard}
              >
                Generate Virtual Card
              </Button>
              {hasCard && <div className="text-sm text-yellow-600 mt-2">You already have a virtual card.</div>}
            </div>
          ) : (
            <div className="space-y-6">
              {showSuccess && (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Your virtual card has been created successfully! Please save your card details securely.
                  </AlertDescription>
                </Alert>
              )}
              <VirtualCard
                cardNumber={cardDetails.cardNumber}
                expiryDate={cardDetails.expiryDate}
                cardHolderName={storeName || fullName}
                cvv={cardDetails.cvv}
                pin={cardDetails.pin}
                isActive={cardDetails.isActive}
                showSensitive={showSensitive}
                onFlip={handleFlip}
                isBack={isBack}
                userId={storeId || user?.id}
              />
              <Dialog open={otpModal} onOpenChange={setOtpModal}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enter OTP to View CVV & PIN</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">For your security, enter the OTP sent to your email to view sensitive card details.</p>
                    <Button onClick={sendOtp} disabled={otpSent} className="w-full">{otpSent ? 'OTP Sent' : 'Send OTP'}</Button>
                    <Input
                      placeholder="Enter OTP"
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value)}
                      className="w-full"
                      maxLength={6}
                    />
                    {otpError && <div className="text-red-600 text-sm">{otpError}</div>}
                  </div>
                  <DialogFooter>
                    <Button onClick={checkOtp} className="w-full">Verify OTP</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="space-y-4">
                <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    Please save your card details securely. For security reasons, you won't be able to view the CVV and PIN again without OTP verification.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateVirtualCard;