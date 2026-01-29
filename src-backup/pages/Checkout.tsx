import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { CreditCard, ShoppingCart, Truck, AlertCircle, Loader2, Store, ArrowLeft, Package, Shield, CheckCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getShippingSettingsForStore, calculateShippingCost, Address, Parcel } from '@/utils/shippingCost';
import { getDisplayPrice } from '@/utils/pricing';
import { countries } from '@/utils/countries';
import { statesByCountry } from '@/utils/statesByCountry';
import { citiesByState } from '@/utils/citiesByState';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import formatCurrency from '@/utils/formatCurrency';
import { getAvailableGateways, PaymentGateway, initializePayment } from '@/services/payment';
import { selectDefaultShippingPartner } from '@/utils/shippingPartners';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    user_id: string;
    store_id: string;
    product_type?: string | null;
    is_on_sale?: boolean | null;
    sale_price?: number | null;
    sale_starts?: string | null;
    sale_ends?: string | null;
    discount_price?: number | null;
    images?: string[];
  };
}

interface StoreShippingInfo {
  cost: number | null;
  loading: boolean;
  error?: string;
  partner?: any;
}

// Payment gateway logos and information
const paymentGatewayInfo = {
  paystack: {
    name: 'Paystack',
    logo: '/uploads/paystack.png',
    description: 'Secure online payments',
    color: 'from-green-500 to-green-600'
  },
  flutterwave: {
    name: 'Flutterwave',
    logo: '/uploads/flutterwave.png',
    description: 'Payments for Africa',
    color: 'from-orange-500 to-orange-600'
  },
  mpesa: {
    name: 'M-Pesa',
    logo: '/uploads/mpe.png',
    description: 'Mobile money payment',
    color: 'from-green-600 to-green-700'
  },
  applepay: {
    name: 'Apple Pay',
    logo: '/uploads/aPay.png',
    description: 'Fast and secure payment',
    color: 'from-black to-gray-800'
  },
  googlepay: {
    name: 'Google Pay',
    logo: '/uploads/gpay.png',
    description: 'Quick and easy payment',
    color: 'from-blue-500 to-blue-600'
  }
};

const Checkout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [storeShipping, setStoreShipping] = useState<Record<string, StoreShippingInfo>>({});
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    email: '',
    address: '',
    address2: '',
    country: 'ZA',
    state: '',
    city: '',
    postalCode: '',
  });
  const [userCurrency, setUserCurrency] = useState<string>('ZAR');
  const storeCurrency = 'ZAR';
  const { exchangeRate, isLoading: isLoadingRate, error: rateError } = useExchangeRate(
    userCurrency,
    storeCurrency,
    {
      cacheDuration: 5 * 60 * 1000,
      maxRetries: 3,
      retryDelay: 1000
    }
  );
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);
  const [cartItemsCount, setCartItemsCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCartItems();
      fetchCartCount();
    }
  }, [user]);

  const fetchCartCount = async () => {
    if (!user) return;
    
    try {
      const { count } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setCartItemsCount(typeof count === 'number' ? count : (count || 0));
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  useEffect(() => {
    const fetchUserCurrency = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: userData, error: _error } = await supabase
            .from('users')
            .select('currency')
            .eq('id', user.id)
            .single();
          
          if (userData?.currency) {
            setUserCurrency(userData.currency);
          } else {
            setUserCurrency('ZAR');
          }
        }
      } catch (error) {
        console.error('Error fetching user currency:', error);
        setUserCurrency('ZAR');
      }
    };

    fetchUserCurrency();
  }, []);

  const fetchCartItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product:store_products!inner(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const items = (data || []) as any[];
      const normalized: CartItem[] = items.map((it) => ({
        id: it.id,
        quantity: it.quantity,
        product: it.product as CartItem['product']
      }));
      setCartItems(normalized);

      const storeIdsForShipping = Array.from(new Set(
        normalized
          .filter(i => {
            const pt = (i.product.product_type || '').toString().toLowerCase();
            return !(pt.includes('digital') || pt.includes('download'));
          })
          .map(i => i.product.store_id)
          .filter(Boolean)
      )) as string[];
      await calculateShippingForStores(storeIdsForShipping);

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

  const calculateShippingForStores = async (storeIds: string[]) => {
    const collection: Address = {
      country: 'ZA',
      postal_code: '2196',
      city: 'Johannesburg',
      street: '123 Test St',
      province: 'Gauteng',
      suburb: 'Sandton'
    };

    const delivery: Address = {
      country: shippingInfo.country || 'ZA',
      postal_code: shippingInfo.postalCode || '8001',
      city: shippingInfo.city || 'Cape Town',
      street: shippingInfo.address || '456 Demo Ave',
      province: shippingInfo.state || 'Western Cape'
    };

    const totalWeight = cartItems.reduce((sum, item) => sum + (item.quantity * 0.5), 2.5);
    const parcel: Parcel = {
      weight: totalWeight,
      length: 30,
      width: 20,
      height: 10
    };

    for (const storeId of storeIds) {
      setStoreShipping(prev => ({
        ...prev,
        [storeId]: { cost: null, loading: true }
      }));

      try {
        const { data: storeData } = await supabase
          .from('user_stores')
          .select('id, base_currency, country')
          .eq('id', storeId)
          .single();
        const vendorCountry = storeData?.country || 'ZA';
        const buyerCountry = shippingInfo.country || 'ZA';
        const defaultPartner = selectDefaultShippingPartner(vendorCountry, buyerCountry, undefined);
        const settings = await getShippingSettingsForStore(storeId);
        
        if (!settings) {
          setStoreShipping(prev => ({
            ...prev,
            [storeId]: { cost: null, loading: false, error: 'No shipping configuration' }
          }));
          continue;
        }
        
        if (defaultPartner && settings.partner_code !== defaultPartner) {
          settings.partner_code = defaultPartner;
        }
        const result = await calculateShippingCost(settings, collection, delivery, parcel);

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

  useEffect(() => {
    if (cartItems.length > 0 && shippingInfo.city && shippingInfo.country) {
      const uniqueStoreIds = Array.from(new Set(
        cartItems
          .filter(i => {
            const pt = (i.product.product_type || '').toString().toLowerCase();
            return !(pt.includes('digital') || pt.includes('download'));
          })
          .map(i => i.product.store_id)
          .filter(Boolean)
      )) as string[];
      calculateShippingForStores(uniqueStoreIds);
    }
  }, [shippingInfo.city, shippingInfo.country, shippingInfo.postalCode, shippingInfo.state]);

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => {
      try {
        const pi = getDisplayPrice(item.product as any);
        return total + (pi.displayPrice * item.quantity);
      } catch (e) {
        return total + ((item.product.price || 0) * item.quantity);
      }
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

  useEffect(() => {
    const populateUserDetails = async () => {
      if (!user) return;
      
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();
        
        if (error) return;
        
        if (userData) {
          setShippingInfo(prev => ({
            ...prev,
            fullName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            email: userData.email || ''
          }));
        }
      } catch (error) {
        console.error('Error in populateUserDetails:', error);
      }
    };

    populateUserDetails();
  }, [user]);

  useEffect(() => {
    const gateways = getAvailableGateways(
      shippingInfo.country || 'NG',
      userCurrency,
      'ZA',
      'ZAR'
    );
    
    const fallbackGateways: PaymentGateway[] = ['applepay', 'googlepay'];
    
    if (userCurrency === 'NGN') {
      const filteredGateways = gateways.filter(gateway => gateway === 'flutterwave') as PaymentGateway[];
      setAvailableGateways([...filteredGateways, ...fallbackGateways]);
    } else {
      setAvailableGateways([...gateways, ...fallbackGateways]);
    }
    
    if (!selectedGateway && gateways.length > 0) {
      setSelectedGateway(gateways[0]);
    }
  }, [userCurrency, shippingInfo.country]);

  const handlePayment = async () => {
    if (!selectedGateway) {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive"
      });
      return;
    }

    if (!shippingInfo.email || !shippingInfo.fullName) {
      toast({
        title: "Missing Information",
        description: "Please provide your email and full name",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const finalAmount = userCurrency !== 'ZAR' && exchangeRate 
        ? getTotal() * exchangeRate 
        : getTotal();

      await initializePayment(selectedGateway, {
        amount: finalAmount,
        currency: userCurrency,
        buyerCountry: shippingInfo.country || 'NG',
        buyerCurrency: userCurrency,
        sellerCountry: 'ZA',
        sellerCurrency: 'ZAR',
        email: shippingInfo.email,
        reference,
        metadata: {
          user_id: user?.id,
          cart_items: cartItems,
          shipping_info: shippingInfo,
          customer: {
            email: shippingInfo.email,
            name: shippingInfo.fullName
          }
        }
      });

      toast({
        title: "Payment Initiated",
        description: `${selectedGateway} payment would be processed here. Amount: ${formatAmount(finalAmount, userCurrency)}`,
      });

    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return formatCurrency(amount, currency);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-[#0f0f0f] dark:to-purple-900/10 transition-colors">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
            <div className="text-gray-600 dark:text-gray-400">Loading checkout...</div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-[#0f0f0f] dark:to-purple-900/10 transition-colors">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Card className="dark:bg-[#161616] p-8 text-center border-0 shadow-lg">
            <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Add some products to your cart before checking out
            </p>
            <Button 
              onClick={() => navigate('/square')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Store className="h-4 w-4 mr-2" />
              Browse Products
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-[#0f0f0f] dark:to-purple-900/10 transition-colors">
      <Header />
      
      {/* Top Navigation */}
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
                  {cartItemsCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs">
                      {cartItemsCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">Your Cart ({cartItemsCount} items)</h3>
                </div>
                
                {cartItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto">
                      {cartItems.slice(0, 3).map((item) => {
                        const priceInfo = getDisplayPrice(item.product as any);
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
                                  Qty: {item.quantity} × {formatAmount(priceInfo.displayPrice, 'ZAR')}
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
                          {formatAmount(getTotal(), 'ZAR')}
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
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Secure Checkout
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Complete your purchase with confidence. Your payment is secured with industry-standard encryption.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Order Summary */}
          <div className="xl:col-span-2 space-y-6">
            {/* Shipping Information */}
            <Card className="dark:bg-[#161616] border-0 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Information
                </h2>
              </div>
              <CardContent className="p-6">
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-gray-700 dark:text-gray-300">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={shippingInfo.fullName}
                        onChange={(e) => setShippingInfo({...shippingInfo, fullName: e.target.value})}
                        className="border-gray-300 dark:border-gray-600 focus:border-purple-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shippingInfo.email}
                        onChange={(e) => setShippingInfo({...shippingInfo, email: e.target.value})}
                        className="border-gray-300 dark:border-gray-600 focus:border-purple-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address" className="text-gray-700 dark:text-gray-300">Address Line 1 *</Label>
                      <Input
                        id="address"
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                        className="border-gray-300 dark:border-gray-600 focus:border-purple-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address2" className="text-gray-700 dark:text-gray-300">Address Line 2</Label>
                      <Input
                        id="address2"
                        value={shippingInfo.address2}
                        onChange={(e) => setShippingInfo({...shippingInfo, address2: e.target.value})}
                        placeholder="Apartment, suite, unit, etc. (optional)"
                        className="border-gray-300 dark:border-gray-600 focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-gray-700 dark:text-gray-300">Country *</Label>
                      <Select
                        value={shippingInfo.country}
                        onValueChange={(value) => {
                          setShippingInfo({
                            ...shippingInfo,
                            country: value,
                            state: '',
                            city: ''
                          });
                        }}
                      >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 focus:border-purple-500">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-gray-700 dark:text-gray-300">State/Province *</Label>
                      <Select
                        value={shippingInfo.state}
                        onValueChange={(value) => {
                          setShippingInfo({
                            ...shippingInfo,
                            state: value,
                            city: ''
                          });
                        }}
                        disabled={!shippingInfo.country}
                      >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 focus:border-purple-500">
                          <SelectValue placeholder="Select state/province" />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingInfo.country && statesByCountry[shippingInfo.country] ? (
                            statesByCountry[shippingInfo.country].map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="other" disabled>
                              {shippingInfo.country ? 'No states/provinces available' : 'Select country first'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-gray-700 dark:text-gray-300">City *</Label>
                      <Select
                        value={shippingInfo.city}
                        onValueChange={(value) => setShippingInfo({...shippingInfo, city: value})}
                        disabled={!shippingInfo.state}
                      >
                        <SelectTrigger className="border-gray-300 dark:border-gray-600 focus:border-purple-500">
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingInfo.country && shippingInfo.state && citiesByState[shippingInfo.country]?.[shippingInfo.state] ? (
                            citiesByState[shippingInfo.country][shippingInfo.state].map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="other" disabled>
                              {!shippingInfo.country ? 'Select country first' : 
                               !shippingInfo.state ? 'Select state/province first' : 
                               'No cities available'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode" className="text-gray-700 dark:text-gray-300">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={shippingInfo.postalCode}
                        onChange={(e) => setShippingInfo({...shippingInfo, postalCode: e.target.value})}
                        className="border-gray-300 dark:border-gray-600 focus:border-purple-500"
                      />
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="dark:bg-[#161616] border-0 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </h2>
              </div>
              <CardContent className="p-6">
                {availableGateways.length > 0 ? (
                  <RadioGroup
                    value={selectedGateway || ''}
                    onValueChange={(value) => setSelectedGateway(value as PaymentGateway)}
                    className="space-y-4"
                  >
                    {availableGateways.map((gateway) => {
                      const gatewayInfo = paymentGatewayInfo[gateway];
                      return (
                        <div 
                          key={gateway} 
                          className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-all cursor-pointer ${
                            selectedGateway === gateway 
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                          onClick={() => setSelectedGateway(gateway)}
                        >
                          <RadioGroupItem 
                            value={gateway} 
                            id={gateway} 
                            className="text-purple-600" 
                            checked={selectedGateway === gateway}
                          />
                          <Label htmlFor={gateway} className="flex items-center cursor-pointer flex-1">
                            <div className="flex items-center gap-4 w-full">
                              {/* Payment Gateway Logo */}
                              <div className="w-12 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded border">
                                <img 
                                  src={gatewayInfo.logo} 
                                  alt={gatewayInfo.name}
                                  className="max-h-6 max-w-10 object-contain"
                                  onError={(e) => {
                                    // Fallback to colored background if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = `
                                      <div class="w-full h-full rounded flex items-center justify-center text-white text-xs font-bold bg-gradient-to-r ${gatewayInfo.color}">
                                        ${gatewayInfo.name.split(' ')[0]}
                                      </div>
                                    `;
                                  }}
                                />
                              </div>
                              
                              <div className="flex-1">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {gatewayInfo.name}
                                </span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {gatewayInfo.description}
                                </p>
                              </div>
                              
                              {/* Popular badge for certain gateways */}
                              {(gateway === 'paystack' || gateway === 'flutterwave') && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  Popular
                                </Badge>
                              )}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Loading payment methods... If this persists, please contact support.
                    </p>
                  </div>
                )}

                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">Secure Payment</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Your payment information is encrypted and secure</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            <Card className="dark:bg-[#161616] border-0 shadow-lg sticky top-6">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Order Summary
                </h2>
              </div>
              <CardContent className="p-6">
                {/* Order Items */}
                <div className="space-y-4 mb-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.product.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-purple-600 dark:text-purple-400">
                        {formatAmount(getDisplayPrice(item.product as any).displayPrice * item.quantity, 'ZAR')}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Order Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>{formatAmount(getSubtotal(), 'ZAR')}</span>
                  </div>
                  
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Service Fee (0.5%)</span>
                    <span>{formatAmount(getServiceFee(), 'ZAR')}</span>
                  </div>

                  {/* Shipping per store */}
                  {Array.from(new Set(cartItems.map(item => item.product.store_id).filter(Boolean))).map(storeId => {
                    const shipping = storeShipping[storeId];
                    return (
                      <div key={storeId} className="flex flex-col">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Truck className="h-4 w-4" />
                            Shipping
                            {shipping?.partner && (
                              <span className="text-xs text-purple-500">({shipping.partner.name})</span>
                            )}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {shipping?.loading ? (
                              <span className="text-xs text-purple-400">Calculating...</span>
                            ) : shipping?.error ? (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                            ) : shipping?.cost ? (
                              formatAmount(shipping.cost, 'ZAR')
                            ) : (
                              'Free'
                            )}
                          </span>
                        </div>
                        {shipping?.error && (
                          <span className="text-xs text-red-500 ml-6">{shipping.error}</span>
                        )}
                      </div>
                    );
                  })}
                  
                  <Separator className="my-2" />
                  
                  <div className="flex justify-between font-bold text-lg pt-2 text-gray-900 dark:text-gray-100">
                    <span>Total</span>
                    <span>{formatAmount(getTotal(), 'ZAR')}</span>
                  </div>
                </div>

                {/* Currency Conversion */}
                {userCurrency && userCurrency !== 'ZAR' && (
                  <Card className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-0">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {isLoadingRate ? (
                          <div className="text-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-600 mx-auto" />
                            <p className="text-sm text-purple-600 dark:text-purple-300 mt-2">Loading exchange rate...</p>
                          </div>
                        ) : rateError ? (
                          <div className="text-center py-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                            <p className="text-sm text-red-500 mt-2">{rateError}</p>
                          </div>
                        ) : exchangeRate ? (
                          <>
                            <div className="flex justify-between items-center text-sm text-purple-700 dark:text-purple-300">
                              <span>Exchange Rate</span>
                              <span>1 ZAR = {exchangeRate.toFixed(4)} {userCurrency}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-purple-900 dark:text-purple-100">
                              <span>Total in {userCurrency}</span>
                              <span>{formatAmount(getTotal() * exchangeRate, userCurrency)}</span>
                            </div>
                            <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                You'll be charged in {userCurrency}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                            <p className="text-sm text-red-500 mt-2">Unable to load exchange rate</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pay Button */}
                <Button 
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 text-lg font-semibold shadow-lg"
                  onClick={handlePayment}
                  disabled={processing || !selectedGateway || Object.values(storeShipping).some(s => s.loading)}
                >
                  {processing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <>
                      Pay {!isLoadingRate && exchangeRate && userCurrency !== 'ZAR' 
                        ? formatAmount(getTotal() * exchangeRate, userCurrency)
                        : formatAmount(getTotal(), 'ZAR')}
                    </>
                  )}
                </Button>

                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    By completing your purchase, you agree to our Terms of Service
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;