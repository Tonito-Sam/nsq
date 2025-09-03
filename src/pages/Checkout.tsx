import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Smartphone, ShoppingCart, Truck, AlertCircle, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getShippingSettingsForStore, calculateShippingCost, Address, Parcel } from '@/utils/shippingCost';
import { countries } from '@/utils/countries';
import { statesByCountry } from '@/utils/statesByCountry';
import { citiesByState } from '@/utils/citiesByState';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import formatCurrency from '@/utils/formatCurrency';
import { getAvailableGateways, PaymentGateway, initializePayment } from '@/services/payment';
import { selectDefaultShippingPartner } from '@/utils/shippingPartners';

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    price: number;
    user_id: string;
    store_id: string;
  };
}

interface StoreShippingInfo {
  cost: number | null;
  loading: boolean;
  error?: string;
  partner?: any;
}

const Checkout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [storeShipping, setStoreShipping] = useState<Record<string, StoreShippingInfo>>({});
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    email: '',
    address: '',
    address2: '',
    country: 'ZA', // Default to South Africa
    state: '',
    city: '',
    postalCode: '',
  });
  const [userCurrency, setUserCurrency] = useState<string>('ZAR'); // Default to ZAR until we fetch user's currency
  const storeCurrency = 'ZAR'; // Store's base currency
  const { exchangeRate, isLoading: isLoadingRate, error: rateError } = useExchangeRate(
    userCurrency,
    storeCurrency,
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000
    }
  );
  const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);

  useEffect(() => {
    if (user) {
      fetchCartItems();
    }
  }, [user]);

  useEffect(() => {
    const fetchUserCurrency = async () => {
      try {
        console.log('Fetching user currency...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('User:', user);
        
        if (user) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('currency')
            .eq('id', user.id)
            .single();
          
          console.log('User data:', userData);
          console.log('Error:', error);
          
          if (userData?.currency) {
            console.log('Setting user currency to:', userData.currency);
            setUserCurrency(userData.currency);
          } else {
            console.log('No currency found, using default ZAR');
            setUserCurrency('ZAR');
          }
        }
      } catch (error) {
        console.error('Error fetching user currency:', error);
        setUserCurrency('ZAR'); // Fallback to ZAR on error
      }
    };

    fetchUserCurrency();
  }, []);

  useEffect(() => {
    console.log('Current userCurrency:', userCurrency);
    console.log('Current exchangeRate:', exchangeRate);
    console.log('isLoadingRate:', isLoadingRate);
    if (rateError) {
      console.error('Exchange rate error:', rateError);
    }
  }, [userCurrency, exchangeRate, isLoadingRate, rateError]);

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
            user_id,
            store_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const items = data || [];
      setCartItems(items);

      // Calculate shipping for each unique store
      const uniqueStoreIds = Array.from(new Set(items.map(item => item.product.store_id).filter(Boolean))) as string[];
      await calculateShippingForStores(uniqueStoreIds);

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
    // Default collection address (store location)
    const collection: Address = {
      country: 'ZA',
      postal_code: '2196',
      city: 'Johannesburg',
      street: '123 Test St',
      province: 'Gauteng',
      suburb: 'Sandton'
    };

    // Use shipping info as delivery address, with fallbacks
    const delivery: Address = {
      country: shippingInfo.country || 'ZA',
      postal_code: shippingInfo.postalCode || '8001',
      city: shippingInfo.city || 'Cape Town',
      street: shippingInfo.address || '456 Demo Ave',
      province: shippingInfo.state || 'Western Cape'
    };

    // Calculate total weight and dimensions from cart items
    const totalWeight = cartItems.reduce((sum, item) => sum + (item.quantity * 0.5), 2.5); // 0.5kg per item + base weight
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
        // Fetch vendor/store info to get vendor country
        const { data: storeData, error: storeError } = await supabase
          .from('user_stores')
          .select('id, base_currency, country')
          .eq('id', storeId)
          .single();
        const vendorCountry = storeData?.country || 'ZA';
        const buyerCountry = shippingInfo.country || 'ZA';
        // Use new util to select default partner
        const defaultPartner = selectDefaultShippingPartner(vendorCountry, buyerCountry, undefined);
        // Fetch settings for the selected partner
        const settings = await getShippingSettingsForStore(storeId);
        // Override partner if needed
        if (settings && defaultPartner && settings.partner_code !== defaultPartner) {
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

  // Recalculate shipping when shipping address changes
  useEffect(() => {
    if (cartItems.length > 0 && shippingInfo.city && shippingInfo.country) {
      const uniqueStoreIds = Array.from(new Set(cartItems.map(item => item.product.store_id).filter(Boolean))) as string[];
      calculateShippingForStores(uniqueStoreIds);
    }
  }, [shippingInfo.city, shippingInfo.country, shippingInfo.postalCode, shippingInfo.state]);

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
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

  const convertedTotal = useMemo(() => {
    if (!exchangeRate || !getTotal()) return null;
    return getTotal() * exchangeRate;
  }, [exchangeRate, getTotal]);

  // Add useEffect to populate shipping info with user details
  useEffect(() => {
    const populateUserDetails = async () => {
      if (!user) return;
      
      try {
        console.log('Fetching user details for:', user.id);
        const { data: userData, error } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching user details:', error);
          return;
        }
        
        if (userData) {
          console.log('Setting user details:', userData);
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

  // Update available gateways when user currency or country changes
  useEffect(() => {
    console.log('Updating available gateways...', { userCurrency, country: shippingInfo.country });
    
    // Get available gateways based on country and currency
    const gateways = getAvailableGateways(
      shippingInfo.country || 'NG',
      userCurrency,
      'ZA',
      'ZAR'
    );
    
    // Always include Apple Pay and Google Pay as fallback options
    const fallbackGateways: PaymentGateway[] = ['applepay', 'googlepay'];
    
    // For NGN payments, only show Flutterwave and fallback options
    if (userCurrency === 'NGN') {
      const filteredGateways = gateways.filter(gateway => gateway === 'flutterwave') as PaymentGateway[];
      setAvailableGateways([...filteredGateways, ...fallbackGateways]);
    } else {
      // For other currencies, show all available gateways plus fallback options
      setAvailableGateways([...gateways, ...fallbackGateways]);
    }
    
    // Set default gateway if none selected
    if (!selectedGateway && gateways.length > 0) {
      setSelectedGateway(gateways[0]);
      console.log('Selected default gateway:', gateways[0]);
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

    // Validate required fields
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

      console.log('Processing payment:', {
        gateway: selectedGateway,
        amount: finalAmount,
        currency: userCurrency,
        reference
      });

      const paymentData = await initializePayment(selectedGateway, {
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

      console.log('Payment data:', paymentData);

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

  // Format currency with proper decimal places and thousands separator
  const formatAmount = (amount: number, currency: string) => {
    return formatCurrency(amount, currency);
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
        <h1 className="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-8">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Order Summary */}
          <div>
            <Card className="dark:bg-[#161616] p-6">
              <h2 className="text-xl font-semibold text-purple-700 dark:text-purple-400 mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-purple-700 dark:text-purple-400">{item.product.title}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-300">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-purple-700 dark:text-purple-400">
                      ZAR {(item.product.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-purple-700 dark:text-purple-400">
                  <span>Subtotal</span>
                  <span>ZAR {getSubtotal().toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-purple-700 dark:text-purple-400">
                  <span>Service Fee (0.5%)</span>
                  <span>ZAR {getServiceFee().toLocaleString()}</span>
                </div>

                {/* Shipping per store */}
                {Array.from(new Set(cartItems.map(item => item.product.store_id).filter(Boolean))).map(storeId => {
                  const shipping = storeShipping[storeId];
                  return (
                    <div key={storeId} className="flex flex-col">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                          <Truck className="h-4 w-4" />
                          Shipping
                          {shipping?.partner && (
                            <span className="text-xs text-purple-500">({shipping.partner.name})</span>
                          )}
                        </span>
                        <span className="text-purple-700 dark:text-purple-400">
                          {shipping?.loading ? (
                            <span className="text-xs text-purple-400">Calculating...</span>
                          ) : shipping?.error ? (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </span>
                          ) : shipping?.cost ? (
                            `ZAR ${shipping.cost.toLocaleString()}`
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
                
                <div className="flex justify-between font-semibold text-lg pt-2 border-t text-purple-700 dark:text-purple-400">
                  <span>Total</span>
                  <span>ZAR {getTotal().toLocaleString()}</span>
                </div>
              </div>

              {/* Currency Conversion Card */}
              {userCurrency && userCurrency !== 'ZAR' && (
                <Card className="mt-4 bg-purple-50 dark:bg-purple-900/20">
                  <CardHeader>
                    <CardTitle className="text-purple-700 dark:text-purple-400">Currency Conversion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {isLoadingRate ? (
                        <div className="text-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          <p className="text-sm text-purple-600 dark:text-purple-300 mt-2">Loading exchange rate...</p>
                        </div>
                      ) : rateError ? (
                        <div className="text-center py-2">
                          <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                          <p className="text-sm text-red-500 mt-2">{rateError}</p>
                          <button 
                            onClick={() => window.location.reload()} 
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                          >
                            Retry
                          </button>
                        </div>
                      ) : exchangeRate ? (
                        <>
                          <div className="flex justify-between items-center text-purple-700 dark:text-purple-400">
                            <span className="font-medium">Exchange Rate</span>
                            <span>1 ZAR = {exchangeRate.toFixed(4)} {userCurrency}</span>
                          </div>
                          <div className="flex justify-between items-center text-purple-700 dark:text-purple-400">
                            <span className="font-medium">Total in {userCurrency}</span>
                            <span>{userCurrency} {(getTotal() * exchangeRate).toFixed(2)}</span>
                          </div>
                          <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                            <p className="text-sm text-purple-600 dark:text-purple-300">
                              Note: Your payment will be charged in {userCurrency} ({userCurrency} {(getTotal() * exchangeRate).toFixed(2)})
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-2">
                          <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                          <p className="text-sm text-red-500 mt-2">Unable to load exchange rate</p>
                          <button 
                            onClick={() => window.location.reload()} 
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </Card>
          </div>

          {/* Right Column - Shipping and Payment */}
          <div className="space-y-6">
            <Card className="dark:bg-[#161616] p-6">
              <h2 className="text-xl font-semibold text-purple-700 dark:text-purple-400 mb-4">Shipping Information</h2>
              <form onSubmit={handlePayment} className="space-y-6">
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
                    <Label htmlFor="address">Address Line 1 *</Label>
                    <Input
                      id="address"
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address2">Address Line 2</Label>
                    <Input
                      id="address2"
                      value={shippingInfo.address2}
                      onChange={(e) => setShippingInfo({...shippingInfo, address2: e.target.value})}
                      placeholder="Apartment, suite, unit, etc. (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={shippingInfo.country}
                      onValueChange={(value) => {
                        setShippingInfo({
                          ...shippingInfo,
                          country: value,
                          state: '', // Reset state when country changes
                          city: '' // Reset city when country changes
                        });
                      }}
                    >
                      <SelectTrigger>
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
                  <div>
                    <Label htmlFor="state">State/Province *</Label>
                    <Select
                      value={shippingInfo.state}
                      onValueChange={(value) => {
                        setShippingInfo({
                          ...shippingInfo,
                          state: value,
                          city: '' // Reset city when state changes
                        });
                      }}
                      disabled={!shippingInfo.country}
                    >
                      <SelectTrigger>
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
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Select
                      value={shippingInfo.city}
                      onValueChange={(value) => setShippingInfo({...shippingInfo, city: value})}
                      disabled={!shippingInfo.state}
                    >
                      <SelectTrigger>
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
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={shippingInfo.postalCode}
                      onChange={(e) => setShippingInfo({...shippingInfo, postalCode: e.target.value})}
                    />
                  </div>
                </div>
              </form>
            </Card>

            {/* Payment Method Card */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                {availableGateways.length > 0 ? (
                  <RadioGroup
                    value={selectedGateway || ''}
                    onValueChange={(value) => setSelectedGateway(value as PaymentGateway)}
                    className="space-y-4"
                  >
                    {availableGateways.map((gateway) => (
                      <div key={gateway} className="flex items-center space-x-2">
                        <RadioGroupItem value={gateway} id={gateway} />
                        <Label htmlFor={gateway} className="flex items-center cursor-pointer">
                          {gateway === 'paystack' && <CreditCard className="h-5 w-5 mr-2 text-green-600" />}
                          {gateway === 'flutterwave' && <CreditCard className="h-5 w-5 mr-2 text-orange-600" />}
                          {gateway === 'mpesa' && <Smartphone className="h-5 w-5 mr-2 text-green-600" />}
                          {gateway === 'applepay' && <CreditCard className="h-5 w-5 mr-2 text-gray-800" />}
                          {gateway === 'googlepay' && <CreditCard className="h-5 w-5 mr-2 text-blue-600" />}
                          <span className="capitalize">
                            {gateway === 'applepay' ? 'Apple Pay' : 
                             gateway === 'googlepay' ? 'Google Pay' : 
                             gateway === 'mpesa' ? 'M-Pesa' :
                             gateway.charAt(0).toUpperCase() + gateway.slice(1)}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Loading payment methods... If this persists, please contact support.
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white" 
                    size="lg"
                    onClick={handlePayment}
                    disabled={processing || !selectedGateway || Object.values(storeShipping).some(s => s.loading)}
                  >
                    {processing ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
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
