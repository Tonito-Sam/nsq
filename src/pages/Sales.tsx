import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayPrice } from '@/utils/pricing';
import { useNavigate } from 'react-router-dom';

const Sales = () => {
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['salesPageProducts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // filter to only items currently on sale according to pricing util
  const saleItems = (products || []).filter((p: any) => getDisplayPrice(p).isOnSale);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32 lg:pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sales</h1>
            <p className="text-gray-600 dark:text-gray-400">Products currently on sale and discounted items</p>
          </div>
          <div>
            <Button onClick={() => navigate('/square')}>Back to Square</Button>
          </div>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : saleItems.length === 0 ? (
          <Card className="p-8 text-center">No sale items found</Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {saleItems.map((p: any) => {
              const price = getDisplayPrice(p);
              return (
                <Card key={p.id} className="overflow-hidden cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package /></div>}
                  </div>
                  <div className="p-4">
                    <div className="font-semibold line-clamp-2">{p.title}</div>
                    <div className="text-sm text-purple-600 font-bold mt-2">ZAR {price.displayPrice.toLocaleString()}</div>
                    {price.isOnSale && (
                      <div className="text-xs text-gray-500 line-through mt-1">ZAR {price.originalPrice.toLocaleString()}</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
