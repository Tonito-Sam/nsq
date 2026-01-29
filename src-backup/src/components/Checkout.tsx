import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Smartphone, ShoppingCart } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { shippingPartners, getDefaultShippingPartner } from '@/utils/shippingPartners';
import { getAramexRate } from '@/services/aramex';

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    user_id: string;
  };
}

const Checkout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
    country: ''
  });
  const [shippingPartner, setShippingPartner] = useState<any>(null);
  const [shippingPartnerCode, setShippingPartnerCode] = useState<string>('aramex');
  const [storeCountry, setStoreCountry] = useState<string>('ZA');
  const [shippingCost, setShippingCost] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCartItems();
    }
  }, [user]);

  useEffect(() => {
    if (cartItems.length > 0) {
      const storeId = cartItems[0].product.user_id;
      supabase
        .from('user_stores')
        .select('shipping_partner, country')
        .eq('user_id', storeId)
        .single()
        .then(({ data }) => {
          if (data && data.country) setStoreCountry(data.country);
          let buyerCountry = shippingInfo.country || '';
          let defaultPartner = 'aramex';
          // If buyer is outside ZA, force Aramex
          if (buyerCountry && data && data.country) {
            if (data.country === 'ZA' && buyerCountry !== 'ZA') {
              defaultPartner = 'aramex';
            } else if (data.country === 'ZA' && buyerCountry === 'ZA') {
              // Domestic: allow choice between Aramex and Courier Guy
              defaultPartner = data.shipping_partner === 'courierguy' ? 'courierguy' : 'aramex';
            } else {
              defaultPartner = 'aramex';
            }
          }
          setShippingPartnerCode(defaultPartner);
          const partner = shippingPartners.find(p => p.code === defaultPartner);
          setShippingPartner(partner);
          setShippingCost(getShippingCost(partner));
        });
    }
    // eslint-disable-next-line
  }, [cartItems, shippingInfo.country]);

  // Helper to get shipping cost per partner (fallback for non-Aramex)
  const getShippingCost = (partner: any) => {
    if (!partner) return 0;
    switch (partner.code) {
      case 'dhl': return 20;
      case 'fedex': return 18;
      case 'ups': return 15;
      case 'aramex': return 12; // fallback, will be replaced by live rate
      case 'courierguy': return 10;
      default: return 10;
    }
  };

  // Fetch live Aramex rate if Aramex is selected and all info is present
  useEffect(() => {
    const fetchAramexRate = async () => {
      if (
        shippingPartner &&
        shippingPartner.code === 'aramex' &&
        shippingInfo.country &&
        shippingInfo.city &&
        cartItems.length > 0
      ) {
        try {
          // Use first cart item for origin (store location)
          const storeId = cartItems[0].product.user_id;
          const { data: store } = await supabase
            .from('user_stores')
            .select('country, city')
            .eq('user_id', storeId)
            .single();
          if (!store) return;
          // Calculate total weight and pieces
          const totalWeight = cartItems.reduce((sum, item) => sum + item.quantity * 1, 0); // Assume 1kg per item (customize as needed)
          const totalPieces = cartItems.reduce((sum, item) => sum + item.quantity, 0);
          const rateReq = {
            OriginCountryCode: store.country || 'ZA',
            OriginCity: store.city || 'Johannesburg',
            DestinationCountryCode: shippingInfo.country,
            DestinationCity: shippingInfo.city,
            Weight: totalWeight,
            NumberOfPieces: totalPieces,
            PaymentType: 'P',
            ProductGroup: 'EXP',
            ProductType: 'PPX',
          };
          const rateRes = await getAramexRate(rateReq);
          if (rateRes && rateRes.RateDetails && rateRes.RateDetails.length > 0) {
            setShippingCost(rateRes.RateDetails[0].Amount);
          }
        } catch (err) {
          // fallback to default
          setShippingCost(12);
        }
      }
    };
    fetchAramexRate();
    // eslint-disable-next-line
  }, [shippingPartner, shippingInfo.country, shippingInfo.city, cartItems]);

  // Update partner/cost when user changes selection
  useEffect(() => {
    const partner = shippingPartners.find(p => p.code === shippingPartnerCode);
    setShippingPartner(partner);
    setShippingCost(getShippingCost(partner));
  }, [shippingPartnerCode]);

  const fetchCartItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product:store_products!inner(
            id,
            title,
            price,
            user_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error('Error fetching cart items:', error);
      toast({
        title: "Error",
        description: "Failed to load cart items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const handlePayment = async () => {
    if (!user || cartItems.length === 0) return;

    // Validate shipping info
    const requiredFields = ['fullName', 'email', 'address', 'city', 'country'];
    const missingFields = requiredFields.filter(field => !shippingInfo[field as keyof typeof shippingInfo]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required shipping information",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Group items by store
      const storeGroups = cartItems.reduce((groups, item) => {
        const storeId = item.product.user_id;
        if (!groups[storeId]) {
          groups[storeId] = [];
        }
        groups[storeId].push(item);
        return groups;
      }, {} as Record<string, CartItem[]>);

      // Create orders for each store
      for (const [storeId, items] of Object.entries(storeGroups)) {
        const storeTotal = items.reduce((total, item) => total + (item.product.price * item.quantity), 0) + shippingCost;

        // Get store info
        const { data: store } = await supabase
          .from('user_stores')
          .select('id')
          .eq('user_id', storeId)
          .single();

        if (!store) continue;

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            store_id: store.id,
            total_amount: storeTotal,
            currency: 'USD',
            status: 'pending',
            payment_method: paymentMethod,
            shipping_address: shippingInfo
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Create order items
        const orderItems = items.map(item => ({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price: item.product.price * item.quantity
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      // Clear cart
      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (clearCartError) throw clearCartError;

      // Simulate payment processing based on method
      if (paymentMethod === 'paystack') {
        // In a real app, you'd integrate with Paystack's API
        console.log('Processing Paystack payment...');
      } else if (paymentMethod === 'apple-pay') {
        // In a real app, you'd integrate with Apple Pay
        console.log('Processing Apple Pay payment...');
      } else if (paymentMethod === 'google-pay') {
        // In a real app, you'd integrate with Google Pay
        console.log('Processing Google Pay payment...');
      }

      toast({
        title: "Order Placed Successfully!",
        description: "Your order has been placed and is being processed"
      });

      navigate('/wallet'); // Redirect to orders page (using wallet for now)
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading checkout...</div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Card className="dark:bg-[#161616] p-8 text-center">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add some products to your cart before checking out
            </p>
            <Button onClick={() => navigate('/square')}>
              Browse Products
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shipping Information & Partner Selection */}
          <div className="space-y-6">
            <Card className="dark:bg-[#161616] p-6">
              <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={shippingInfo.fullName}
                    onChange={(e) => setShippingInfo({...shippingInfo, fullName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shippingInfo.email}
                    onChange={(e) => setShippingInfo({...shippingInfo, email: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={shippingInfo.city}
                    onChange={(e) => setShippingInfo({...shippingInfo, city: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={shippingInfo.postalCode}
                    onChange={(e) => setShippingInfo({...shippingInfo, postalCode: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={shippingInfo.country}
                    onChange={(e) => setShippingInfo({...shippingInfo, country: e.target.value})}
                    required
                  />
                </div>
              </div>
              {/* Shipping Partner Selection */}
              <div className="mt-6">
                {shippingInfo.country && storeCountry === 'ZA' && shippingInfo.country === 'ZA' ? (
                  <>
                    <Label className="mb-2 block">Shipping Partner</Label>
                    <RadioGroup value={shippingPartnerCode} onValueChange={setShippingPartnerCode} className="flex flex-wrap gap-4">
                      {shippingPartners.filter(p => ['aramex','courierguy'].includes(p.code)).map((partner) => (
                        <div key={partner.code} className="flex items-center space-x-2">
                          <RadioGroupItem value={partner.code} id={partner.code} />
                          <Label htmlFor={partner.code}>{partner.name}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </>
                ) : (
                  <div>
                    <Label className="mb-2 block">Shipping Partner</Label>
                    <div className="font-semibold">Aramex (International shipping only)</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Payment Method */}
            <Card className="dark:bg-[#161616] p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="paystack" id="paystack" />
                  <Label htmlFor="paystack" className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Paystack (Card Payment)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="apple-pay" id="apple-pay" />
                  <Label htmlFor="apple-pay" className="flex items-center">
                    <Smartphone className="h-5 w-5 mr-2" />
                    Apple Pay
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="google-pay" id="google-pay" />
                  <Label htmlFor="google-pay" className="flex items-center">
                    <Smartphone className="h-5 w-5 mr-2" />
                    Google Pay
                  </Label>
                </div>
              </RadioGroup>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="dark:bg-[#161616] p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.product.title}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">
                      USD ${(item.product.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>USD ${getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping {shippingPartner ? `(${shippingPartner.name})` : ''}</span>
                  <span>{shippingCost > 0 ? `USD $${shippingCost.toFixed(2)}` : 'Free'}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>USD ${(getTotalPrice() + shippingCost).toFixed(2)}</span>
                </div>
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                onClick={handlePayment}
                disabled={processing}
              >
                {processing ? 'Processing...' : `Pay USD $${(getTotalPrice() + shippingCost).toFixed(2)}`}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
