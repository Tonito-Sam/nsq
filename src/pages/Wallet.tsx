import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { WalletSidebar } from '@/components/WalletSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { initializePayment, PaymentGateway } from '@/services/payment';
import apiUrl from '@/lib/api';
import { ArrowUpRight, ArrowDownLeft, Plus, CreditCard, Gift, Rocket, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrencyByCountry } from '@/utils/currencyByCountry';

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

const PAYSTACK_TOPUP_CURRENCIES = ['ZAR', 'NGN', 'GHS', 'KES'];
const PAYSTACK_CURRENCY_COUNTRIES: Record<string, string> = {
  ZAR: 'ZA',
  NGN: 'NG',
  GHS: 'GH',
  KES: 'KE',
};

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
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpGateway, setTopUpGateway] = useState<PaymentGateway>('paystack');
  const [isPaying, setIsPaying] = useState(false);
  const [showSendMoneyModal, setShowSendMoneyModal] = useState(false);
  const [sendMoneyAmount, setSendMoneyAmount] = useState('');
  const [sendMoneyBalanceType, setSendMoneyBalanceType] = useState<'real' | 'virtual'>('real');
  const [sendMoneyNote, setSendMoneyNote] = useState('');
  const [userCurrency, setUserCurrency] = useState('USD');
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [paystackChargeCurrency, setPaystackChargeCurrency] = useState('ZAR');
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
  const { rates, loading: ratesLoading, updatedAt, refresh, isCached: _isCached } = useCurrencyRates('USD', 5 * 60 * 1000);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchWalletBalance();
      fetchTransactions();
      fetchPromoTransfers();
      fetchRecentRecipients();
    }
  }, [user]);

  const getGatewaysForCurrency = (currency: string): PaymentGateway[] => {
    const env = (import.meta as any).env || {};
    const gateways: PaymentGateway[] = [];
    if (env.VITE_PAYSTACK_PUBLIC_KEY && PAYSTACK_TOPUP_CURRENCIES.length > 0) gateways.push('paystack');
    if (env.VITE_FLUTTERWAVE_PUBLIC_KEY && ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'UGX', 'TZS'].includes(currency)) {
      gateways.push('flutterwave');
    }
    return gateways;
  };

  useEffect(() => {
    if (userCurrency) {
      const gateways = getGatewaysForCurrency(userCurrency);
      setAvailableGateways(gateways);
      if (!gateways.includes(topUpGateway) && gateways[0]) {
        setTopUpGateway(gateways[0]);
      }
    }
  }, [userCurrency, topUpGateway]);

  useEffect(() => {
    // refresh rates when userCurrency changes so conversion displays correct values
    refresh();
  }, [userCurrency, refresh]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('currency,country')
        .eq('id', user.id)
        .single();
      if (!error && data && typeof data === 'object' && data !== null && 'currency' in data) {
        const currency = String(data.currency || 'USD').toUpperCase();
        const country = 'country' in data && typeof data.country === 'string' ? data.country.trim() : null;
        const countryNames: Record<string, string> = {
          'SOUTH AFRICA': 'ZA',
          NIGERIA: 'NG',
          GHANA: 'GH',
          KENYA: 'KE',
        };
        const countryCode = country
          ? /^[A-Za-z]{2}$/.test(country)
            ? country.toUpperCase()
            : countryNames[country.toUpperCase()] || null
          : null;
        setUserCurrency(currency);
        setUserCountry(countryCode);
        const countryCurrency = getCurrencyByCountry(countryCode);
        const preferredPaystackCurrency = PAYSTACK_TOPUP_CURRENCIES.includes(countryCurrency)
          ? countryCurrency
          : PAYSTACK_TOPUP_CURRENCIES.includes(currency)
            ? currency
            : 'ZAR';
        setPaystackChargeCurrency(preferredPaystackCurrency);
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
          real_balance: data.real_balance ?? 0,
          virtual_balance: data.virtual_balance ?? 100,
          total_balance: data.total_balance ?? (data.real_balance ?? 0) + (data.virtual_balance ?? 100)
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
      if (!user || !Number.isFinite(localAmount) || localAmount <= 0) throw new Error('Enter a valid top-up amount.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to top up your wallet.');

      const intentResponse = await fetch(apiUrl('/api/wallet/topups/intent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount_local: localAmount,
          currency: userCurrency,
          gateway: topUpGateway,
          charge_currency: topUpGateway === 'paystack' ? paystackChargeCurrency : userCurrency,
        }),
      });
      const intent = await intentResponse.json().catch(() => ({}));
      if (!intentResponse.ok) throw new Error(intent.error || 'Could not create wallet top-up request');

      const expectedCurrency = topUpGateway === 'paystack' ? paystackChargeCurrency : userCurrency;
      if (String(intent.currency || '').toUpperCase() !== expectedCurrency) {
        console.error('Wallet top-up currency mismatch:', {
          expectedCurrency,
          returnedCurrency: intent.currency,
        });
        throw new Error(
          `The wallet service returned ${intent.currency || 'no currency'} instead of ${expectedCurrency}. Restart or redeploy the backend before retrying.`
        );
      }

      await initializePayment(topUpGateway, {
        amount: intent.amount_local,
        currency: intent.currency,
        accessToken: session.access_token,
        buyerCountry: userCountry || PAYSTACK_CURRENCY_COUNTRIES[intent.currency] || 'ZA',
        buyerCurrency: intent.currency,
        sellerCountry: 'US',
        sellerCurrency: 'USD',
        email: user.email || '',
        reference: intent.reference,
        metadata: {
          user_id: user.id,
          wallet_topup: true,
          wallet_topup_reference: intent.reference,
          local_amount: intent.amount_local,
          local_currency: intent.currency,
          usd_amount: intent.amount_usd,
        }
      });
    } catch (err) {
      toast({
        title: 'Payment Error',
        description: err instanceof Error ? err.message : 'Could not start wallet top-up.',
        variant: 'destructive',
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handleSendMoney = async () => {
    if (!sendMoneyAmount || !selectedUser || !user) {
      toast({ title: 'Error', description: 'Please fill all fields.' });
      return;
    }

    const localAmount = Number(sendMoneyAmount);
    if (!Number.isFinite(localAmount) || localAmount <= 0 || (userCurrency !== 'USD' && !rates)) {
      toast({ title: 'Error', description: 'Please enter a valid amount.' });
      return;
    }
    const amount = convertToUSD(localAmount, userCurrency, rates);

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
      if (sendMoneyBalanceType === 'real') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Please sign in again to transfer wallet funds.');
        const reference = `WALLET-${crypto.randomUUID()}`;
        const response = await fetch(apiUrl('/api/wallet/transfers'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ recipient_user_id: selectedUser.id, amount_usd: amount, reference }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Wallet transfer failed');

        await Promise.all([fetchWalletBalance(), fetchTransactions()]);
        const recipientName = selectedUser.full_name || selectedUser.username || selectedUser.email || 'the recipient';
        toast({ title: 'Money sent', description: `${localAmount.toLocaleString()} ${userCurrency} was transferred to ${recipientName}.` });
      } else if (sendMoneyBalanceType === 'virtual') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Please sign in again to transfer promo balance.');
        const reference = `PROMO-${crypto.randomUUID()}`;
        const response = await fetch(apiUrl('/api/wallet/promo-transfers'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            recipient_user_id: selectedUser.id,
            amount,
            reference,
            note: sendMoneyNote || 'Promo money transfer',
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Promo transfer failed');

        await Promise.all([fetchWalletBalance(), fetchPromoTransfers(), fetchRecentRecipients()]);

        toast({ 
          title: 'Promo Money Sent Successfully!', 
          description: `Sent $${amount.toFixed(2)} virtual balance to ${selectedUser.full_name || selectedUser.username || selectedUser.email}. They can only use it for post boosting.`
        });

      }

      setShowSendMoneyModal(false);
      setSendMoneyAmount('');
      setSelectedUser(null);
      setSendMoneyNote('');
      
    } catch (error) {
      console.error('Error sending money:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to send money. Please try again.', variant: 'destructive' });
    }
  };

  const getUSDEquivalent = (amount: string) => {
    if (!amount || !userCurrency) return '';
    const localAmount = Number(amount);
    if (isNaN(localAmount) || localAmount <= 0) return '';
    const usdAmount = convertToUSD(localAmount, userCurrency, rates);
    return `≈ $${usdAmount.toFixed(2)} USD`;
  };

  const getPaystackChargeEstimate = () => {
    const amount = Number(topUpAmount);
    const walletCurrencyRate = rates[userCurrency];
    const paystackCurrencyRate = rates[paystackChargeCurrency];
    if (!Number.isFinite(amount) || amount <= 0
      || !Number.isFinite(walletCurrencyRate) || walletCurrencyRate <= 0
      || !Number.isFinite(paystackCurrencyRate) || paystackCurrencyRate <= 0) return null;
    return Number(((amount / walletCurrencyRate) * paystackCurrencyRate).toFixed(2));
  };
  const paystackChargeEstimate = getPaystackChargeEstimate();

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
            onSendMoney={() => setShowSendMoneyModal(true)}
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
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Top up, send money to other users, and pay for Podcast subscriptions. Withdrawals are temporarily unavailable.
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className="flex-1 space-y-4 sm:space-y-6">
              {/* Wallet Balance */}
              <Card className="dark:bg-[#161616]">
                <CardContent className="p-4 sm:p-6 lg:p-8">
                  <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {new Intl.NumberFormat(undefined, { style: 'currency', currency: userCurrency }).format(convertFromUSD(walletBalance.total_balance, userCurrency, rates))}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">Total Available Balance in {userCurrency}</p>
                    {userCurrency !== 'USD' && (
                      <p className="text-xs text-gray-500">USD ledger equivalent: ${walletBalance.total_balance.toFixed(2)}</p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 dark:from-green-500/5 dark:to-green-600/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Real Balance</span>
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            Available
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {new Intl.NumberFormat(undefined, { style: 'currency', currency: userCurrency }).format(convertFromUSD(walletBalance.real_balance, userCurrency, rates))}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Available for person-to-person transfers and Podcast subscriptions
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
                          {new Intl.NumberFormat(undefined, { style: 'currency', currency: userCurrency }).format(convertFromUSD(walletBalance.virtual_balance, userCurrency, rates))}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Can only be used for post boosting or sent to other users
                        </p>
                      </div>
                    </div>
                    
                    {userCurrency !== 'USD' && (
                      <p className="text-xs text-gray-400 mt-3">
                        {ratesLoading ? 'Updating exchange rate...' : updatedAt ? `Exchange rate updated ${new Date(updatedAt).toLocaleTimeString()}` : 'Using latest available exchange rate'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
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
                      min="0.01"
                      step="0.01"
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
                {topUpGateway === 'paystack' && availableGateways.includes('paystack') && (
                  <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <label htmlFor="paystack-charge-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Paystack charge currency
                    </label>
                    <select
                      id="paystack-charge-currency"
                      value={paystackChargeCurrency}
                      onChange={event => setPaystackChargeCurrency(event.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      {PAYSTACK_TOPUP_CURRENCIES.map(currency => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                    {topUpAmount && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {paystackChargeEstimate !== null
                          ? `Paystack will charge approximately ${new Intl.NumberFormat(undefined, { style: 'currency', currency: paystackChargeCurrency }).format(paystackChargeEstimate)}. ${getUSDEquivalent(topUpAmount)} will be added to your USD wallet balance.`
                          : ratesLoading
                            ? 'Current exchange rates are loading; the charge estimate will appear shortly.'
                            : 'Exchange rates are unavailable; refresh rates before starting a top-up.'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Preselected from your saved country or wallet currency; ZAR is the fallback. You can change it before paying.
                    </p>
                  </div>
                )}
                {availableGateways.length === 0 ? (
                  <div className="text-red-600 text-sm">No payment gateway is configured for this wallet. Please contact support.</div>
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
                  disabled={
                    !topUpAmount
                    || isPaying
                    || availableGateways.length === 0
                    || (topUpGateway === 'paystack' && paystackChargeEstimate === null)
                  }
                  className="w-full"
                >
                  {isPaying
                    ? 'Processing...'
                    : topUpGateway === 'paystack' && paystackChargeEstimate !== null
                      ? `Pay approx. ${new Intl.NumberFormat(undefined, { style: 'currency', currency: paystackChargeCurrency }).format(paystackChargeEstimate)}`
                      : `Pay ${topUpAmount} ${userCurrency}`}
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Recipient</label>
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