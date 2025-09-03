import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CreateVirtualCard from '@/components/CreateVirtualCard';

interface StoreWalletProps {
  storeId?: string;
  storeCurrency: string;
  storeName?: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export const StoreWallet: React.FC<StoreWalletProps> = ({ storeId, storeCurrency, storeName }) => {
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

    // Fetch wallet data from orders/payments
    // 1. Get all completed orders for this store
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('total_amount, status, created_at, id, customer_id')
      .eq('store_id', storeId);
    if (ordersError) return setLoading(false);
    // 2. Get all payouts/withdrawals for this store
    const { data: payouts } = await supabase
      .from('store_payouts')
      .select('amount, status, created_at, id');
    // 3. Calculate balances
    const completedOrders = (orders || []).filter(o => o.status === 'completed');
    const pendingOrders = (orders || []).filter(o => o.status === 'pending');
    const totalEarnings = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const pendingBalance = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const payoutsTotal = (payouts || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = totalEarnings - payoutsTotal;
    // 4. Build transaction history
    const allowedStatuses = ['completed', 'pending', 'failed'] as const;
    const transactions = [
      ...(completedOrders.map(o => ({
        id: o.id,
        type: 'credit' as const,
        amount: Number(o.total_amount),
        description: `Payment for Order #${o.id}`,
        date: o.created_at,
        status: 'completed' as const
      })) || []),
      ...(pendingOrders.map(o => ({
        id: o.id + '-pending',
        type: 'credit' as const,
        amount: Number(o.total_amount),
        description: `Payment for Order #${o.id}`,
        date: o.created_at,
        status: 'pending' as const
      })) || []),
      ...(payouts || []).map(p => ({
        id: p.id,
        type: 'debit' as const,
        amount: Number(p.amount),
        description: 'Withdrawal',
        date: p.created_at,
        status: allowedStatuses.includes(p.status) ? p.status as typeof allowedStatuses[number] : 'pending'
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setWalletData({ balance, pendingBalance, totalEarnings, transactions });
    setLoading(false);
  };

  const handleWithdraw = async () => {
    setWithdrawLoading(true);
    // 1. Fetch store payout settings
    const { data: storeSettings } = await supabase
      .from('user_stores')
      .select('business_bank_name, business_account_number, business_account_type, business_branch_code, business_account_holder, store_paypal_email, owner_id')
      .eq('id', storeId)
      .single();
    let payoutMethod = null;
    let payoutDetails = null;
    if (storeSettings) {
      if (storeSettings.business_account_type === 'business' && storeSettings.business_bank_name && storeSettings.business_account_number) {
        payoutMethod = 'bank';
        payoutDetails = {
          bank_name: storeSettings.business_bank_name,
          account_number: storeSettings.business_account_number,
          branch_code: storeSettings.business_branch_code,
          account_holder: storeSettings.business_account_holder
        };
      } else if (storeSettings.store_paypal_email) {
        payoutMethod = 'paypal';
        payoutDetails = { paypal_email: storeSettings.store_paypal_email };
      }
    }
    // 2. If not set, fallback to user's personal bank/paypal
    if (!payoutMethod && storeSettings?.owner_id) {
      const { data: userBank } = await supabase
        .from('user_bank_accounts')
        .select('bank_name, account_number, branch_code, account_holder, account_type')
        .eq('user_id', storeSettings.owner_id)
        .eq('is_active', true)
        .single();
      const { data: user } = await supabase
        .from('users')
        .select('paypal_email')
        .eq('id', storeSettings.owner_id)
        .single();
      if (userBank && userBank.account_type === 'personal') {
        payoutMethod = 'bank';
        payoutDetails = userBank;
      } else if (user && user.paypal_email) {
        payoutMethod = 'paypal';
        payoutDetails = { paypal_email: user.paypal_email };
      }
    }
    // 3. Block if neither is set
    if (!payoutMethod) {
      alert('No payout method set. Please add a business bank account or PayPal in Store Settings or your profile.');
      setWithdrawLoading(false);
      return;
    }
    // 4. Record payout (simulate for now)
    await supabase.from('store_payouts').insert({
      store_id: storeId,
      amount: walletData.balance,
      method: payoutMethod,
      details: payoutDetails,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    alert('Withdrawal request submitted!');
    fetchWalletData();
    setWithdrawLoading(false);
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
            {storeCurrency} {walletData.balance.toLocaleString()}
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
            {storeCurrency} {walletData.pendingBalance.toLocaleString()}
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
            {storeCurrency} {walletData.totalEarnings.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">All time</p>
        </Card>
      </div>

      {/* Withdraw Button moved below the cards */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleWithdraw} disabled={withdrawLoading}>
          <Download className="h-4 w-4 mr-2" />
          {withdrawLoading ? 'Processing...' : 'Withdraw'}
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
                  {transaction.type === 'credit' ? '+' : '-'}{storeCurrency} {transaction.amount.toLocaleString()}
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
