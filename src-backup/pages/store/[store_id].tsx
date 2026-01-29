import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { StoreSidebar } from '@/components/StoreSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Package } from 'lucide-react';
import { getDisplayPrice } from '@/utils/pricing';
import useMeta from '@/hooks/useMeta';

interface Store {
  id: string;
  store_name: string;
  store_category: string;
  description: string;
  base_currency: string;
  shipping_partner: string;
  logo_url: string;
  verification_status: string;
  is_active: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  is_active: boolean;
  created_at: string;
  store_id: string; // Added for consistency
}

const StorePage: React.FC = () => {
  const { store_id } = useParams<{ store_id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Update meta when store data becomes available
  useMeta({
    title: store ? `${store.store_name} — Store on NexSq` : 'Store — NexSq',
    description: store ? (store.description ? store.description.slice(0, 160) : `${store.store_name} on NexSq`) : 'Store on NexSq',
    image: store?.logo_url,
    url: window.location.href,
  });

  useEffect(() => {
    if (store_id) {
      fetchStore(store_id);
      fetchProducts(store_id);
    }
    // eslint-disable-next-line
  }, [store_id]);

  const fetchStore = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_stores')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    if (!error && data) setStore(data);
    setLoading(false);
  };

  const fetchProducts = async (id: string) => {
    const { data, error } = await supabase
      .from('store_products')
      .select('*')
      .eq('store_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (!error && data) {
      // Ensure each product has store_id
      setProducts(data.map((p: any) => ({ ...p, store_id: id })));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading store...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Card className="p-8 text-center dark:bg-[#161616]">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Store Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">This store does not exist or is not active.</p>
            <button className="text-purple-600 hover:underline" onClick={() => navigate('/square')}>Back to Square</button>
          </Card>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32 lg:pb-8 flex flex-col lg:flex-row gap-8">
        <div className="hidden lg:block w-80">
          <StoreSidebar />
        </div>
        <main className="flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {store.logo_url ? (
                <img src={store.logo_url} alt="Store Logo" className="w-20 h-20 rounded-lg object-cover border" />
              ) : (
                <Package className="h-16 w-16 text-gray-400" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{store.store_name}</h1>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{store.store_category}</span>
                  {store.verification_status === 'verified' && (
                    <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">Verified</span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{store.description}</p>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Products</h2>
          {products.length === 0 ? (
            <Card className="dark:bg-[#161616] p-8 text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Products Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">This store hasn't added any products yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map(product => (
                <Card
                  key={product.id}
                  className="p-4 flex flex-col cursor-pointer hover:shadow-lg transition"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">{product.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{product.description}</p>
                  <span className="text-lg font-bold text-purple-600">{store.base_currency} {(() => {
                    const pi = getDisplayPrice(product as any);
                    return pi.displayPrice.toLocaleString();
                  })()}</span>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default StorePage;
