import { useEffect, useState } from 'react';
import { RefreshCw, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import apiUrl from '@/lib/api';

interface StorePayoutRequest {
  id: string;
  store_id: string;
  owner_user_id: string;
  currency: string;
  amount: number;
  beneficiary: { bank_name?: string; account_number?: string; account_holder?: string; branch_code?: string };
  status: 'pending_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed';
  reference: string;
  created_at: string;
  review_note?: string | null;
}

const StorePayoutReviewsPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<StorePayoutRequest[]>([]);
  const [providerReferences, setProviderReferences] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadPayouts = async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again to manage payouts.');
      const response = await fetch(apiUrl('/api/wallet/admin/store-payouts?status=active'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not load payout requests');
      setPayouts(result.payouts || []);
    } catch (error) {
      toast({ title: 'Could not load payouts', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPayouts(); }, [user, isAdmin]);

  const decide = async (payout: StorePayoutRequest, decision: 'approved' | 'processing' | 'rejected' | 'failed') => {
    setActingOn(payout.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again to review payouts.');
      const response = await fetch(apiUrl(`/api/wallet/admin/store-payouts/${payout.id}/decision`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ decision, review_note: reviewNotes[payout.id] || '' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not update payout request');
      toast({ title: `Payout ${decision}` });
      await loadPayouts();
    } catch (error) {
      toast({ title: 'Payout review failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setActingOn(null);
    }
  };

  const markPaid = async (payout: StorePayoutRequest) => {
    const providerReference = (providerReferences[payout.id] || '').trim();
    if (!providerReference) {
      toast({ title: 'Payout reference required', description: 'Enter the bank or payout provider reference first.', variant: 'destructive' });
      return;
    }
    setActingOn(payout.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in again to manage payouts.');
      const response = await fetch(apiUrl(`/api/wallet/admin/store-payouts/${payout.id}/decision`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ decision: 'paid', provider_reference: providerReference, review_note: reviewNotes[payout.id] || '' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not mark payout as paid');
      toast({ title: 'Payout marked paid' });
      await loadPayouts();
    } catch (error) {
      toast({ title: 'Payout update failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setActingOn(null);
    }
  };

  if (adminLoading) return <p className="text-sm text-muted-foreground">Checking administrator access...</p>;
  if (!isAdmin) return <p className="text-sm text-red-600">Administrator access required.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Store Payout Reviews</h1>
          <p className="text-sm text-muted-foreground">Review beneficiaries before releasing held store funds.</p>
        </div>
        <Button variant="outline" onClick={() => void loadPayouts()} disabled={loading} aria-label="Refresh payout requests">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading payout requests...</p> : payouts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No pending store payouts.</Card>
      ) : payouts.map(payout => (
        <Card key={payout.id} className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{payout.currency} {Number(payout.amount).toLocaleString()} · Store {payout.store_id}</p>
              <p className="text-xs text-muted-foreground">Owner {payout.owner_user_id} · {new Date(payout.created_at).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Request {payout.reference}</p>
            </div>
            <Badge variant="secondary">{payout.status.replaceAll('_', ' ')}</Badge>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Bank beneficiary</p>
            <p>{payout.beneficiary.account_holder || 'Name missing'} · {payout.beneficiary.bank_name || 'Bank missing'}</p>
            <p>Account ending {String(payout.beneficiary.account_number || '').slice(-4)} · Branch {payout.beneficiary.branch_code || '—'}</p>
          </div>
          <Textarea
            value={reviewNotes[payout.id] || ''}
            onChange={event => setReviewNotes(previous => ({ ...previous, [payout.id]: event.target.value }))}
            placeholder="Review note"
            maxLength={1000}
          />
          {payout.status === 'pending_review' && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => void decide(payout, 'rejected')} disabled={actingOn === payout.id}>Reject and release hold</Button>
              <Button onClick={() => void decide(payout, 'approved')} disabled={actingOn === payout.id}>Approve for processing</Button>
            </div>
          )}
          {payout.status === 'approved' && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => void decide(payout, 'rejected')} disabled={actingOn === payout.id}>Reject and release hold</Button>
              <Button onClick={() => void decide(payout, 'processing')} disabled={actingOn === payout.id}>Mark processing</Button>
            </div>
          )}
          {payout.status === 'processing' && (
            <div className="flex flex-col sm:flex-row gap-2 border-t pt-4">
              <Input
                value={providerReferences[payout.id] || ''}
                onChange={event => setProviderReferences(previous => ({ ...previous, [payout.id]: event.target.value }))}
                placeholder="Bank payout reference after payment"
                aria-label="Bank payout reference"
              />
              <Button variant="outline" onClick={() => void decide(payout, 'failed')} disabled={actingOn === payout.id}>Mark failed and release hold</Button>
              <Button variant="secondary" onClick={() => void markPaid(payout)} disabled={actingOn === payout.id || !providerReferences[payout.id]?.trim()}>
                <WalletCards className="mr-2 h-4 w-4" />Mark paid
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default StorePayoutReviewsPage;
