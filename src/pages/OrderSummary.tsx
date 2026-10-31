import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import apiUrl from '@/lib/api';
import { Download, Home, ShoppingBag } from 'lucide-react';

interface DownloadFile {
  name: string;
  url: string;
}

interface PurchasedDownload {
  product_id: string;
  title: string;
  quantity: number;
  files: DownloadFile[];
}

export default function OrderSummary() {
  const { orderId: pathOrderId } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = pathOrderId || searchParams.get('order_id');
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<PurchasedDownload[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsError, setDownloadsError] = useState('');

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      if (!orderId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!user) {
        setLoading(false);
        return;
      }

      setNotFound(false);
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data) {
          if (active) setNotFound(true);
          return;
        }
        if (!active) return;
        setOrder(data);

        const { data: itemRows } = await supabase
          .from('order_items')
          .select('id, quantity, unit_price, total_price, store_products(title, product_type)')
          .eq('order_id', orderId);
        if (!active) return;
        setProducts((itemRows || []).map((item: any) => ({
          title: item.store_products?.title || 'Product',
          quantity: item.quantity,
          price: item.unit_price,
          currency: data.currency || 'ZAR',
        })));

        if (data.status === 'paid') {
          setDownloadsLoading(true);
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Sign in again to access your downloads.');
          const response = await fetch(apiUrl(`/api/payments/orders/${encodeURIComponent(orderId)}/downloads`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || 'Could not load your downloads.');
          if (active) setDownloads(result.downloads || []);
        }
      } catch (error: any) {
        if (active) setDownloadsError(error.message || 'Could not load your downloads.');
      } finally {
        if (active) {
          setDownloadsLoading(false);
          setLoading(false);
        }
      }
    };

    void loadOrder();
    return () => { active = false; };
  }, [orderId, user]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#18181b]">
      <Header />
      <div className="flex items-center justify-center h-full">Loading order...</div>
    </div>
  );
  if (notFound) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#18181b]">
      <Header />
      <div className="flex items-center justify-center h-full">Order not found.</div>
    </div>
  );
  if (!order) return null;

  // Parse shipping address if it's a stringified JSON
  let shipping = order.shipping_address;
  if (typeof shipping === 'string') {
    try {
      shipping = JSON.parse(shipping);
    } catch {
      // fallback to string
    }
  }

  // Estimated delivery: 3-7 days from now
  const today = new Date();
  const minDelivery = new Date(today);
  minDelivery.setDate(today.getDate() + 3);
  const maxDelivery = new Date(today);
  maxDelivery.setDate(today.getDate() + 7);
  const deliveryRange = `${minDelivery.toLocaleDateString()} - ${maxDelivery.toLocaleDateString()}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#18181b] px-4">
      <Header />
      <div className="max-w-lg mx-auto w-full bg-white dark:bg-[#23232b] rounded-xl shadow-lg p-8 mt-10 flex flex-col items-center">
        <div className="bg-green-100 rounded-full p-3 mb-4">
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-green-600 mb-2">Order Successful</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6 text-center">
          Thank you for your purchase! Your order has been placed successfully.
        </p>
        <div className="w-full mb-6">
          <table className="w-full text-sm border-separate border-spacing-y-2">
            <tbody>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Order ID:</td>
                <td className="text-gray-800 dark:text-gray-100 break-all">{order.id}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Status:</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs font-semibold
                    ${order.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Payment Method:</td>
                <td className="text-gray-800 dark:text-gray-100">{order.payment_method}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Payment Reference:</td>
                <td className="text-gray-800 dark:text-gray-100 break-all">{order.payment_reference}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Total:</td>
                <td className="text-gray-800 dark:text-gray-100">{order.total_amount} {order.currency}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300 align-top">Shipping Address:</td>
                <td className="text-gray-800 dark:text-gray-100">
                  {shipping && typeof shipping === 'object' ? (
                    <div>
                      <div>{shipping.fullName}</div>
                      <div>{shipping.address}{shipping.address2 ? `, ${shipping.address2}` : ''}</div>
                      <div>{shipping.city}, {shipping.state}, {shipping.country}</div>
                      <div>{shipping.postalCode}</div>
                      <div>{shipping.email}</div>
                    </div>
                  ) : (
                    <span>{order.shipping_address}</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Tracking Number:</td>
                <td className="text-gray-800 dark:text-gray-100">{order.tracking_number || 'Not assigned yet'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Carrier:</td>
                <td className="text-gray-800 dark:text-gray-100">{order.carrier || 'Not assigned yet'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Shipping Status:</td>
                <td className="text-gray-800 dark:text-gray-100">{order.shipping_status || 'Pending'}</td>
              </tr>
              <tr>
                <td className="font-semibold text-gray-600 dark:text-gray-300">Estimated Delivery:</td>
                <td className="text-gray-800 dark:text-gray-100">{deliveryRange}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Product Details */}
        <div className="w-full mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Products
          </h2>
          {products.length > 0 ? (
            <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="py-2 px-2 text-left font-semibold">Product</th>
                  <th className="py-2 px-2 text-left font-semibold">Qty</th>
                  <th className="py-2 px-2 text-left font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-2">{item.title}</td>
                    <td className="py-2 px-2">{item.quantity}</td>
                    <td className="py-2 px-2">{item.price} {item.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-gray-500">No product details available.</div>
          )}
        </div>
        {order.status === 'paid' && (
          <section className="w-full mb-6" aria-labelledby="digital-downloads-heading">
            <h2 id="digital-downloads-heading" className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Download className="h-5 w-5" /> Your digital downloads
            </h2>
            {downloadsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Preparing secure download links...</p>
            ) : downloadsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{downloadsError}</p>
            ) : downloads.length > 0 ? (
              <div className="space-y-3">
                {downloads.map(product => (
                  <div key={product.product_id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{product.title}</p>
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Quantity: {product.quantity}. Links expire in one hour.</p>
                    <div className="flex flex-wrap gap-2">
                      {product.files.map((file, index) => (
                        <a
                          key={`${product.product_id}-${index}`}
                          href={file.url}
                          download
                          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          <Download className="h-4 w-4" />
                          Download file {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">This order has no downloadable products.</p>
            )}
          </section>
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <a
            href="/"
            className="flex-1 text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Home className="h-5 w-5" /> Return Home
          </a>
          <a
            href="/square"
            className="flex-1 text-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-5 w-5" /> Continue Shopping
          </a>
        </div>
      </div>
    </div>
  );
}