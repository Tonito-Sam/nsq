import { useEffect, useState } from 'react';
import { getDisplayPrice } from '@/utils/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { ShoppingCart, Trash2, Plus, Minus, Truck, Percent, AlertCircle, ArrowLeft, Store, CreditCard } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';
// removed unused import
import { getShippingSettingsForStore, calculateShippingCost, Address, Parcel } from '@/utils/shippingCost';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface CartItem {
  id: string;
  quantity: number;
  product_id: string;
  store_products: {
    id: string;
    store_id: string;
    price: number;
    title: string;
    images: string[];
    user_id: string;
    is_on_sale?: boolean;
    sale_price?: number | null;
    sale_starts?: string | null;
    sale_ends?: string | null;
    discount_price?: number | null;
  };
}

interface StoreShippingInfo {
  cost: number | null;
  loading: boolean;
  error?: string;
  partner?: any;
  skippedForDigital?: boolean;
}

const Cart = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeShipping, setStoreShipping] = useState<Record<string, StoreShippingInfo>>({});

  // Default addresses (in a real app, these would come from user input or preferences)
  const defaultCollection: Address = {
    country: 'ZA',
    postal_code: '2196',
    city: 'Johannesburg',
    street: '123 Test St',
    province: 'Gauteng',
    suburb: 'Sandton'
  };

  const defaultDelivery: Address = {
    country: 'ZA',
    postal_code: '8001',
    city: 'Cape Town',
    street: '456 Demo Ave',
    province: 'Western Cape',
    suburb: 'Cape Town City Centre'
  };

  // Default parcel dimensions (could be calculated from cart items)
  const defaultParcel: Parcel = {
    weight: 2.5,
    length: 30,
    width: 20,
    height: 10
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // try a straightforward join selection — fetch all available product columns to avoid schema mismatch
      const { data, error } = await supabase
        .from('cart_items')
        .select('id, quantity, product_id, store_products(*)')
        .eq('user_id', user.id);

      // Log response for debugging when running in dev
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Cart] fetchCart response', { data, error });
      }

      let fetchedItems: any[] = [];
      if (error) {
        console.error('[Cart] initial cart fetch error', error);
        // Attempt fallback: fetch simple cart rows then fetch products separately
        try {
          const { data: simpleCart, error: simpleErr } = await supabase
            .from('cart_items')
            .select('id,quantity,product_id')
            .eq('user_id', user.id);
          if (simpleErr) throw simpleErr;

          const productIds = Array.from(new Set((simpleCart || []).map((c: any) => c.product_id).filter(Boolean)));
          let productsMap: Record<string, any> = {};
          if (productIds.length > 0) {
            const { data: prods, error: prodErr } = await supabase
              .from('store_products')
              .select('*')
              .in('id', productIds as unknown as string[]);
            if (prodErr) throw prodErr;
            productsMap = (prods || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
          }

          fetchedItems = (simpleCart || []).map((c: any) => ({ ...c, store_products: productsMap[c.product_id] || null }));
          setCartItems(fetchedItems as unknown as CartItem[]);
        } catch (fallbackErr) {
          console.error('[Cart] fallback fetch error', fallbackErr);
          throw error; // rethrow original to be handled by outer catch
        }
      } else {
        fetchedItems = (data || []);
        setCartItems(fetchedItems as unknown as CartItem[]);
      }

      // Calculate shipping for each unique store — handle store_products being returned as an array or object
      const uniqueStoreIds = Array.from(new Set(fetchedItems.map((item: any) => {
        const sp = (item as any).store_products;
        return Array.isArray(sp) ? sp[0]?.store_id : sp?.store_id;
      }).filter(Boolean))) as string[];
      await calculateShippingForStores(uniqueStoreIds);

    } catch (error) {
      console.error('Error fetching cart:', error);
      try {
        console.error('[Cart] fetch error details:', JSON.stringify(error));
      } catch (e) {}
      const msg = (error && (error as any).message) || 'Failed to load cart items';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive'
      });
      // ensure cartItems is empty on error
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateShippingForStores = async (storeIds: string[]) => {
    // helper: a store only needs shipping if it has at least one physical product
    // treat anything that includes 'digital' or 'download' as non-physical (consistent with Checkout.tsx)
    const isStoreHasPhysical = (storeId: string) => {
      return cartItems.some(item => {
        const sp = (item as any).store_products;
        const prod = Array.isArray(sp) ? sp[0] : sp;
        const sid = prod?.store_id;
        const pt = (prod?.product_type || '').toString().toLowerCase();
        // consider product physical unless its type explicitly indicates digital/download
        const isDigital = pt.includes('digital') || pt.includes('download');
        return sid === storeId && !isDigital;
      });
    };

    for (const storeId of storeIds) {
      // If a store has no physical products, skip shipping calculation and mark cost as 0
      if (!isStoreHasPhysical(storeId)) {
        setStoreShipping(prev => ({
          ...prev,
          [storeId]: { cost: 0, loading: false, skippedForDigital: true }
        }));
        continue;
      }

      setStoreShipping(prev => ({
        ...prev,
        [storeId]: { cost: null, loading: true }
      }));

      try {
        const settings = await getShippingSettingsForStore(storeId);
        
        if (!settings) {
          setStoreShipping(prev => ({
            ...prev,
            [storeId]: { cost: null, loading: false, error: 'No shipping configuration' }
          }));
          continue;
        }

        const result = await calculateShippingCost(
          settings,
          defaultCollection,
          defaultDelivery,
          defaultParcel
        );

        setStoreShipping(prev => ({
          ...prev,
          [storeId]: {
            cost: result.cost,
            loading: false,
            error: result.error,
            partner: result.partner
          }
        }));
      } catch (error) {
        console.error(`Error calculating shipping for store ${storeId}:`, error);
        setStoreShipping(prev => ({
          ...prev,
          [storeId]: { cost: null, loading: false, error: 'Calculation failed' }
        }));
      }
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase.from('cart_items').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Removed', description: 'Item removed from cart.' });
      fetchCart();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive"
      });
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return;
    
    try {
      const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', id);
      if (error) throw error;
      
      fetchCart();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive"
      });
    }
  };

  const getSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      const pi = getDisplayPrice(item.store_products as any);
      return sum + (pi.displayPrice * item.quantity);
    }, 0);
  };

  const getTotalShipping = () => {
    return Object.values(storeShipping).reduce((sum, shipping) => {
      return sum + (shipping.cost || 0);
    }, 0);
  };

  const getServiceFee = () => {
    const subtotal = getSubtotal();
    return Number((subtotal * 0.005).toFixed(2));
  };

  const getTotal = () => {
    return getSubtotal() + getTotalShipping() + getServiceFee();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading cart...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
  <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-0">
        {/* Top navigation: Back, Continue Shopping, Cart (responsive for mobile) */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
            >
              <ArrowLeft className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
              <span className="text-[11px] sm:text-sm">Back</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/square')}
                className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30 px-2 py-1 rounded"
              >
                <Store className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
                <span className="text-[11px] sm:text-sm">Continue Shopping</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/checkout')}
                className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30 px-2 py-1 rounded"
              >
                <CreditCard className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded" />
                <span className="text-[11px] sm:text-sm">Checkout</span>
              </Button>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShoppingCart className="h-8 w-8 text-purple-700" /> Your Cart
        </h1>
        
        {cartItems.length === 0 ? (
          <Card className="p-8 text-center dark:bg-[#161616]">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add some products to your cart to get started
            </p>
            <Button onClick={() => navigate('/square')}>
              Browse Products
            </Button>
          </Card>
        ) : (
          <>
             <Card className="mb-6 dark:bg-[#161616]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-center">Price</TableHead>
                                <TableHead className="text-center">Quantity</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cartItems.map(item => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      {item.store_products.images?.[0] ? (
                                        <img 
                                          src={item.store_products.images[0]} 
                                          alt={item.store_products.title} 
                                          className="w-16 h-16 rounded object-cover border" 
                                        />
                                      ) : (
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
                                          <ShoppingCart className="h-8 w-8 text-gray-400" />
                                        </div>
                                      )}
                                      <div>
                                        <h3 className="font-semibold">{item.store_products.title}</h3>
                                        <p className="text-sm text-gray-500">{item.store_products.title}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    ZAR {(() => {
                                      const pi = getDisplayPrice(item.store_products as any);
                                      return pi.displayPrice.toLocaleString();
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} 
                                        disabled={item.quantity <= 1}
                                        className="h-8 w-8"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <span className="px-3 py-1 font-bold min-w-[40px]">{item.quantity}</span>
                                      <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                        className="h-8 w-8"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-bold">
                                    ZAR {(() => {
                                      const pi = getDisplayPrice(item.store_products as any);
                                      return (pi.displayPrice * item.quantity).toLocaleString();
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button 
                                      size="icon" 
                                      variant="destructive" 
                                      onClick={() => handleRemove(item.id)}
                                      className="h-8 w-8"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>

            <Card className="p-6 dark:bg-[#161616] mb-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-purple-700" /> 
                    Subtotal
                  </span>
                  <span className="font-medium">ZAR {getSubtotal().toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-purple-700" /> 
                    Service Fee (0.5%)
                  </span>
                  <span className="font-medium">ZAR {getServiceFee().toLocaleString()}</span>
                </div>

                {/* Shipping per store */}
                {(() => {
                  const storeIds = Array.from(new Set(cartItems.map(item => {
                    const sp = (item as any).store_products;
                    const prod = Array.isArray(sp) ? sp[0] : sp;
                    return prod?.store_id;
                  }).filter(Boolean)));

                  return storeIds.map(storeId => {
                    const shipping = storeShipping[storeId];
                    return (
                      <div key={storeId} className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-purple-700" /> 
                            Shipping
                            {shipping?.partner && (
                              <span className="text-xs text-gray-500">({shipping.partner.name})</span>
                            )}
                          </span>
                          <span className="font-medium">
                            {shipping?.skippedForDigital ? (
                              <span className="text-xs text-gray-500">No shipping (digital products)</span>
                            ) : shipping?.loading ? (
                              <span className="text-xs text-gray-400">Calculating...</span>
                            ) : shipping?.error ? (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                            ) : (typeof shipping?.cost === 'number') ? (
                              `ZAR ${shipping.cost.toLocaleString()}`
                            ) : (
                              <span className="text-xs text-gray-400">Not configured</span>
                            )}
                          </span>
                        </div>
                        {shipping?.error && (
                          <span className="text-xs text-red-500 ml-6">{shipping.error}</span>
                        )}
                      </div>
                    );
                  });
                })()}
                
                <hr className="my-4" />
                
                <div className="flex items-center justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>ZAR {getTotal().toLocaleString()}</span>
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-3 text-lg"
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout
              </Button>
            </div>

            {/* Mobile fixed checkout button (placed above the shared MobileBottomNav) */}
            <div className="md:hidden fixed left-0 right-0 bottom-16 z-40 px-4">
         
            </div>

            <MobileBottomNav />
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;