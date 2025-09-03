import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Send, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface WalletModalsProps {
  showTopUp: boolean;
  showSendMoney: boolean;
  showWithdraw: boolean;
  onClose: () => void;
  bankAccounts: any[];
  userCurrency: string;
  convertToUSD: (amount: number, fromCurrency: string) => number;
  convertFromUSD: (amount: number, toCurrency: string) => number;
}

export const WalletModals: React.FC<WalletModalsProps> = ({
  showTopUp,
  showSendMoney,
  showWithdraw,
  onClose,
  bankAccounts,
  userCurrency,
  convertToUSD,
  convertFromUSD,
}) => {
  const [topUpData, setTopUpData] = useState({ amount: '', method: 'card' });
  const [sendMoneyData, setSendMoneyData] = useState({
    recipient: '',
    amount: '',
    message: '',
  });
  const [withdrawData, setWithdrawData] = useState({
    amount: '',
    bankAccountId: '',
  });

  const currencySymbols: Record<string, string> = {
    USD: '$',
    ZAR: 'R',
    NGN: '₦',
    EUR: '€',
    GBP: '£',
    KES: 'KSh',
    GHS: '₵',
    INR: '₹',
  };

  const getSymbol = (code: string) => currencySymbols[code] || code;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getUSDEquivalent = (amount: string) => {
    if (!amount || userCurrency === 'USD') return '';
    const localAmount = Number(amount);
    if (isNaN(localAmount) || localAmount <= 0) return '';
    const usdAmount = convertToUSD(localAmount, userCurrency);
    return `≈ ${formatCurrency(usdAmount, 'USD')}`;
  };

  const handleTopUp = async () => {
    if (!topUpData.amount || parseFloat(topUpData.amount) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    const localAmount = parseFloat(topUpData.amount);
    const usdAmount = convertToUSD(localAmount, userCurrency);

    toast({
      title: 'Top Up Initiated',
      description: `${formatCurrency(localAmount, userCurrency)} (≈ ${formatCurrency(usdAmount, 'USD')}) top up request submitted`,
    });

    setTopUpData({ amount: '', method: 'card' });
    onClose();
  };

  const handleSendMoney = async () => {
    if (
      !sendMoneyData.recipient ||
      !sendMoneyData.amount ||
      parseFloat(sendMoneyData.amount) <= 0
    ) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const localAmount = parseFloat(sendMoneyData.amount);

    toast({
      title: 'Money Sent',
      description: `${formatCurrency(localAmount, userCurrency)} sent to ${sendMoneyData.recipient}`,
    });

    setSendMoneyData({ recipient: '', amount: '', message: '' });
    onClose();
  };

  const handleWithdraw = async () => {
    if (
      !withdrawData.amount ||
      !withdrawData.bankAccountId ||
      parseFloat(withdrawData.amount) <= 0
    ) {
      toast({
        title: 'Error',
        description: 'Please select a bank account and enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    const localAmount = parseFloat(withdrawData.amount);

    toast({
      title: 'Withdrawal Initiated',
      description: `${formatCurrency(localAmount, userCurrency)} withdrawal request submitted`,
    });

    setWithdrawData({ amount: '', bankAccountId: '' });
    onClose();
  };

  return (
    <>
      {/* Top Up Modal */}
      <Dialog open={showTopUp} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Top Up Wallet
            </DialogTitle>
          </DialogHeader>
          <p className="sr-only" id="topup-description">
            Enter the amount and select a payment method to top up your wallet balance.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topup-amount">Amount in {userCurrency}</Label>
              <div className="relative">
                <Input
                  id="topup-amount"
                  type="number"
                  placeholder={`Enter amount in ${userCurrency}`}
                  value={topUpData.amount}
                  onChange={(e) =>
                    setTopUpData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500">
                  {getSymbol(userCurrency)}
                </span>
              </div>
              {topUpData.amount && getUSDEquivalent(topUpData.amount) && (
                <p className="text-sm text-gray-500 mt-1">
                  {getUSDEquivalent(topUpData.amount)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="topup-method">Payment Method</Label>
              <Select
                value={topUpData.method}
                onValueChange={(value) =>
                  setTopUpData((prev) => ({ ...prev, method: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleTopUp} className="flex-1">
                {topUpData.amount
                  ? `Pay ${formatCurrency(
                      parseFloat(topUpData.amount),
                      userCurrency
                    )}`
                  : `Pay ${getSymbol(userCurrency)}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Money Modal */}
      <Dialog open={showSendMoney} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Money
            </DialogTitle>
          </DialogHeader>
          <p className="sr-only" id="sendmoney-description">
            Enter the recipient, amount, and an optional message to send money from your wallet.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="send-recipient">Recipient (username or email)</Label>
              <Input
                id="send-recipient"
                placeholder="@username or email@example.com"
                value={sendMoneyData.recipient}
                onChange={(e) =>
                  setSendMoneyData((prev) => ({
                    ...prev,
                    recipient: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="send-amount">Amount in {userCurrency}</Label>
              <div className="relative">
                <Input
                  id="send-amount"
                  type="number"
                  placeholder="0.00"
                  value={sendMoneyData.amount}
                  onChange={(e) =>
                    setSendMoneyData((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500">
                  {getSymbol(userCurrency)}
                </span>
              </div>
              {sendMoneyData.amount && getUSDEquivalent(sendMoneyData.amount) && (
                <p className="text-sm text-gray-500 mt-1">
                  {getUSDEquivalent(sendMoneyData.amount)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="send-message">Message (optional)</Label>
              <Input
                id="send-message"
                placeholder="What's this for?"
                value={sendMoneyData.message}
                onChange={(e) =>
                  setSendMoneyData((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSendMoney} className="flex-1">
                Send Money
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={showWithdraw} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Withdraw Money
            </DialogTitle>
          </DialogHeader>
          <p className="sr-only" id="withdraw-description">
            Enter the amount and select a bank account to withdraw money from your wallet.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-amount">Amount in {userCurrency}</Label>
              <div className="relative">
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={withdrawData.amount}
                  onChange={(e) =>
                    setWithdrawData((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500">
                  {getSymbol(userCurrency)}
                </span>
              </div>
              {withdrawData.amount &&
                getUSDEquivalent(withdrawData.amount) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {getUSDEquivalent(withdrawData.amount)}
                  </p>
                )}
            </div>
            <div>
              <Label htmlFor="withdraw-bank">Bank Account</Label>
              <Select
                value={withdrawData.bankAccountId}
                onValueChange={(value) =>
                  setWithdrawData((prev) => ({
                    ...prev,
                    bankAccountId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - ****
                      {account.account_number.slice(-4)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bankAccounts.length === 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please add a bank account first to withdraw money.
              </p>
            )}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={bankAccounts.length === 0}
                className="flex-1"
              >
                Withdraw
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
