import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { WalletSidebar } from '@/components/WalletSidebar';
import { WalletModals } from '@/components/WalletModals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import CreateVirtualCard from '@/components/CreateVirtualCard';
import { initializePayment, PaymentGateway } from '@/services/payment';
import { ArrowUpRight, ArrowDownLeft, Plus, CreditCard } from 'lucide-react';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_name?: string;
  country: string;
  is_primary: boolean;
}

// Currency conversion rates (in a real app, fetch from an API)
const CURRENCY_RATES: { [key: string]: number } = {
  USD: 1,
  ZAR: 18.5,
  NGN: 1650,
  GBP: 0.79,
  EUR: 0.92,
  KES: 129,
  GHS: 15.8,
  BWP: 13.6,
  TZS: 2520,
  UGX: 3720,
  RWF: 1320,
  MWK: 1730,
  ZMW: 27.2,
  MZN: 63.8,
  XOF: 610,
  XAF: 610,
};

const convertToUSD = (amount: number, fromCurrency: string): number => {
  const rate = CURRENCY_RATES[fromCurrency] || 1;
  return amount / rate;
};

const convertFromUSD = (amount: number, toCurrency: string): number => {
  const rate = CURRENCY_RATES[toCurrency] || 1;
  return amount * rate;
};

const Wallet = () => {
  const { user } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    branch_name: '',
    country: ''
  });
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpGateway, setTopUpGateway] = useState<PaymentGateway>('paystack');
  const [isPaying, setIsPaying] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank');
  const [withdrawBank, setWithdrawBank] = useState('');
  const [showSendMoneyModal, setShowSendMoneyModal] = useState(false);
  const [sendMoneyAmount, setSendMoneyAmount] = useState('');
  const [sendMoneyUser, setSendMoneyUser] = useState('');
  const [showRequestPaymentModal, setShowRequestPaymentModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestUser, setRequestUser] = useState('');
  const [userCurrency, setUserCurrency] = useState('USD');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchBankAccounts();
      fetchUserProfile();
      fetchWalletBalance();
      fetchTransactions();
    }
  }, [user]);

  const getGatewaysForCurrency = (currency: string): PaymentGateway[] => {
    if (["ZAR", "BWP"].includes(currency)) return ["paystack", "applepay", "googlepay"];
    if (["USD", "GBP", "NGN", "KES", "GHS", "TZS", "UGX", "RWF", "MWK", "ZMW", "MZN", "XOF", "XAF"].includes(currency)) return ["flutterwave", "applepay", "googlepay"];
    return ["applepay", "googlepay"];
  };

  useEffect(() => {
    if (userCurrency) {
      const gateways = getGatewaysForCurrency(userCurrency);
      setAvailableGateways(gateways);
      if (!gateways.includes(topUpGateway)) {
        setTopUpGateway(gateways[0]);
      }
    }
  }, [userCurrency]);

  const fetchBankAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('currency, paypal_email')
        .eq('id', user.id)
        .single();
      if (!error && data && typeof data === 'object' && data !== null && 'currency' in data && 'paypal_email' in data) {
        setUserCurrency(data.currency || 'USD');
        setPaypalEmail(data.paypal_email || '');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchWalletBalance = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setWalletBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleTopUpPayment = async () => {
    setIsPaying(true);
    try {
      const localAmount = Number(topUpAmount);
      const usdAmount = convertToUSD(localAmount, userCurrency);
      
      // Initialize payment with user's local currency
      await initializePayment(topUpGateway, {
        amount: localAmount,
        currency: userCurrency,
        buyerCountry: 'NG',
        buyerCurrency: userCurrency,
        sellerCountry: 'NG',
        sellerCurrency: userCurrency,
        email: user?.email || '',
        reference: `TOPUP-${Date.now()}`,
        metadata: { 
          user_id: user?.id,
          usd_amount: usdAmount.toFixed(2),
          local_amount: localAmount,
          local_currency: userCurrency
        }
      });

      // Simulate successful payment callback - update wallet with USD amount
      const updatedBalance = walletBalance + usdAmount;
      setWalletBalance(updatedBalance);
      
      // Update wallet in database
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          balance: updatedBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id);

      if (walletError) {
        // If update failed, try insert
        await supabase
          .from('wallets')
          .insert({ 
            user_id: user?.id, 
            balance: updatedBalance,
            updated_at: new Date().toISOString()
          });
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user?.id,
          type: 'topup',
          amount_usd: usdAmount,
          amount_local: localAmount,
          currency_local: userCurrency,
          gateway: topUpGateway,
          status: 'completed',
          reference: `TOPUP-${Date.now()}`,
          description: `Test wallet top-up via ${topUpGateway}`,
          is_test: true
        });

      if (!transactionError) {
        // Refresh transactions list
        fetchTransactions();
      }

      toast({ 
        title: 'Wallet Topped Up Successfully!', 
        description: `Added ${localAmount.toLocaleString()} ${userCurrency} (≈ $${usdAmount.toFixed(2)} USD) to your wallet.`
      });

      setShowTopUpModal(false);
      setTopUpAmount('');
      
    } catch (err) {
      toast({ title: 'Payment Error', description: 'Failed to initialize payment.' });
    } finally {
      setIsPaying(false);
    }
  };

  const getUSDEquivalent = (amount: string) => {
    if (!amount || !userCurrency) return '';
    const localAmount = Number(amount);
    if (isNaN(localAmount) || localAmount <= 0) return '';
    const usdAmount = convertToUSD(localAmount, userCurrency);
    return `≈ $${usdAmount.toFixed(2)} USD`;
  };

  const notify = (msg: string) => toast({ title: 'Notification', description: msg });

  const handleWithdraw = () => {
    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setWithdrawBank('');
    notify('Withdrawal request submitted.');
  };

  const handleSendMoney = () => {
    setShowSendMoneyModal(false);
    setSendMoneyAmount('');
    setSendMoneyUser('');
    notify('Money sent and both users notified.');
  };

  const handleRequestPayment = () => {
    setShowRequestPaymentModal(false);
    setRequestAmount('');
    setRequestUser('');
    notify('Payment request sent.');
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'send':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'receive':
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'withdraw':
        return <ArrowUpRight className="h-4 w-4 text-orange-600" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'topup':
        return 'Top Up';
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Received';
      case 'withdraw':
        return 'Withdrawal';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col lg:flex-row gap-6">
        {/* Wallet Sidebar */}
        <div className="w-full lg:w-64 mb-6 lg:mb-0">
          <WalletSidebar
            onTopUp={() => setShowTopUpModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
            onSendMoney={() => setShowSendMoneyModal(true)}
            onRequestPayment={() => setShowRequestPaymentModal(true)}
          />
        </div>
        {/* Main Wallet Content */}
        <div className="flex-1">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Wallet</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Manage your finances and transactions</p>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className="flex-1 space-y-4 sm:space-y-6">
              {/* Wallet Balance */}
              <Card className="dark:bg-[#161616]">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                  <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      ${walletBalance.toFixed(2)} <span className="text-base font-semibold text-gray-500 dark:text-gray-400">USD</span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm sm:text-base">Available Balance</p>
                    {userCurrency !== 'USD' && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        ≈ {convertFromUSD(walletBalance, userCurrency).toLocaleString()} {userCurrency}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* Virtual Card Section */}
              <CreateVirtualCard />
              {/* Recent Transactions */}
              <Card className="dark:bg-[#161616]">
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    {transactions.length === 0 ? (
                      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No transactions found.</p>
                        <p className="text-sm">Your transaction history will appear here.</p>
                      </div>
                    ) : (
                      transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {formatTransactionType(transaction.type)}
                                </p>
                                {transaction.is_test && (
                                  <Badge variant="secondary" className="text-xs">
                                    TEST
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {transaction.description || `${transaction.gateway} payment`}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDate(transaction.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${
                              transaction.type === 'topup' || transaction.type === 'receive' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {transaction.type === 'topup' || transaction.type === 'receive' ? '+' : '-'}
                              ${transaction.amount_usd?.toFixed(2)}
                            </p>
                            {transaction.currency_local && transaction.currency_local !== 'USD' && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {transaction.amount_local?.toLocaleString()} {transaction.currency_local}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                              {transaction.status}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <WalletModals
            showTopUp={showTopUp}
            showSendMoney={showSendMoney}
            showWithdraw={showWithdraw}
            onClose={() => {
              setShowTopUp(false);
              setShowSendMoney(false);
              setShowWithdraw(false);
            }}
            bankAccounts={bankAccounts}
            userCurrency={userCurrency}
            convertToUSD={convertToUSD}
            convertFromUSD={convertFromUSD}
          />
          {/* Top Up Modal - Updated with currency conversion */}
          <Dialog open={showTopUpModal} onOpenChange={setShowTopUpModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Top Up Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Amount in {userCurrency}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter amount"
                      value={topUpAmount}
                      onChange={e => setTopUpAmount(e.target.value)}
                      className="w-full"
                    />
                    <span className="font-semibold text-gray-600 dark:text-gray-400">{userCurrency}</span>
                  </div>
                  {topUpAmount && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {getUSDEquivalent(topUpAmount)}
                    </p>
                  )}
                </div>
                {availableGateways.length === 0 ? (
                  <div className="text-red-600 text-sm">No payment gateway available for your currency. Please contact support.</div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Payment Method
                    </label>
                    <RadioGroup value={topUpGateway} onValueChange={value => setTopUpGateway(value as PaymentGateway)} className="flex gap-4">
                      {availableGateways.includes('paystack') && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="paystack" id="paystack" />
                          <label htmlFor="paystack">Paystack</label>
                        </div>
                      )}
                      {availableGateways.includes('flutterwave') && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="flutterwave" id="flutterwave" />
                          <label htmlFor="flutterwave">Flutterwave</label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleTopUpPayment}
                  disabled={!topUpAmount || isPaying || availableGateways.length === 0}
                  className="w-full"
                >
                  {isPaying ? 'Processing...' : `Pay ${topUpAmount} ${userCurrency}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Withdraw Funds</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full"
                  />
                  <span className="font-semibold">{userCurrency}</span>
                </div>
                <RadioGroup value={withdrawMethod} onValueChange={setWithdrawMethod} className="flex gap-4">
                  <RadioGroupItem value="bank" id="bank" />
                  <label htmlFor="bank" className="mr-4">Bank</label>
                  <RadioGroupItem value="paypal" id="paypal" />
                  <label htmlFor="paypal">PayPal</label>
                </RadioGroup>
                {withdrawMethod === 'bank' ? (
                  bankAccounts.length > 0 ? (
                    <Select value={withdrawBank} onValueChange={setWithdrawBank}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.bank_name} - {account.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-red-600 text-sm">You need to add a bank account in your Edit Profile page before you can withdraw to a bank.</div>
                  )
                ) : (
                  paypalEmail ? (
                    <Input value={paypalEmail} readOnly className="w-full" />
                  ) : (
                    <div className="text-red-600 text-sm">You need to add a PayPal email in your Edit Profile page before you can withdraw to PayPal.</div>
                  )
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleWithdraw}
                  disabled={
                    !withdrawAmount ||
                    (withdrawMethod === 'bank' && (!withdrawBank || bankAccounts.length === 0)) ||
                    (withdrawMethod === 'paypal' && !paypalEmail)
                  }
                  className="w-full"
                >
                  Request Withdrawal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showSendMoneyModal} onOpenChange={setShowSendMoneyModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Money</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={sendMoneyAmount}
                    onChange={e => setSendMoneyAmount(e.target.value)}
                    className="w-full"
                  />
                  <span className="font-semibold">{userCurrency}</span>
                </div>
                <Input
                  placeholder="Enter username or full name (simulate search)"
                  value={sendMoneyUser}
                  onChange={e => setSendMoneyUser(e.target.value)}
                  className="w-full"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSendMoney}
                  disabled={!sendMoneyAmount || !sendMoneyUser}
                  className="w-full"
                >
                  Send Money
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showRequestPaymentModal} onOpenChange={setShowRequestPaymentModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={requestAmount}
                    onChange={e => setRequestAmount(e.target.value)}
                    className="w-full"
                  />
                  <span className="font-semibold">{userCurrency}</span>
                </div>
                <Input
                  placeholder="Enter username or full name (simulate search)"
                  value={requestUser}
                  onChange={e => setRequestUser(e.target.value)}
                  className="w-full"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={handleRequestPayment}
                  disabled={!requestAmount || !requestUser}
                  className="w-full"
                >
                  Request Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
};

export default Wallet;
