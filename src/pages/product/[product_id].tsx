import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ChatModal } from '@/components/ChatModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Package, MessageSquare, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { ProductReviews } from '@/components/ProductReviews';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  user_id: string;
  store_id: string;
  is_active: boolean;
  created_at: string;
  store?: {
    store_name: string;
    verification_status: string;
  };
}

const ProductPage: React.FC = () => {
  const { product_id } = useParams<{ product_id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (product_id) fetchProduct(product_id);
  }, [product_id]);

  const fetchProduct = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('store_products')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) {
      // Use bracket notation for store_id
      const storeId = data['store_id'] || '';
      setProduct({ ...data, store_id: storeId });
      if (storeId) fetchStore(storeId);
    }
    setLoading(false);
  };

  const fetchStore = async (storeId: string) => {
    const { data, error } = await supabase
      .from('user_stores')
      .select('id, store_name, verification_status')
      .eq('id', storeId)
      .single();
    if (!error && data) setStore(data);
  };

  const handleAddToCart = async () => {
    if (!user || !product) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to add items to your cart.',
        variant: 'destructive',
      });
      return;
    }
    setAddingToCart(true);
    try {
      const { error } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
        });
      if (error) throw error;
      toast({
        title: 'Added to Cart',
        description: `${product.title} has been added to your cart.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add to cart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading product...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Card className="p-8 text-center dark:bg-[#161616]">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">This product does not exist or is not active.</p>
            <button className="text-purple-600 hover:underline" onClick={() => navigate(-1)}>Back</button>
          </Card>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-32 lg:pb-8">
        <Card className="p-6 flex flex-col md:flex-row gap-8 dark:bg-[#161616]">
          <div className="flex-shrink-0 w-full md:w-1/2 flex flex-col items-center">
            <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-16 w-16 text-gray-400" />
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => navigate(`/store/${product.store_id}`)}>
                Visit Store
              </Button>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{product.title}</h1>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">{product.category}</span>
              {store?.verification_status === 'verified' && (
                <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">Verified Store</span>
              )}
            </div>
            <span className="text-lg font-bold text-purple-600">{store?.base_currency || 'ZAR'} {product.price.toLocaleString()}</span>
            <p className="text-gray-600 dark:text-gray-400 text-base mb-2">{product.description}</p>
            <div className="flex gap-2 mt-4">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700" onClick={handleAddToCart} disabled={addingToCart}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                {addingToCart ? 'Adding...' : 'Add to Cart'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setShowChat(true)}>
                <MessageSquare className="h-5 w-5 mr-2" />
                Chat with Seller
              </Button>
            </div>
          </div>
        </Card>
        <ProductReviews productId={product.id} />
      </div>
      {showChat && (
        <ChatModal product={product} onClose={() => setShowChat(false)} />
      )}
      <MobileBottomNav />
    </div>
  );
};

export default ProductPage;
