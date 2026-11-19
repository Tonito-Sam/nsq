import { useCallback, useEffect, useId, useState } from 'react';
import { FileText, Loader2, Printer, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type PodcastOrder = {
  id: string;
  reference: string;
  order_number: string;
  invoice_number: string;
  podcast_name: string;
  item_description: string;
  status: 'paid' | 'refunded';
  gross_amount: number;
  platform_fee_rate: number;
  platform_fee_amount: number;
  creator_net_amount: number;
  currency: string;
  service_period_start: string;
  service_period_end: string;
  paid_at: string;
};

const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency,
}).format(Number(amount) || 0);

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function PodcastOrdersDialog() {
  const { user } = useAuth();
  const invoicePrintId = `podcast-invoice-${useId().replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<PodcastOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PodcastOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data, error: ordersError } = await supabase
        .from('podcast_subscription_orders')
        .select('id, reference, order_number, invoice_number, podcast_name, item_description, status, gross_amount, platform_fee_rate, platform_fee_amount, creator_net_amount, currency, service_period_start, service_period_end, paid_at')
        .eq('subscriber_id', user.id)
        .order('paid_at', { ascending: false })
        .limit(50);
      if (ordersError) throw ordersError;
      setOrders((data || []) as PodcastOrder[]);
    } catch (loadError) {
      console.error('Could not load Podcast orders:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your Podcast orders.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) void loadOrders();
  }, [open, loadOrders]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSelectedOrder(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2">
          <Receipt className="h-4 w-4" />
          Podcast orders &amp; invoices
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Podcast orders &amp; invoices</DialogTitle>
          <DialogDescription>
            View payment receipts and subscription periods for paid Podcast channels.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid min-h-32 place-items-center" role="status" aria-label="Loading Podcast orders">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadOrders()}>Try again</Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="font-medium">No Podcast orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Invoices appear here after a paid subscription or renewal.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {orders.map((order) => (
                <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{order.podcast_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Invoice {order.invoice_number} · {formatDate(order.paid_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(order.gross_amount, order.currency)} · {order.status}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                    View invoice
                  </Button>
                </article>
              ))}
            </div>

            {selectedOrder && (
              <>
                <section id={invoicePrintId} className="space-y-5 rounded-xl border bg-white p-6 text-slate-950">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-violet-700">NexSq Podcast</p>
                      <h2 className="mt-1 text-2xl font-bold">Payment invoice</h2>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                      {selectedOrder.status}
                    </span>
                  </header>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">Invoice number</dt>
                      <dd className="font-semibold">{selectedOrder.invoice_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Order number</dt>
                      <dd className="font-semibold">{selectedOrder.order_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Billed to</dt>
                      <dd className="font-semibold">{user?.email || 'NexSq subscriber'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Issued by</dt>
                      <dd className="font-semibold">{selectedOrder.podcast_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Paid on</dt>
                      <dd className="font-semibold">{formatDate(selectedOrder.paid_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Subscription period</dt>
                      <dd className="font-semibold">
                        {formatDate(selectedOrder.service_period_start)} - {formatDate(selectedOrder.service_period_end)}
                      </dd>
                    </div>
                  </dl>

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="flex justify-between gap-4 border-b border-slate-200 p-3 text-sm">
                      <span>{selectedOrder.item_description}</span>
                      <span className="shrink-0 font-semibold">{formatMoney(selectedOrder.gross_amount, selectedOrder.currency)}</span>
                    </div>
                    <div className="flex justify-between gap-4 p-3 text-sm font-bold">
                      <span>Total paid from NexSq wallet</span>
                      <span>{formatMoney(selectedOrder.gross_amount, selectedOrder.currency)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Payment reference: {selectedOrder.reference}. The subscription price is the total charged; no additional platform fee was charged to you.
                  </p>
                </section>
                <div className="podcast-invoice-no-print flex justify-end">
                  <Button type="button" className="gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Print / Save as PDF
                  </Button>
                </div>
                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    #${invoicePrintId}, #${invoicePrintId} * { visibility: visible !important; }
                    #${invoicePrintId} {
                      position: fixed !important;
                      inset: 0 !important;
                      width: 100% !important;
                      border: 0 !important;
                      box-shadow: none !important;
                      color: #0f172a !important;
                    }
                    .podcast-invoice-no-print { display: none !important; }
                  }
                `}</style>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
