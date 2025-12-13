import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import apiUrl from '@/lib/api';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const Campaigns = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ real_balance: 0, virtual_balance: 100, total_balance: 100 });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const navigate = useNavigate();

  // auth handled by AuthProvider and useAuth

  useEffect(() => {
    if (!user) return;
    fetchWallet();
    fetchCampaigns();
    let channel: any;
    try {
      channel = supabase.channel(`wallets-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => setTimeout(fetchWallet, 100))
        .subscribe();
    } catch (e) {
      console.warn('wallet realtime subscribe failed', e);
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const fetchWallet = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('real_balance, virtual_balance, total_balance')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setWallet({
          real_balance: data.real_balance || 0,
          virtual_balance: data.virtual_balance || 100,
          total_balance: data.total_balance || ((data.real_balance || 0) + (data.virtual_balance || 100))
        });
      } else if (error && error.code === 'PGRST116') {
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
          setWallet({ real_balance: 0, virtual_balance: initialVirtualBalance, total_balance: initialVirtualBalance });
        }
      }
    } catch (e) {
      console.error('fetchWallet error', e);
    }
  };

  const fetchCampaigns = async () => {
    if (!user) return;
    try {
      const resp = await fetch(apiUrl(`/api/campaigns?user_id=${encodeURIComponent(user.id)}`));
      const j = await resp.json();
      setCampaigns(j.campaigns || []);
    } catch (e) {
      console.error('fetchCampaigns', e);
    }
  };


  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this campaign and refund remaining budget (prorated)?')) return;
    try {
      const resp = await fetch(apiUrl(`/api/campaigns/${id}?refund=true`), { method: 'DELETE' });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || JSON.stringify(j));
      await fetchCampaigns();
      await fetchWallet();
      alert(`Cancelled. Refunded: $${j.refunded || 0}`);
    } catch (e) { console.error('cancel error', e); alert('Could not cancel campaign'); }
  };

  return (
    <>
      <Header />
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ad Manager</h1>
          <Button onClick={() => navigate('/campaigns/create')}>Create Campaign</Button>
        </div>

      <Card className="mb-6">
        <CardContent>
          <div className="flex gap-6 flex-wrap">
            <div>Real: <strong className="text-green-600">${wallet.real_balance.toFixed(2)}</strong></div>
            <div>Virtual: <strong className="text-blue-600">${wallet.virtual_balance.toFixed(2)}</strong></div>
            <div>Total: <strong>${wallet.total_balance.toFixed(2)}</strong></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {campaigns.length === 0 && <Card><CardContent>No campaigns yet.</CardContent></Card>}
        {campaigns.map(c => (
          <Card key={c.id} className="flex items-center justify-between">
            <div className="p-4">
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-gray-600">Budget: ${Number(c.budget_usd).toFixed(2)} • Spent: ${Number(c.spent_usd).toFixed(2)} • Status: {c.status}</div>
            </div>
            <div className="p-4">
              {c.status !== 'cancelled' && <Button variant="destructive" onClick={() => handleCancel(c.id)}>Cancel</Button>}
            </div>
          </Card>
        ))}
      </div>

      </div>
      <MobileBottomNav />
    </>
  );
};

export default Campaigns;
