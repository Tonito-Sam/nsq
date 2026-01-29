// Type declarations for payment gateway scripts

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => {
        openIframe: () => void;
      };
    };
    FlutterwaveCheckout: (config: FlutterwaveConfig) => void;
    ApplePaySession: any;
    google: {
      payments: {
        api: {
          PaymentsClient: new (config: GooglePayConfig) => GooglePayClient;
        };
      };
    };
  }
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata?: any;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
}

interface PaystackResponse {
  reference: string;
  status: string;
  trans: string;
  transaction: string;
  trxref: string;
}

interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options: string;
  customer: {
    email: string;
    name: string;
    phone_number: string;
  };
  customizations: {
    title: string;
    description: string;
    logo: string;
  };
  meta?: any;
  callback: (response: FlutterwaveResponse) => void;
  onClose: () => void;
}

interface FlutterwaveResponse {
  transaction_id: string;
  status: string;
  tx_ref: string;
}

interface GooglePayConfig {
  environment: 'TEST' | 'PRODUCTION';
}

interface GooglePayClient {
  loadPaymentData: (request: any) => Promise<any>;
}

export {};