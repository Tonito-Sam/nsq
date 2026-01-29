import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '@/components/ui/button';

const TransfersPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => { fetchTransfers(); }, []);

  const fetchTransfers = async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data, error } = await supabase.from('transfers').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to load transfers', err);
      const isMissing = err && (err.code === '42P01' || (err.message && String(err.message).includes('does not exist')));
      if (isMissing) {
        setTableMissing(true);
        setItems([]);
      }
    }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('transfers').update({ status }).eq('id', id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch (err) { console.error('Update status failed', err); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transfers</h1>
        <Button onClick={fetchTransfers}>Refresh</Button>
      </div>
      {loading ? <div>Loading...</div> : (
        tableMissing ? (
          <div className="p-6 text-sm text-muted-foreground">
            Transfers table not found in the database. No transfer records are available.
          </div>
        ) : (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">From</th>
                <th className="px-3 py-2 text-left">To</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Requested</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{i.id}</td>
                  <td className="px-3 py-2">{i.from_user_id || '-'}</td>
                  <td className="px-3 py-2">{i.to_user_id || '-'}</td>
                  <td className="px-3 py-2">{i.amount ?? i.amount_usd ?? i.amountUsd ?? '-'}</td>
                  <td className="px-3 py-2">{i.status}</td>
                  <td className="px-3 py-2">{i.created_at ? new Date(i.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={() => updateStatus(i.id, 'completed')}>Complete</button>
                    <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => updateStatus(i.id, 'rejected')}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      )}
    </div>
  );
};

export default TransfersPage;
