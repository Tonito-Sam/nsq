import { supabase } from '@/integrations/supabase/client';
import apiUrl from '@/lib/api';

export type PaymentGateway = 'paystack' | 'payfast' | 'flutterwave' | 'mpesa' | 'applepay' | 'googlepay';

const PAYSTACK_COUNTRIES = [
  'ZA', 'NA', 'BW', 'SZ', 'LS', 'ZW',
  'GH', 'KE', 'CI', 'EG', 'UG', 'RW', 'TZ', 'MW', 'ZM', 'BF', 'SL', 'LR'
];

const FLUTTERWAVE_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'UGX', 'TZS'];

export const getAvailableGateways = (
  buyerCountry: string,
  buyerCurrency: string,
  _sellerCountry: string,
  _sellerCurrency: string
): PaymentGateway[] => {
  const availableGateways: PaymentGateway[] = [];
  const env = (import.meta as any).env || {};

  if (env.VITE_PAYSTACK_PUBLIC_KEY && PAYSTACK_COUNTRIES.includes(buyerCountry)) {
    availableGateways.push('paystack');
  }

  if (buyerCountry === 'ZA') {
    availableGateways.push('payfast');
  }

  if (env.VITE_FLUTTERWAVE_PUBLIC_KEY && FLUTTERWAVE_CURRENCIES.includes(buyerCurrency)) {
    availableGateways.push('flutterwave');
  }

  return availableGateways;
};

interface PaymentInitParams {
  amount: number;
  currency: string;
  buyerCountry: string;
  buyerCurrency: string;
  sellerCountry: string;
  sellerCurrency: string;
  email: string;
  reference: string;
  accessToken?: string;
  metadata?: Record<string, any>;
}

// Update order status after payment
const updateOrderStatus = async (orderId: string, status: string, paymentReference: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status,
        payment_reference: paymentReference,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error updating order status:', error);
    return { data: null, error };
  }
};

// Clear cart after successful payment
const clearCart = async (userId: string) => {
  try {
    console.log('Clearing cart for user:', userId);
    
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing cart:', error);
      return { error };
    }

    console.log('Cart cleared successfully');
    return { error: null };
  } catch (error) {
    console.error('Error clearing cart:', error);
    return { error };
  }
};

export const initializePayment = async (
  gateway: PaymentGateway,
  params: PaymentInitParams
) => {
  try {
    console.log('Initializing payment:', { gateway, amount: params.amount, currency: params.currency, reference: params.reference });
    const payment = {
      amount: params.amount,
      currency: params.currency,
      gateway,
      reference: params.reference,
      accessToken: params.accessToken,
      buyer_country: params.buyerCountry,
      buyer_currency: params.buyerCurrency,
      seller_country: params.sellerCountry,
      seller_currency: params.sellerCurrency,
      metadata: {
        email: params.email,
        ...params.metadata
      }
    };

    // Do NOT create order here. Only trigger the payment modal.
    switch (gateway) {
      case 'paystack':
        return await initiatePaystackPayment(payment);
      case 'payfast':
        return await initiatePayfastPayment(payment);
      case 'flutterwave':
        return await initiateFlutterwavePayment(payment);
      case 'mpesa':
        return await initiateMpesaPayment(payment);
      case 'applepay':
        return await initiateApplePayPayment(payment);
      case 'googlepay':
        return await initiateGooglePayPayment(payment);
      default:
        throw new Error('Unsupported payment gateway');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    throw error;
  }
};

const initiatePayfastPayment = async (payment: any) => {
  if (!payment.accessToken) throw new Error('Please sign in again before paying with PayFast');

  const params = new URLSearchParams(window.location.search);
  params.set('payfast', 'return');
  params.set('ref', payment.reference);
  const returnUrl = `${window.location.origin}/checkout?${params.toString()}`;
  const cancelParams = new URLSearchParams({ payfast: 'cancelled', ref: payment.reference });
  const cancelUrl = `${window.location.origin}/checkout?${cancelParams.toString()}`;
  const response = await fetch(apiUrl('/api/payments/payfast/init'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payment.accessToken}`,
    },
    body: JSON.stringify({
      amount: payment.amount,
      currency: payment.currency,
      email: payment.metadata.email,
      reference: payment.reference,
      metadata: payment.metadata,
      accessToken: payment.accessToken,
      returnUrl,
      cancelUrl,
      notifyUrl: new URL(apiUrl('/api/payments/payfast/itn'), window.location.origin).toString(),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not start PayFast checkout');

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = result.action;
  Object.entries(result.fields || {}).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
};

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

const isWalletTopup = (reference: string) => reference.startsWith('TOPUP-') || reference.startsWith('wallet_');

const getErrorMessage = (err: unknown): string => {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return 'Unknown error';
};

const initiatePaystackPayment = async (payment: any) => {
  const publicKey = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) throw new Error('Paystack is not configured');
  await loadScript('https://js.paystack.co/v1/inline.js');

  const config = {
    key: publicKey,
    email: payment.metadata.email,
    // Paystack requires amount as an integer in the smallest currency unit (kobo for NGN, cents for others).
    // Use Math.round to avoid floating point precision issues (e.g. 12.06 * 100 -> 1206.0000000000002).
    amount: (() => {
      const n = Number(payment.amount);
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 100);
    })(),
    currency: payment.currency,
    ref: payment.reference,
    metadata: {
      ...payment.metadata,
      expected_amount: payment.amount,
      expected_currency: payment.currency,
    },
    callback: (response: any) => {
      (async () => {
        try {
          console.log('Paystack payment successful:', response);
          const verification = await verifyPayment(response.reference, 'paystack', payment.amount, payment.currency, payment);
          if (isWalletTopup(response.reference)) {
            // WALLET TOP-UP FLOW
            if (verification.status === 'success') {
              window.location.href = `/wallet-topup-result?status=success&ref=${response.reference}`;
            } else {
              window.location.href = `/wallet-topup-result?status=failed&ref=${response.reference}`;
            }
            return;
          }
          // STORE ORDER FLOW
          if (verification.status === 'success') {
            const orderId = verification.order_ids?.[0];
            if (!orderId) {
              alert('Payment was verified, but the order could not be created. Please contact support with your payment reference.');
              window.location.href = `/order-summary?status=failed&ref=${response.reference}`;
              return;
            }
            await clearCart(payment.metadata.user_id);
            window.location.href = `/order-summary/${orderId}?status=paid`;
          } else {
            window.location.href = `/order-summary?status=failed&ref=${response.reference}`;
          }
        } catch (err) {
          console.error('Error in Paystack callback:', err);
          alert('A payment error occurred: ' + getErrorMessage(err));
          window.location.href = `/order-summary?status=failed&ref=${response.reference}`;
        }
      })();
    },
    onClose: () => {
      console.log('Paystack payment cancelled');
      window.location.href = '/checkout?status=cancelled';
    }
  };

  if ((window as any).PaystackPop) {
    // Validate amount before setup
    if (!Number.isInteger((config as any).amount) || (config as any).amount <= 0) {
      console.error('Invalid Paystack amount in config:', (config as any).amount, 'original:', payment.amount);
      throw new Error('Invalid payment amount for Paystack. Amount must be a positive integer (in kobo/cents).');
    }

    const handler = (window as any).PaystackPop.setup(config);
    handler.openIframe();
  }

  return config;
};

const initiateFlutterwavePayment = async (payment: any) => {
  const publicKey = (import.meta as any).env?.VITE_FLUTTERWAVE_PUBLIC_KEY;
  if (!publicKey) throw new Error('Flutterwave is not configured');
  await loadScript('https://checkout.flutterwave.com/v3.js');

  const config = {
    public_key: publicKey,
    tx_ref: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    payment_options: 'card,ussd,banktransfer',
    customer: {
      email: payment.metadata.email,
      name: payment.metadata.name || 'Customer',
      phone_number: payment.metadata.phone || '+234000000000'
    },
    customizations: {
      title: '1Voice Store',
      description: isWalletTopup(payment.reference) ? 'Wallet Top-up' : 'Payment for your order',
      logo: 'https://1voice.com/logo.png'
    },
    meta: payment.metadata,
    callback: (response: any) => {
      (async () => {
        try {
          console.log('Flutterwave payment successful:', response);
          const verification = await verifyPayment(response.transaction_id, 'flutterwave', payment.amount, payment.currency, payment);
          if (isWalletTopup(payment.reference)) {
            // WALLET TOP-UP FLOW
            if (verification.status === 'success') {
              window.location.href = `/wallet-topup-result?status=success&ref=${response.transaction_id}`;
            } else {
              window.location.href = `/wallet-topup-result?status=failed&ref=${response.transaction_id}`;
            }
            return;
          }
          // STORE ORDER FLOW
          if (verification.status === 'success') {
            const orderId = verification.order_ids?.[0];
            if (!orderId) {
              alert('Payment was verified, but the order could not be created. Please contact support with your payment reference.');
              window.location.href = `/order-summary?status=failed&ref=${response.transaction_id}`;
              return;
            }
            await clearCart(payment.metadata.user_id);
            window.location.href = `/order-summary/${orderId}?status=paid`;
          } else {
            window.location.href = `/order-summary?status=failed&ref=${response.transaction_id}`;
          }
        } catch (err) {
          console.error('Error in Flutterwave callback:', err);
          alert('A payment error occurred: ' + getErrorMessage(err));
          window.location.href = `/order-summary?status=failed&ref=${response.transaction_id}`;
        }
      })();
    },
    onClose: () => {
      console.log('Flutterwave payment cancelled');
      window.location.href = '/checkout?status=cancelled';
    }
  };

  if ((window as any).FlutterwaveCheckout) {
    (window as any).FlutterwaveCheckout(config);
  }

  return config;
};

const initiateMpesaPayment = async (payment: any) => {
  console.log('Initiating M-Pesa payment:', payment);
  
  alert(`M-Pesa STK Push sent to your phone for ${payment.currency} ${payment.amount}. Check your phone and enter your PIN.`);
  
  setTimeout(async () => {
    const verification = await verifyPayment(payment.reference, payment.gateway, payment.amount, payment.currency);
    
    // Update order status
    await updateOrderStatus(
      payment.metadata.order_id, 
      verification.status === 'success' ? 'paid' : 'failed',
      payment.reference
    );

    if (verification.status === 'success') {
      await clearCart(payment.metadata.user_id);
      window.location.href = `/order-summary?ref=${payment.reference}&status=success&order_id=${payment.metadata.order_id}`;
    }
  }, 3000);

  return {
    gateway: 'mpesa',
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency
  };
};

const initiateApplePayPayment = async (payment: any) => {
  console.log('Initiating Apple Pay:', payment);
  
  if ((window as any).ApplePaySession && (window as any).ApplePaySession.canMakePayments()) {
    const request = {
      countryCode: payment.buyer_country,
      currencyCode: payment.currency,
      supportedNetworks: ['visa', 'masterCard', 'amex'],
      merchantCapabilities: ['supports3DS'],
      total: {
        label: '1Voice Store',
        amount: payment.amount.toString()
      }
    };

    const session = new (window as any).ApplePaySession(3, request);

    session.onvalidatemerchant = () => {
      console.log('Validating merchant for Apple Pay');
    };

    session.onpaymentauthorized = async (event: any) => {
      console.log('Apple Pay payment authorized:', event);
      
      try {
        const verification = await verifyPayment(payment.reference, payment.gateway, payment.amount, payment.currency);
        
        // Update order status
        await updateOrderStatus(
          payment.metadata.order_id, 
          verification.status === 'success' ? 'paid' : 'failed',
          payment.reference
        );

        if (verification.status === 'success') {
          session.completePayment((window as any).ApplePaySession.STATUS_SUCCESS);
          await clearCart(payment.metadata.user_id);
          window.location.href = `/order-summary?ref=${payment.reference}&status=success&order_id=${payment.metadata.order_id}`;
        } else {
          session.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
          window.location.href = `/order-summary?ref=${payment.reference}&status=failed&order_id=${payment.metadata.order_id}`;
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        session.completePayment((window as any).ApplePaySession.STATUS_FAILURE);
        window.location.href = `/order-summary?ref=${payment.reference}&status=failed&order_id=${payment.metadata.order_id}`;
      }
    };

    session.oncancel = () => {
      console.log('Apple Pay cancelled');
      window.location.href = '/checkout?status=cancelled';
    };

    session.begin();
  } else {
    alert('Apple Pay is not available on this device/browser');
  }

  return {
    gateway: 'applepay',
    reference: payment.reference
  };
};

const initiateGooglePayPayment = async (payment: any) => {
  console.log('Initiating Google Pay:', payment);
  
  await loadScript('https://pay.google.com/gp/p/js/pay.js');

  const baseRequest = {
    apiVersion: 2,
    apiVersionMinor: 0
  };

  const allowedCardNetworks = ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA'];
  const allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

  const tokenizationSpecification = {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: 'example',
      gatewayMerchantId: 'exampleGatewayMerchantId'
    }
  };

  const baseCardPaymentMethod = {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: allowedCardAuthMethods,
      allowedCardNetworks: allowedCardNetworks
    }
  };

  const cardPaymentMethod = Object.assign(
    {},
    baseCardPaymentMethod,
    {
      tokenizationSpecification: tokenizationSpecification
    }
  );

  const paymentDataRequest = Object.assign({}, baseRequest, {
    allowedPaymentMethods: [cardPaymentMethod],
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPriceLabel: 'Total',
      totalPrice: payment.amount.toString(),
      currencyCode: payment.currency,
      countryCode: payment.buyer_country
    },
    merchantInfo: {
      merchantName: '1Voice Store',
      merchantId: '12345678901234567890'
    }
  });

  const paymentsClient = new (window as any).google.payments.api.PaymentsClient({
    environment: 'TEST'
  });

  try {
    const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
    console.log('Google Pay payment successful:', paymentData);
    
    const verification = await verifyPayment(payment.reference, payment.gateway, payment.amount, payment.currency);
    
    // Update order status
    await updateOrderStatus(
      payment.metadata.order_id, 
      verification.status === 'success' ? 'paid' : 'failed',
      payment.reference
    );

    if (verification.status === 'success') {
      await clearCart(payment.metadata.user_id);
      window.location.href = `/order-summary?ref=${payment.reference}&status=success&order_id=${payment.metadata.order_id}`;
    } else {
      window.location.href = `/order-summary?ref=${payment.reference}&status=failed&order_id=${payment.metadata.order_id}`;
    }
  } catch (err) {
    console.log('Google Pay error:', err);
    window.location.href = '/checkout?status=cancelled';
  }

  return {
    gateway: 'googlepay',
    reference: payment.reference
  };
};

export const verifyPayment = async (
  reference: string,
  gateway: PaymentGateway,
  amount: number,
  currency: string,
  payment?: any
) => {
  const response = await fetch(apiUrl('/api/payments/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference,
      gateway,
      amount,
      currency,
      metadata: payment?.metadata,
      accessToken: payment?.accessToken,
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'Payment verification failed');
  }

  return result;
};
