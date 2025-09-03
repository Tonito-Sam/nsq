import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { ShoppingCart, Trash2, Plus, Minus, Truck, Percent, AlertCircle } from 'lucide-react';
import { shippingPartners } from '@/utils/shippingPartners';
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
  };
}

interface StoreShippingInfo {
  cost: number | null;
  loading: boolean;
  error?: string;
  partner?: any;
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
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product_id,
          store_products!inner(
            id,
            store_id,
            price,
            title,
            images,
            user_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const items = data || [];
      setCartItems(items);

      // Calculate shipping for each unique store
      const uniqueStoreIds = Array.from(new Set(items.map(item => item.store_products.store_id).filter(Boolean))) as string[];
      await calculateShippingForStores(uniqueStoreIds);

    } catch (error) {
      console.error('Error fetching cart:', error);
      toast({
        title: "Error",
        description: "Failed to load cart items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateShippingForStores = async (storeIds: string[]) => {
    for (const storeId of storeIds) {
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
    return cartItems.reduce((sum, item) => sum + (item.store_products.price * item.quantity), 0);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
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
                                    ZAR {item.store_products.price.toLocaleString()}
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
                                    ZAR {(item.store_products.price * item.quantity).toLocaleString()}
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
                {Array.from(new Set(cartItems.map(item => item.store_products.store_id))).map(storeId => {
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
                          {shipping?.loading ? (
                            <span className="text-xs text-gray-400">Calculating...</span>
                          ) : shipping?.error ? (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </span>
                          ) : shipping?.cost ? (
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
                })}
                
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
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;