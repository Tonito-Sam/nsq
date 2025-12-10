import { useState, useEffect, useCallback } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import CreateVirtualCard from '@/components/CreateVirtualCard';
import { initializePayment, PaymentGateway } from '@/services/payment';
import { ArrowUpRight, ArrowDownLeft, Plus, CreditCard, Gift, Rocket, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_name?: string;
  country: string;
  is_primary: boolean;
}

interface WalletBalance {
  real_balance: number;
  virtual_balance: number;
  total_balance: number;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url?: string | null;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface PromoTransfer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  note: string;
  metadata: any;
  created_at: string;
  from_user?: User;
  to_user?: User;
}

import useCurrencyRates from '@/hooks/useCurrencyRates';

const convertToUSD = (amount: number, fromCurrency: string, rates: { [k:string]: number } | undefined): number => {
  if (!rates) return amount;
  const r = rates[fromCurrency] || 1;
  if (!r || r === 0) return amount;
  return amount / r;
};

const convertFromUSD = (amount: number, toCurrency: string, rates: { [k:string]: number } | undefined): number => {
  if (!rates) return amount;
  const r = rates[toCurrency] || 1;
  return amount * r;
};

const Wallet = () => {
  const { user } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
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
  const [sendMoneyBalanceType, setSendMoneyBalanceType] = useState<'real' | 'virtual'>('real');
  const [sendMoneyNote, setSendMoneyNote] = useState('');
  const [showRequestPaymentModal, setShowRequestPaymentModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestUser, setRequestUser] = useState('');
  const [userCurrency, setUserCurrency] = useState('USD');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [promoTransfers, setPromoTransfers] = useState<PromoTransfer[]>([]);
  const [walletBalance, setWalletBalance] = useState<WalletBalance>({
    real_balance: 0,
    virtual_balance: 100,
    total_balance: 100
  });
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openUserDropdown, setOpenUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState<User[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<string>(() => {
    try { return localStorage.getItem('baseCurrency') || 'USD'; } catch(e) { return 'USD'; }
  });
  const { rates, loading: ratesLoading, updatedAt, refresh, isCached } = useCurrencyRates(baseCurrency, 5 * 60 * 1000);

  // Backwards-compatible wrappers for components that expect 2-arg convert functions
  const convertToUSDForModals = (amount: number, fromCurrency: string) => convertToUSD(amount, fromCurrency, rates);
  const convertFromUSDForModals = (amount: number, toCurrency: string) => convertFromUSD(amount, toCurrency, rates);

  useEffect(() => {
    if (user) {
      fetchBankAccounts();
      fetchUserProfile();
      fetchWalletBalance();
      fetchTransactions();
      fetchPromoTransfers();
      fetchRecentRecipients();
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

  useEffect(() => {
    // refresh rates when userCurrency changes so conversion displays correct values
    refresh();
  }, [userCurrency, refresh]);

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
        .select('real_balance, virtual_balance, total_balance')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setWalletBalance({
          real_balance: data.real_balance || 0,
          virtual_balance: data.virtual_balance || 100,
          total_balance: data.total_balance || (data.real_balance || 0) + (data.virtual_balance || 100)
        });
      } else if (error && error.code === 'PGRST116') {
        // No wallet record found, create one with initial virtual balance
        const initialVirtualBalance = 100;
        const { data: newWallet, error: insertError } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            real_balance: 0,
            virtual_balance: initialVirtualBalance,
            total_balance: initialVirtualBalance,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (!insertError && newWallet) {
          setWalletBalance({
            real_balance: 0,
            virtual_balance: initialVirtualBalance,
            total_balance: initialVirtualBalance
          });
        }
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

  const fetchPromoTransfers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('promo_transfers')
        .select(`
          *,
          from_user:users!promo_transfers_from_user_id_fkey(id, email, full_name, username, avatar_url),
          to_user:users!promo_transfers_to_user_id_fkey(id, email, full_name, username, avatar_url)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        // Supabase sometimes returns joined rows as arrays; normalize them
        const normalized: PromoTransfer[] = data.map((row: any) => {
          const from_user = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
          const to_user = Array.isArray(row.to_user) ? row.to_user[0] : row.to_user;

          return {
            id: row.id,
            from_user_id: row.from_user_id,
            to_user_id: row.to_user_id,
            amount: row.amount,
            note: row.note,
            metadata: row.metadata,
            created_at: row.created_at,
            from_user: from_user ? {
              id: from_user.id,
              email: from_user.email,
              full_name: from_user.full_name,
              username: from_user.username,
              avatar_url: from_user.avatar_url
            } : undefined,
            to_user: to_user ? {
              id: to_user.id,
              email: to_user.email,
              full_name: to_user.full_name,
              username: to_user.username,
              avatar_url: to_user.avatar_url
            } : undefined
          };
        });

        setPromoTransfers(normalized);
      }
    } catch (error) {
      console.error('Error fetching promo transfers:', error);
    }
  };

  const fetchUsers = useCallback(async (query = '') => {
    if (!user) return;
    setIsLoadingUsers(true);
    try {
      // Prefer backend service-role search (handles RLS). If backend fails, fall back to client-side Supabase query.
      try {
        const resp = await fetch((await import('@/lib/api')).default(`/api/users/search?q=${encodeURIComponent(query)}`));
        if (resp.ok) {
          const body = await resp.json();
          const rows = Array.isArray(body.data) ? body.data : [];
          setUsers(rows.map((r: any) => ({ id: r.id, email: r.email, full_name: r.full_name, username: r.username })));
          return;
        }
      } catch (e) {
        // backend search failed; fall back to client
        console.warn('Backend user search failed, falling back to Supabase client.', e);
      }

      // Fallback: client-side Supabase query (requires anon key and RLS permissions)
      let queryBuilder = supabase
        .from('profiles')
        .select('id, email, full_name, username, avatar_url')
        .neq('id', user.id)
        .limit(10);

      if (query.trim()) {
        // Search by full name, username, or email
        queryBuilder = queryBuilder.or(`full_name.ilike.%${query}%,username.ilike.%${query}%,email.ilike.%${query}%`);
      } else {
        // If no query, get recent users from promo transfers
        const { data: recentTransfers } = await supabase
          .from('promo_transfers')
          .select('to_user_id')
          .eq('from_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentTransfers && recentTransfers.length > 0) {
          const userIds = recentTransfers.map(t => t.to_user_id);
          queryBuilder = queryBuilder.in('id', userIds);
        }
      }

      const { data, error } = await queryBuilder;

      if (!error && data) {
        // Convert Profile[] to User[]
        const usersList: User[] = data.map((profile: Profile) => ({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url
        }));
        setUsers(usersList);
      } else {
        console.error('Error fetching users:', error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [user]);

  const fetchRecentRecipients = async () => {
    if (!user) return;
    try {
      const { data: recentTransfers, error } = await supabase
        .from('promo_transfers')
        .select(`
          to_user_id,
          to_user:users!promo_transfers_to_user_id_fkey(id, email, full_name, username, avatar_url)
        `)
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && recentTransfers) {
        const recipients: User[] = recentTransfers
          .filter(transfer => transfer.to_user)
          .map(transfer => {
            const toUser = Array.isArray(transfer.to_user) ? transfer.to_user[0] : transfer.to_user;
            return ({
              id: toUser.id,
              email: toUser.email || '',
              full_name: toUser.full_name,
              username: toUser.username,
              avatar_url: toUser.avatar_url
            });
          });
        
        // Remove duplicates
        const uniqueRecipients = recipients.filter((recipient, index, self) =>
          index === self.findIndex(r => r.id === recipient.id)
        );
        
        setRecentRecipients(uniqueRecipients);
      }
    } catch (error) {
      console.error('Error fetching recent recipients:', error);
    }
  };

  const handleTopUpPayment = async () => {
    setIsPaying(true);
    try {
      const localAmount = Number(topUpAmount);
      const usdAmount = convertToUSD(localAmount, userCurrency, rates);
      
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

      // Update wallet with REAL balance only
      const updatedRealBalance = walletBalance.real_balance + usdAmount;
      const updatedTotalBalance = updatedRealBalance + walletBalance.virtual_balance;
      
      // Update wallet in database
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          real_balance: updatedRealBalance,
          total_balance: updatedTotalBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id);

      if (walletError) {
        // If update failed, try insert
        await supabase
          .from('wallets')
          .insert({ 
            user_id: user?.id, 
            real_balance: updatedRealBalance,
            virtual_balance: walletBalance.virtual_balance,
            total_balance: updatedTotalBalance,
            updated_at: new Date().toISOString()
          });
      }

      // Update local state
      setWalletBalance({
        ...walletBalance,
        real_balance: updatedRealBalance,
        total_balance: updatedTotalBalance
      });

      // Create transaction record
      await supabase
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
          description: `Wallet top-up via ${topUpGateway}`,
          is_test: true,
          balance_type: 'real'
        });

      // Refresh transactions list
      fetchTransactions();

      toast({ 
        title: 'Wallet Topped Up Successfully!', 
        description: `Added ${localAmount.toLocaleString()} ${userCurrency} (≈ $${usdAmount.toFixed(2)} USD) to your real balance.`
      });

      setShowTopUpModal(false);
      setTopUpAmount('');
      
    } catch (err) {
      toast({ title: 'Payment Error', description: 'Failed to initialize payment.' });
    } finally {
      setIsPaying(false);
    }
  };

  const handleSendMoney = async () => {
    if (!sendMoneyAmount || !selectedUser || !user) {
      toast({ title: 'Error', description: 'Please fill all fields.' });
      return;
    }

    const amount = Number(sendMoneyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount.' });
      return;
    }

    // Check if user has enough balance
    const availableBalance = sendMoneyBalanceType === 'real' 
      ? walletBalance.real_balance 
      : walletBalance.virtual_balance;
    
    if (amount > availableBalance) {
      toast({ 
        title: 'Insufficient Balance', 
        description: `You don't have enough ${sendMoneyBalanceType === 'real' ? 'real' : 'virtual'} balance. Available: $${availableBalance.toFixed(2)}` 
      });
      return;
    }

    try {
      if (sendMoneyBalanceType === 'virtual') {
        // Handle virtual balance transfer using promo_transfers table
        await supabase
          .from('promo_transfers')
          .insert({
            from_user_id: user.id,
            to_user_id: selectedUser.id,
            amount: amount,
            note: sendMoneyNote || `Promo money transfer`,
            metadata: {
              type: 'promo_transfer',
              from_balance: 'virtual',
              transferred_at: new Date().toISOString()
            }
          });

        // Update sender's virtual balance
        const updatedSenderVirtualBalance = walletBalance.virtual_balance - amount;
        const updatedSenderTotalBalance = walletBalance.real_balance + updatedSenderVirtualBalance;

        // Update sender's wallet in database
        await supabase
          .from('wallets')
          .update({
            virtual_balance: updatedSenderVirtualBalance,
            total_balance: updatedSenderTotalBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        // Update receiver's virtual balance
        // First, get receiver's current balance
        const { data: receiverWallet } = await supabase
          .from('wallets')
          .select('virtual_balance, real_balance')
          .eq('user_id', selectedUser.id)
          .single();

        const receiverCurrentVirtual = receiverWallet?.virtual_balance || 100;
        const receiverCurrentReal = receiverWallet?.real_balance || 0;
        const updatedReceiverVirtualBalance = receiverCurrentVirtual + amount;
        const updatedReceiverTotalBalance = receiverCurrentReal + updatedReceiverVirtualBalance;

        // Update or create receiver's wallet
        await supabase
          .from('wallets')
          .upsert({
            user_id: selectedUser.id,
            virtual_balance: updatedReceiverVirtualBalance,
            real_balance: receiverCurrentReal,
            total_balance: updatedReceiverTotalBalance,
            updated_at: new Date().toISOString(),
            created_at: receiverWallet ? undefined : new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        // Update local state
        setWalletBalance({
          ...walletBalance,
          virtual_balance: updatedSenderVirtualBalance,
          total_balance: updatedSenderTotalBalance
        });

        // Create transaction record for sender
        await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'send',
            amount_usd: amount,
            amount_local: amount,
            currency_local: 'USD',
            gateway: 'internal',
            status: 'completed',
            reference: `PROMO-SEND-${Date.now()}`,
            description: `Sent promo money to ${selectedUser.full_name || selectedUser.username || selectedUser.email}`,
            is_test: false,
            balance_type: 'virtual',
            recipient_info: selectedUser.email
          });

        // Refresh data
        fetchPromoTransfers();
        fetchTransactions();
        fetchRecentRecipients();

        toast({ 
          title: 'Promo Money Sent Successfully!', 
          description: `Sent $${amount.toFixed(2)} virtual balance to ${selectedUser.full_name || selectedUser.username || selectedUser.email}. They can only use it for post boosting.`
        });

      } else {
        // Handle real balance transfer (original logic)
        const updatedSenderRealBalance = walletBalance.real_balance - amount;
        const updatedSenderTotalBalance = updatedSenderRealBalance + walletBalance.virtual_balance;

        // Update sender's wallet in database
        await supabase
          .from('wallets')
          .update({
            real_balance: updatedSenderRealBalance,
            total_balance: updatedSenderTotalBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        // Update local state
        setWalletBalance({
          ...walletBalance,
          real_balance: updatedSenderRealBalance,
          total_balance: updatedSenderTotalBalance
        });

        // Create transaction record for sender
        await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'send',
            amount_usd: amount,
            amount_local: amount,
            currency_local: 'USD',
            gateway: 'internal',
            status: 'completed',
            reference: `REAL-SEND-${Date.now()}`,
            description: `Sent real money to ${selectedUser.full_name || selectedUser.username || selectedUser.email}`,
            is_test: false,
            balance_type: 'real',
            recipient_info: selectedUser.email
          });

        fetchTransactions();
        toast({ 
          title: 'Money Sent Successfully!', 
          description: `Sent $${amount.toFixed(2)} real balance to ${selectedUser.full_name || selectedUser.username || selectedUser.email}.`
        });
      }

      setShowSendMoneyModal(false);
      setSendMoneyAmount('');
      setSelectedUser(null);
      setSendMoneyNote('');
      
    } catch (error) {
      console.error('Error sending money:', error);
      toast({ title: 'Error', description: 'Failed to send money. Please try again.' });
    }
  };

  const handleWithdraw = () => {
    // Withdraw only from REAL balance
    const amount = Number(withdrawAmount);
    
    if (amount > walletBalance.real_balance) {
      toast({ 
        title: 'Insufficient Real Balance', 
        description: `You can only withdraw from your real balance. Available: $${walletBalance.real_balance.toFixed(2)}` 
      });
      return;
    }

    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setWithdrawBank('');
    toast({ 
      title: 'Withdrawal Request Submitted', 
      description: `$${amount.toFixed(2)} will be processed from your real balance.`
    });
  };

  const handleRequestPayment = () => {
    setShowRequestPaymentModal(false);
    setRequestAmount('');
    setRequestUser('');
    toast({ 
      title: 'Payment Request Sent', 
      description: `Requested $${requestAmount} from ${requestUser}.`
    });
  };

  const getUSDEquivalent = (amount: string) => {
    if (!amount || !userCurrency) return '';
    const localAmount = Number(amount);
    if (isNaN(localAmount) || localAmount <= 0) return '';
    const usdAmount = convertToUSD(localAmount, userCurrency, rates);
    return `≈ $${usdAmount.toFixed(2)} USD`;
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
      case 'boost':
        return <Rocket className="h-4 w-4 text-purple-600" />;
      case 'virtual_grant':
        return <Gift className="h-4 w-4 text-blue-600" />;
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
      case 'boost':
        return 'Post Boost';
      case 'virtual_grant':
        return 'Virtual Grant';
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

  const getBalanceColor = (type: 'real' | 'virtual') => {
    return type === 'real' ? 'text-green-600' : 'text-blue-600';
  };

  const handleSearchUsers = (query: string) => {
    setSearchQuery(query);
    fetchUsers(query);
  };

  // Filter transactions for display
  const allTransactions = [
    ...transactions,
    ...promoTransfers.map(transfer => ({
      id: transfer.id,
      user_id: transfer.from_user_id === user?.id ? transfer.from_user_id : transfer.to_user_id,
      type: transfer.from_user_id === user?.id ? 'send' : 'receive',
      amount_usd: transfer.amount,
      amount_local: transfer.amount,
      currency_local: 'USD',
      gateway: 'internal',
      status: 'completed',
      reference: `PROMO-${transfer.id}`,
      description: transfer.from_user_id === user?.id 
        ? `Sent promo money to ${transfer.to_user?.full_name || transfer.to_user?.username || transfer.to_user?.email || 'User'}`
        : `Received promo money from ${transfer.from_user?.full_name || transfer.from_user?.username || transfer.from_user?.email || 'User'}`,
      is_test: false,
      balance_type: 'virtual',
      recipient_info: transfer.from_user_id === user?.id ? transfer.to_user?.email : transfer.from_user?.email,
      created_at: transfer.created_at,
      is_promo_transfer: true
    }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleSelectRecentRecipient = (recipient: User) => {
    setSelectedUser(recipient);
    setOpenUserDropdown(false);
  };

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col lg:flex-row gap-6">
        {/* Wallet Sidebar - Updated with new props */}
        <div className="w-full lg:w-64 mb-6 lg:mb-0">
          <WalletSidebar
            onTopUp={() => setShowTopUpModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
            onSendMoney={() => setShowSendMoneyModal(true)}
            onRequestPayment={() => setShowRequestPaymentModal(true)}
            recentRecipients={recentRecipients}
            onSelectRecipient={handleSelectRecentRecipient}
            onSendToRecipient={(recipient) => {
              setSelectedUser(recipient);
              setShowSendMoneyModal(true);
            }}
            userCurrency={userCurrency}
            walletBalance={walletBalance.total_balance}
            
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
                      ${walletBalance.total_balance.toFixed(2)} <span className="text-base font-semibold text-gray-500 dark:text-gray-400">USD</span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">Total Available Balance</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 dark:from-green-500/5 dark:to-green-600/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Real Balance</span>
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            Withdrawable
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${walletBalance.real_balance.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Can be withdrawn or used for any purpose
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 dark:from-blue-500/5 dark:to-blue-600/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Virtual Balance</span>
                          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            For Boosting Only
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ${walletBalance.virtual_balance.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Can only be used for post boosting or sent to other users
                        </p>
                      </div>
                    </div>
                    
                    {userCurrency !== 'USD' && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                        ≈ {rates ? convertFromUSD(walletBalance.total_balance, userCurrency, rates).toLocaleString() : '...'} {userCurrency}
                        {ratesLoading ? <span className="ml-2 text-xs text-gray-400">(rates...)</span> : updatedAt ? <span className="ml-2 text-xs text-gray-400">(updated {(new Date(updatedAt)).toLocaleTimeString()})</span> : null}
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
                  <Tabs defaultValue="all" className="mb-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="real">Real Balance</TabsTrigger>
                      <TabsTrigger value="virtual">Virtual Balance</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="mt-4">
                      <TransactionList 
                        transactions={allTransactions.filter(t => !t.is_promo_transfer || t.balance_type === 'virtual')}
                        formatTransactionType={formatTransactionType}
                        formatDate={formatDate}
                        getTransactionIcon={getTransactionIcon}
                      />
                    </TabsContent>
                    <TabsContent value="real" className="mt-4">
                      <TransactionList 
                        transactions={transactions.filter(t => t.balance_type === 'real')}
                        formatTransactionType={formatTransactionType}
                        formatDate={formatDate}
                        getTransactionIcon={getTransactionIcon}
                      />
                    </TabsContent>
                    <TabsContent value="virtual" className="mt-4">
                      <TransactionList 
                        transactions={allTransactions.filter(t => t.balance_type === 'virtual')}
                        formatTransactionType={formatTransactionType}
                        formatDate={formatDate}
                        getTransactionIcon={getTransactionIcon}
                      />
                    </TabsContent>
                  </Tabs>
                  
                  {allTransactions.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found.</p>
                      <p className="text-sm">Your transaction history will appear here.</p>
                    </div>
                  ) : null}
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
            convertToUSD={convertToUSDForModals}
            convertFromUSD={convertFromUSDForModals}
          />
          
          {/* Top Up Modal */}
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
                      {getUSDEquivalent(topUpAmount)} will be added to your <span className="font-semibold text-green-600">Real Balance</span>
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
          
          {/* Withdraw Modal - Only from Real Balance */}
          <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Withdraw Funds</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Amount to Withdraw (from Real Balance)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={walletBalance.real_balance}
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      className="w-full"
                    />
                    <span className="font-semibold">USD</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Available Real Balance: <span className="font-semibold text-green-600">${walletBalance.real_balance.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Note: Virtual balance cannot be withdrawn. It can only be used for post boosting or sent to other users.
                  </p>
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
                    Number(withdrawAmount) > walletBalance.real_balance ||
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
          
          {/* Send Money Modal - Can send from both balances */}
          <Dialog open={showSendMoneyModal} onOpenChange={setShowSendMoneyModal}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send Money</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Select Balance Type
                  </label>
                  <RadioGroup 
                    value={sendMoneyBalanceType} 
                    onValueChange={(value) => setSendMoneyBalanceType(value as 'real' | 'virtual')} 
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="real" id="send-real" />
                      <label htmlFor="send-real" className={`font-medium ${getBalanceColor('real')}`}>
                        Real Balance: ${walletBalance.real_balance.toFixed(2)}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="virtual" id="send-virtual" />
                      <label htmlFor="send-virtual" className={`font-medium ${getBalanceColor('virtual')}`}>
                        Virtual Balance: ${walletBalance.virtual_balance.toFixed(2)}
                      </label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Amount to Send
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0.01"
                      max={sendMoneyBalanceType === 'real' ? walletBalance.real_balance : walletBalance.virtual_balance}
                      step="0.01"
                      placeholder="Enter amount"
                      value={sendMoneyAmount}
                      onChange={e => setSendMoneyAmount(e.target.value)}
                      className="w-full"
                    />
                    <span className="font-semibold">USD</span>
                  </div>
                  {sendMoneyAmount && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Sending from <span className={`font-semibold ${getBalanceColor(sendMoneyBalanceType)}`}>
                        {sendMoneyBalanceType === 'real' ? 'Real' : 'Virtual'} Balance
                      </span>
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Recipient
                  </label>
                  <Popover open={openUserDropdown} onOpenChange={setOpenUserDropdown}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openUserDropdown}
                        className="w-full justify-between"
                        onClick={() => {
                          if (!openUserDropdown) {
                            fetchUsers('');
                          }
                        }}
                      >
                        {selectedUser ? (
                          <div className="flex items-center gap-2">
                            <ChevronsUpDown className="h-4 w-4" />
                            <span>{selectedUser.full_name || selectedUser.username || selectedUser.email}</span>
                          </div>
                        ) : (
                          "Search or select user..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search by name, username, or email..." 
                          value={searchQuery}
                          onValueChange={handleSearchUsers}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingUsers ? "Searching..." : "No users found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {users.map((userItem) => (
                              <CommandItem
                                key={userItem.id}
                                value={userItem.id}
                                onSelect={() => {
                                  setSelectedUser(userItem);
                                  setOpenUserDropdown(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedUser?.id === userItem.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{userItem.full_name || userItem.username || userItem.email}</span>
                                  {userItem.full_name && userItem.username && (
                                    <span className="text-xs text-gray-500">@{userItem.username}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Note (Optional)
                  </label>
                  <Input
                    placeholder="Add a note for the recipient"
                    value={sendMoneyNote}
                    onChange={e => setSendMoneyNote(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                {sendMoneyBalanceType === 'virtual' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 Virtual Balance can only be used for post boosting. When you send virtual balance to another user, 
                      they will also only be able to use it for boosting posts.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSendMoney}
                  disabled={!sendMoneyAmount || !selectedUser || Number(sendMoneyAmount) <= 0}
                  className="w-full"
                >
                  Send Money
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Request Payment Modal */}
          <Dialog open={showRequestPaymentModal} onOpenChange={setShowRequestPaymentModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Select Balance Type
                  </label>
                  <RadioGroup 
                    value={sendMoneyBalanceType} 
                    onValueChange={(value) => setSendMoneyBalanceType(value as 'real' | 'virtual')} 
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="real" id="request-real" />
                      <label htmlFor="request-real" className="font-medium">Real Balance</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="virtual" id="request-virtual" />
                      <label htmlFor="request-virtual" className="font-medium">Virtual Balance</label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={requestAmount}
                    onChange={e => setRequestAmount(e.target.value)}
                    className="w-full"
                  />
                  <span className="font-semibold">USD</span>
                </div>
                
                <Input
                  placeholder="Enter username or email"
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

// Transaction List Component
const TransactionList = ({ transactions, formatTransactionType, formatDate, getTransactionIcon }: any) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
        <p>No transactions found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {transactions.map((transaction: any) => (
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
                {transaction.balance_type && (
                  <Badge variant={transaction.balance_type === 'real' ? 'default' : 'outline'} 
                         className={`text-xs ${transaction.balance_type === 'real' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {transaction.balance_type === 'real' ? 'Real' : 'Virtual'}
                  </Badge>
                )}
                {transaction.is_promo_transfer && (
                  <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    Promo
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {transaction.description}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(transaction.created_at)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-semibold ${
              transaction.type === 'topup' || transaction.type === 'receive' || transaction.type === 'virtual_grant'
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {transaction.type === 'topup' || transaction.type === 'receive' || transaction.type === 'virtual_grant' ? '+' : '-'}
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
      ))}
    </div>
  );
};

export default Wallet;