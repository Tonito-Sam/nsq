import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MessageSquare, ShoppingCart, Search } from 'lucide-react';
import { Header } from '@/components/Header';
import { ChatModal } from '@/components/ChatModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/types/supabase';
import { ShoppingCart as CartIcon } from 'lucide-react';

type ProductRow = Database['public']['Tables']['store_products']['Row'];

interface Product extends ProductRow {
  store?: {
    id: string;
    store_name: string;
    verification_status: string;
  };
}

const Square = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Fetch cart count
  const fetchCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    const { count, error } = await supabase
      .from('cart_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (!error && typeof count === 'number') setCartCount(count);
  };

  const fetchProducts = async () => {
    try {
      // Get products
      const { data: productsData, error: productsError } = await supabase
        .from('store_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Type assertion to ProductRow[]
      const typedProducts = (productsData || []) as ProductRow[];

      // Get all unique store_ids from products
      const storeIds = Array.from(new Set(typedProducts.map(p => p.store_id).filter(Boolean)));
      // Fetch all stores in one query
      const { data: storesData, error: storesError } = await supabase
        .from('user_stores')
        .select('id, store_name, verification_status, is_active')
        .in('id', storeIds);
      if (storesError) throw storesError;
      const storesMap = new Map((storesData || []).map(store => [store.id, store]));

      // Attach store info, but always keep the original store_id for navigation
      const productsWithStores = typedProducts.map(product => {
        const storeData = storesMap.get(product.store_id);
        return {
          ...product,
          store: storeData
            ? {
                store_name: storeData.store_name,
                verification_status: storeData.verification_status,
                id: storeData.id,
              }
            : undefined,
        };
      });
      setProducts(productsWithStores);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to add items to your cart.',
        variant: 'destructive',
      });
      return;
    }
    setAddingToCart(product.id);
    try {
      // Check if item already exists in cart
      const { data: existing, error: checkError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single();
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      if (existing) {
        // If already in cart, increment quantity
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id);
        if (updateError) throw updateError;
        toast({
          title: 'Cart Updated',
          description: `${product.title} quantity increased in your cart.`,
        });
        fetchCartCount();
      } else {
        // If not in cart, insert new row
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
        fetchCartCount();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add to cart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 pb-32 lg:pb-8">
          <div className="text-center">Loading products...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32 lg:pb-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Square
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Discover and shop from amazing stores
            </p>
          </div>
          <button
            className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            onClick={() => navigate('/cart')}
            aria-label="View Cart"
          >
            <CartIcon className="h-7 w-7 text-purple-700" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="dark:bg-[#161616] p-8 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {searchTerm ? 'No products found' : 'No Products Available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search terms' : 'Be the first to add products to the marketplace'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="dark:bg-[#161616] overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="aspect-square bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="p-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {product.category || 'General'}
                    </Badge>
                    {product.store?.verification_status === 'verified' && (
                      <Badge className="bg-green-600 text-xs">Verified</Badge>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                    {product.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
                    by {product.store && product.store.store_name ? (
                      <span
                        className="text-purple-700 hover:underline cursor-pointer"
                        onClick={() => navigate(`/store/${product.store.id}`)}
                      >
                        {product.store.store_name}
                      </span>
                    ) : 'Unknown Store'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-purple-600">
                      ZAR {product.price.toLocaleString()}
                    </span>
                    <div className="flex space-x-2">
                      {user && user.id !== product.user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => handleAddToCart(product)}
                        disabled={addingToCart === product.id}
                      >
                        {addingToCart === product.id ? (
                          <span className="flex items-center"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></span>Adding...</span>
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ChatModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <MobileBottomNav />
    </div>
  );
};

export default Square;
