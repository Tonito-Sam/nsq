import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CreateVirtualCard from '@/components/CreateVirtualCard';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import apiUrl from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface StoreWalletProps {
  storeId?: string;
  storeCurrency: string;
  storeName?: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

interface StoreWalletAccount {
  currency: string;
  available_balance: number;
  held_balance: number;
  total_earned: number;
}

export const StoreWallet: React.FC<StoreWalletProps> = ({ storeId, storeCurrency, storeName }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<StoreWalletAccount[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutCurrency, setPayoutCurrency] = useState(storeCurrency || 'USD');
  const [walletData, setWalletData] = useState({
    balance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
    transactions: [] as Transaction[]
  });
  const [loading, setLoading] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    if (storeId) {
      fetchWalletData();
    }
  }, [storeId]);

  const fetchWalletData = async () => {
    if (!storeId) return;
    try {
      const [{ data: accountRows, error: accountError }, { data: entries, error: entriesError }] = await Promise.all([
        supabase.from('store_wallet_accounts').select('currency,available_balance,held_balance,total_earned').eq('store_id', storeId),
        supabase.from('wallet_ledger_entries').select('id,entry_type,direction,amount,currency,reference,created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(50),
      ]);
      if (accountError) throw accountError;
      if (entriesError) throw entriesError;

      const currentAccounts = (accountRows || []) as StoreWalletAccount[];
      setAccounts(currentAccounts);
      const preferredCurrency = currentAccounts.find(account => account.currency === storeCurrency)?.currency || currentAccounts[0]?.currency;
      if (preferredCurrency && !currentAccounts.some(account => account.currency === payoutCurrency)) setPayoutCurrency(preferredCurrency);
      const account = currentAccounts.find(item => item.currency === payoutCurrency) || currentAccounts.find(item => item.currency === preferredCurrency);
      const transactions = (entries || []).map(entry => ({
        id: entry.id,
        type: (entry.direction === 'credit' || entry.direction === 'release' ? 'credit' : 'debit') as 'credit' | 'debit',
        amount: Number(entry.amount),
        currency: entry.currency,
        description: `${String(entry.entry_type).replaceAll('_', ' ')} · ${String(entry.reference).slice(0, 12)}`,
        date: entry.created_at,
        status: (entry.direction === 'hold' ? 'pending' : 'completed') as 'pending' | 'completed' | 'failed',
      }));

      setWalletData({
        balance: Number(account?.available_balance || 0),
        pendingBalance: Number(account?.held_balance || 0),
        totalEarnings: Number(account?.total_earned || 0),
        transactions,
      });
    } catch (error) {
      console.error('Error fetching store wallet ledger:', error);
      toast({ title: 'Wallet unavailable', description: 'Could not load the store ledger. Apply the wallet migration and try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(payoutAmount);
    const account = accounts.find(item => item.currency === payoutCurrency);
    if (!storeId || !user || !account || !Number.isFinite(amount) || amount <= 0 || amount > account.available_balance) {
      toast({ title: 'Invalid payout amount', description: 'Enter an amount within the available balance.', variant: 'destructive' });
      return;
    }

    setWithdrawLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again to request a payout.');
      const response = await fetch(apiUrl(`/api/wallet/stores/${storeId}/payouts`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ amount, currency: payoutCurrency }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Payout request failed');
      toast({ title: 'Payout held for review', description: 'Funds are reserved while NexSq reviews the beneficiary and payout request.' });
      setPayoutAmount('');
      await fetchWalletData();
    } catch (error) {
      toast({ title: 'Payout request failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'pending': return 'bg-yellow-600';
      case 'failed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <Card className="dark:bg-[#161616] p-8 text-center">
        <div className="text-gray-600 dark:text-gray-400">Loading wallet...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Store Wallet</h2>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Available Balance</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {payoutCurrency} {walletData.balance.toLocaleString()}
          </p>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Pending Balance</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {payoutCurrency} {walletData.pendingBalance.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">Processing 3-5 business days</p>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Total Earnings</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {payoutCurrency} {walletData.totalEarnings.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">All time</p>
        </Card>
      </div>

      {/* Withdraw Button moved below the cards */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Select value={payoutCurrency} onValueChange={setPayoutCurrency}>
          <SelectTrigger className="sm:w-40" aria-label="Payout currency">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.currency} value={account.currency}>{account.currency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0.01"
          max={accounts.find(account => account.currency === payoutCurrency)?.available_balance || 0}
          step="0.01"
          value={payoutAmount}
          onChange={event => setPayoutAmount(event.target.value)}
          placeholder="Payout amount"
          aria-label="Payout amount"
          className="sm:max-w-52"
        />
        <Button size="lg" onClick={handleWithdraw} disabled={withdrawLoading || !accounts.length || !payoutAmount}>
          <Download className="h-4 w-4 mr-2" />
          {withdrawLoading ? 'Submitting...' : 'Request Payout'}
        </Button>
      </div>

      {/* Create Virtual Card Component */}
      <CreateVirtualCard storeName={storeName} storeId={storeId} />

      {/* Transaction History */}
      <Card className="dark:bg-[#161616] p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Transactions</h3>
        
        <div className="space-y-4">
          {walletData.transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-full ${
                  transaction.type === 'credit' 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-red-100 dark:bg-red-900/20'
                }`}>
                  {transaction.type === 'credit' ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.date).toLocaleDateString()} at{' '}
                    {new Date(transaction.date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className={`font-semibold ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'credit' ? '+' : '-'}{transaction.currency} {transaction.amount.toLocaleString()}
                </p>
                <Badge className={getStatusColor(transaction.status)}>
                  {transaction.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
