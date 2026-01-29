import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Home, ShoppingBag } from 'lucide-react';

export default function OrderSummary() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setOrder(data);
          // Try to get product details from cart_items metadata if available
          if (data.payment_reference && data.payment_method) {
            // Try to fetch cart_items by payment_reference if you store them
            // Otherwise, try to get from metadata
            const cartItems = data.cart_items || (data.metadata && data.metadata.cart_items);
            if (cartItems && Array.isArray(cartItems)) {
              setProducts(cartItems.map(item => ({
                title: item.product?.title || 'Product',
                quantity: item.quantity,
                price: item.product?.price || 0,
                currency: data.currency || 'ZAR'
              })));
            }
          }
        }
        setLoading(false);
      });
  }, [orderId]);

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