import { useEffect, useState } from 'react';
import useMeta from '@/hooks/useMeta';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ChatModal } from '@/components/ChatModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { Package, MessageSquare, ShoppingCart, ArrowLeft, X, Plus, Minus, CreditCard, Store, ZoomIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { getDisplayPrice } from '@/utils/pricing';
import { ProductReviews } from '@/components/ProductReviews';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ImageLightbox from '@/components/ImageLightbox';

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
  sale_price?: number;
  discount_price?: number;
  views?: number;
  store?: {
    store_name: string;
    verification_status: string;
    base_currency?: string;
  };
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'product' | 'cart'>('product');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // per-product meta for SEO / social previews
  useMeta({
    title: product ? `${product.title} — NexSq` : 'Product — NexSq',
    description: product ? (product.description ? (product.description.slice(0, 160)) : `${product?.title}`) : 'Product details on NexSq',
    image: product?.images?.[0],
    url: window.location.href,
  });

  useEffect(() => {
    if (product_id) fetchProduct(product_id);
    if (user) fetchCartItems();
  }, [product_id, user]);

  const fetchProduct = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        const storeId = data['store_id'] || '';
        const productData = { 
          ...data, 
          store_id: storeId,
          sale_price: (data as any).sale_price,
          discount_price: (data as any).discount_price,
          views: (data as any).views || 0 // Handle missing views column
        };
        setProduct(productData);
        
        incrementProductView(id).catch((e) => console.error('Failed to increment product view', e));
        if (storeId) fetchStore(storeId);
      } else {
        console.error('Error fetching product:', error);
      }
    } catch (error) {
      console.error('Error in fetchProduct:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartItems = async () => {
    if (!user) return;
    
    setCartLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          quantity,
          store_products (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const items: CartItem[] = (data || []).map(item => {
        const sp = (item as any).store_products;
        const prod = Array.isArray(sp) ? sp[0] : sp;
        return {
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: {
            ...((prod || {}) as Product),
            views: (prod as any)?.views || 0,
          }
        } as CartItem;
      });

      setCartItems(items);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    } finally {
      setCartLoading(false);
    }
  };

  const incrementProductView = async (id: string) => {
    try {
      const key = `viewed_product_${id}`;
      if (localStorage.getItem(key)) return;
      try {
        localStorage.setItem(key, Date.now().toString());
      } catch (err) {}

      try {
        // Try RPC first
        const { error: rpcError } = await supabase.rpc('increment_product_views', { product_id: id });
        if (rpcError) throw rpcError;
        return;
      } catch (rpcErr) {
        console.log('RPC failed, trying direct update...');
        
        // Check if views column exists by trying to select it
        const { data: columnCheck, error: columnError } = await supabase
          .from('store_products')
          .select('views')
          .eq('id', id)
          .single();
          
        if (columnError && columnError.code === '42703') {
          console.log('Views column does not exist, skipping view increment');
          return;
        }
        
        // If column exists, update it
        try {
          const currentViews = (columnCheck as any)?.views || 0;
          const { error: updErr } = await supabase
            .from('store_products')
            .update({ views: currentViews + 1 })
            .eq('id', id);
          if (updErr) throw updErr;
        } catch (fallbackErr) {
          console.error('[ProductPage] Failed to persist view (fallback):', fallbackErr);
        }
      }
    } catch (err) {
      console.error('[ProductPage] Increment view failed:', err);
    }
  };

  const fetchStore = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_stores')
        .select('id, store_name, verification_status, base_currency')
        .eq('id', storeId)
        .single();
      if (!error && data) setStore(data);
    } catch (error) {
      console.error('Error fetching store:', error);
    }
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
      const { data: existing, error: checkError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (checkError) console.warn('[ProductPage] cart check error', checkError);

      if (existing) {
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: (existing.quantity || 0) + 1 })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({ user_id: user.id, product_id: product.id, quantity: 1 });
        if (insertError) throw insertError;
      }

      await fetchCartItems();
      toast({
        title: 'Added to Cart',
        description: `${product.title} has been added to your cart.`,
      });
    } catch (error) {
      console.error('[ProductPage] add to cart error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to add to cart. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const updateCartItemQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      await removeFromCart(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;
      
      await fetchCartItems();
    } catch (error) {
      console.error('Error updating cart item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update cart item.',
        variant: 'destructive',
      });
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      await fetchCartItems();
      toast({
        title: 'Removed from Cart',
        description: 'Item has been removed from your cart.',
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove item from cart.',
        variant: 'destructive',
      });
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      const priceInfo = getDisplayPrice(item.product);
      return total + (priceInfo.displayPrice * item.quantity);
    }, 0);
  };

  const getCartItemsCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
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
          <Card className="p-8 text-center dark:bg-[#161616] max-w-md w-full mx-4">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Product Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">This product does not exist or is not active.</p>
            <Button onClick={() => navigate(-1)} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </Card>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  const priceInfo = getDisplayPrice(product);
  const discountPercentage = priceInfo.isOnSale 
    ? Math.round(((priceInfo.originalPrice - priceInfo.displayPrice) / priceInfo.originalPrice) * 100)
    : 0;

  // Image modal is handled by the reusable ImageLightbox component

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      
      {/* Top Navigation Tabs (Checkout style) */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 px-2 py-1 rounded"
          >
            <ArrowLeft className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
            <span className="text-[11px] sm:text-sm">Back</span>
          </Button>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/square')}
              className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30 px-2 py-1 rounded"
            >
              <Store className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
              <span className="text-[11px] sm:text-sm">Continue Shopping</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="relative border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30 px-2 py-1 rounded">
                  <div className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2">
                    <ShoppingCart className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
                    <span className="text-[11px] sm:text-sm">Cart</span>
                  </div>
                  {getCartItemsCount() > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs">
                      {getCartItemsCount()}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">Your Cart ({getCartItemsCount()} items)</h3>
                </div>
                
                {cartLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading cart...</div>
                ) : cartItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto">
                      {cartItems.slice(0, 3).map((item) => {
                        const itemPriceInfo = getDisplayPrice(item.product);
                        return (
                          <div key={item.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30 rounded-lg flex items-center justify-center">
                                {item.product.images?.[0] ? (
                                  <img 
                                    src={item.product.images[0]} 
                                    alt={item.product.title}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.product.title}</p>
                                <p className="text-sm text-purple-600 dark:text-purple-400">
                                  Qty: {item.quantity} × {store?.base_currency || 'ZAR'} {(itemPriceInfo.displayPrice).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {cartItems.length > 3 && (
                        <div className="p-3 text-center text-sm text-purple-600 dark:text-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                          +{cartItems.length - 3} more items
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 border-t">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                        <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                          {store?.base_currency || 'ZAR'} {getCartTotal().toLocaleString()}
                        </span>
                      </div>
                      <Button 
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={() => navigate('/checkout')}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Checkout Now
                      </Button>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'product'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('product')}
          >
            Product Details
          </button>
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'cart'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('cart')}
          >
            Cart ({getCartItemsCount()})
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-32 lg:pb-8">
        {activeTab === 'product' ? (
          <>
            {/* Product Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Product Images */}
              <Card className="p-6 dark:bg-[#161616]">
                <div className="w-full h-80 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative">
                    {product.images && product.images.length > 0 ? (
                      <>
                        <img 
                          src={product.images[0]} 
                          alt={product.title} 
                          className="w-full h-full object-cover"
                        />

                        {/* Magnifier button overlay */}
                        <button
                          aria-label="Open image"
                          onClick={() => { setModalImageIndex(0); setShowImageModal(true); }}
                          className="absolute top-3 right-3 p-2 rounded bg-black/50 hover:bg-black/60 text-white backdrop-blur-md"
                        >
                          <ZoomIn className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <Package className="h-16 w-16 text-gray-400" />
                    )}
                  </div>
                
                {product.images && product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.slice(1).map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          const newImages = [image, ...product.images.filter(img => img !== image)];
                          setProduct({ ...product, images: newImages });
                        }}
                      >
                        <img 
                          src={image} 
                          alt={`${product.title} ${index + 2}`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Product Details */}
              <Card className="p-6 dark:bg-[#161616]">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
                      {product.category || 'General'}
                    </span>
                    {store?.verification_status === 'verified' && (
                      <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full flex items-center gap-1">
                        <span>✓</span>
                        Verified Store
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
                    {product.title}
                  </h1>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-2xl font-bold text-purple-600">
                        {store?.base_currency || 'ZAR'} {priceInfo.displayPrice.toLocaleString()}
                      </span>
                      {priceInfo.isOnSale && (
                        <>
                          <span className="text-lg text-gray-500 line-through">
                            {store?.base_currency || 'ZAR'} {priceInfo.originalPrice.toLocaleString()}
                          </span>
                          <span className="px-2 py-1 bg-red-600 text-white text-sm font-semibold rounded">
                            -{discountPercentage}% OFF
                          </span>
                        </>
                      )}
                    </div>
                    {priceInfo.isOnSale && (
                      <p className="text-sm text-green-600 mt-2 font-medium">
                        You save {store?.base_currency || 'ZAR'} {(priceInfo.originalPrice - priceInfo.displayPrice).toLocaleString()}!
                      </p>
                    )}
                  </div>

                  <div className="mb-6 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                      {product.description || 'No description available.'}
                    </p>
                  </div>

                  {product.product_type && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Product Type</h3>
                      <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                        {product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1)}
                      </span>
                    </div>
                  )}

                  {store && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Sold By</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {store.store_name}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/store/${product.store_id}`)}
                        >
                          Visit Store
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button 
                      size="lg" 
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={handleAddToCart} 
                      disabled={addingToCart}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      {addingToCart ? 'Adding...' : 'Add to Cart'}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowChat(true)}
                    >
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Chat with Seller
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Product Reviews */}
            <Card className="p-6 dark:bg-[#161616]">
              <ProductReviews productId={product.id} />
            </Card>
          </>
        ) : (
          /* Cart Tab */
          <Card className="p-6 dark:bg-[#161616]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Your Shopping Cart ({getCartItemsCount()} items)
              </h2>
              <Button
                variant="outline"
                onClick={() => navigate('/square')}
                className="flex items-center gap-2"
              >
                <Store className="h-4 w-4" />
                Continue Shopping
              </Button>
            </div>

            {cartLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-600 dark:text-gray-400">Loading cart...</div>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Your cart is empty</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Add some products to get started!</p>
                <Button 
                  onClick={() => navigate('/square')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Store className="h-4 w-4 mr-2" />
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const itemPriceInfo = getDisplayPrice(item.product);
                  return (
                    <Card key={item.id} className="p-4 dark:bg-[#1a1a1a]">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                          {item.product.images?.[0] ? (
                            <img 
                              src={item.product.images[0]} 
                              alt={item.product.title}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {item.product.title}
                          </h3>
                          <p className="text-lg font-bold text-purple-600 mb-2">
                            {store?.base_currency || 'ZAR'} {itemPriceInfo.displayPrice.toLocaleString()}
                          </p>
                          {itemPriceInfo.isOnSale && (
                            <p className="text-sm text-green-600">
                              On Sale! Save {store?.base_currency || 'ZAR'} {(itemPriceInfo.originalPrice - itemPriceInfo.displayPrice).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {/* Cart Summary */}
                <Card className="p-6 dark:bg-[#1a1a1a] mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {store?.base_currency || 'ZAR'} {getCartTotal().toLocaleString()}
                    </span>
                  </div>
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-lg py-3"
                    onClick={() => navigate('/checkout')}
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Proceed to Checkout
                  </Button>
                </Card>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Chat Modal */}
      {/* Image Lightbox (reusable) */}
      <ImageLightbox
        images={product?.images || []}
        open={showImageModal}
        initialIndex={modalImageIndex}
        onClose={() => setShowImageModal(false)}
      />

      {showChat && (
        <ChatModal 
          product={product} 
          onClose={() => setShowChat(false)} 
        />
      )}
      
      <MobileBottomNav />
    </div>
  );
};

export default ProductPage;