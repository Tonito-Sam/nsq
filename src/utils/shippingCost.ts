import { shippingPartners } from './shippingPartners';
import { supabase } from '@/integrations/supabase/client';

export interface Address {
  country: string;
  postal_code: string;
  city: string;
  street: string;
  province: string;
  suburb?: string;
}

export interface Parcel {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface ShippingSettings {
  partner_code?: string;
  cost_type?: 'flat' | 'api';
  flat_rate?: number;
  api_key?: string;
}

export interface ShippingCalculationResult {
  cost: number | null;
  error?: string;
  partner?: any;
}

export const calculateShippingCost = async (
  settings: ShippingSettings,
  collection: Address,
  delivery: Address,
  parcel: Parcel
): Promise<ShippingCalculationResult> => {
  if (!settings.partner_code) {
    return { cost: null, error: 'No shipping partner configured' };
  }

  const partner = shippingPartners.find(p => p.code === settings.partner_code);
  if (!partner) {
    return { cost: null, error: 'Invalid shipping partner' };
  }

  // If flat rate, return the flat rate
  if (settings.cost_type === 'flat' && settings.flat_rate) {
    return { cost: settings.flat_rate, partner };
  }

  // If API rate but no API key, return error
  if (settings.cost_type === 'api' && !settings.api_key) {
    return { cost: null, error: 'API key required for live rates', partner };
  }

  // Calculate live rate via API
  if (settings.cost_type === 'api' && settings.api_key) {
    return await fetchLiveShippingRate(partner, settings.api_key, collection, delivery, parcel);
  }

  return { cost: null, error: 'Invalid shipping configuration', partner };
};

const fetchLiveShippingRate = async (
  partner: any,
  apiKey: string,
  collection: Address,
  delivery: Address,
  parcel: Parcel
): Promise<ShippingCalculationResult> => {
  try {
    console.log(`Fetching live rate for ${partner.name}...`, { collection, delivery, parcel });

    if (partner.code === 'courierguy' || partner.code === 'shiplogic') {
      // Ship Logic API for The Courier Guy
      const response = await fetch('https://api.shiplogic.com/v2/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          collection: { address: collection },
          delivery: { address: delivery },
          parcels: [parcel]
        })
      });

      if (!response.ok) {
        throw new Error(`Ship Logic API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Ship Logic response:', data);

      if (Array.isArray(data) && data.length > 0 && data[0].total) {
        return { cost: Number(data[0].total), partner };
      } else if (data.rates && Array.isArray(data.rates) && data.rates.length > 0 && data.rates[0].total) {
        return { cost: Number(data.rates[0].total), partner };
      } else {
        return { cost: null, error: 'No rates found from Ship Logic', partner };
      }
    } else if (partner.code === 'fedex') {
      // FedEx sandbox API integration
      const fedexAuth = btoa('l7a5966ad47ff9496688bf25021f88acab:39aef17e89044c76b20077e71c48edaa');
      
      // Step 1: Get OAuth token
      const tokenRes = await fetch('https://apis-sandbox.fedex.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${fedexAuth}`
        },
        body: 'grant_type=client_credentials&scope=oob'
      });

      if (!tokenRes.ok) {
        throw new Error(`FedEx auth failed: ${tokenRes.status}`);
      }

      const tokenData = await tokenRes.json();
      const fedexToken = tokenData.access_token;

      // Step 2: Call FedEx rates API
      const fedexRateRes = await fetch('https://apis-sandbox.fedex.com/rate/v1/rates/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fedexToken}`
        },
        body: JSON.stringify({
          accountNumber: { value: '510087000' },
          requestedShipment: {
            shipper: {
              address: {
                countryCode: collection.country,
                postalCode: collection.postal_code,
                city: collection.city,
                stateOrProvinceCode: collection.province
              }
            },
            recipient: {
              address: {
                countryCode: delivery.country,
                postalCode: delivery.postal_code,
                city: delivery.city,
                stateOrProvinceCode: delivery.province
              }
            },
            pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
            rateRequestType: ['ACCOUNT'],
            requestedPackageLineItems: [
              {
                weight: { units: 'KG', value: parcel.weight },
                dimensions: { length: parcel.length, width: parcel.width, height: parcel.height, units: 'CM' }
              }
            ]
          }
        })
      });

      if (!fedexRateRes.ok) {
        throw new Error(`FedEx rate error: ${fedexRateRes.status}`);
      }

      const fedexRateData = await fedexRateRes.json();
      console.log('FedEx response:', fedexRateData);

      const amount = fedexRateData?.output?.rateReplyDetails?.[0]?.ratedShipmentDetails?.[0]?.totalNetCharge?.amount;
      if (amount) {
        return { cost: Number(amount), partner };
      } else {
        return { cost: null, error: 'No FedEx rates found', partner };
      }
    } else if (partner.code === 'aramex') {
      // Aramex API integration (call your backend proxy for security)
      try {
        const response = await fetch('/api/aramex/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originCountry: collection.country,
            destinationCountry: delivery.country,
            weight: parcel.weight,
          })
        });
        if (!response.ok) throw new Error('Aramex API error: ' + response.status);
        const data = await response.json();
        // Parse Aramex API response for rate (adjust as needed)
        const rate = data?.TotalAmount || data?.rate || null;
        if (rate) {
          return { cost: Number(rate), partner };
        } else {
          return { cost: null, error: 'No Aramex rates found', partner };
        }
      } catch (err: any) {
        return { cost: null, error: 'Aramex API error: ' + err.message, partner };
      }
    } else {
      // Simulate API call for other partners
      await new Promise(res => setTimeout(res, 1200));
      const simulatedRate = 25 + Math.random() * 15; // Random rate between 25-40
      return { cost: Number(simulatedRate.toFixed(2)), partner };
    }
  } catch (error: any) {
    console.error('Shipping rate calculation error:', error);
    return { cost: null, error: `Failed to calculate shipping: ${error.message}`, partner };
  }
};

// Create default shipping settings for all stores with The Courier Guy
export const initializeDefaultShippingForStore = async (storeId: string) => {
  try {
    const { error } = await supabase
      .from('store_shipping_settings')
      .upsert({
        store_id: storeId,
        partner_code: 'courierguy',
        cost_type: 'flat',
        flat_rate: 50,  // Default ZAR 50 flat rate
        api_key: 'sandbox-courierguy-key'  // Default sandbox key for testing
      });

    if (error) throw error;
    console.log(`Default shipping initialized for store: ${storeId}`);
  } catch (error) {
    console.error('Error initializing default shipping:', error);
  }
};

function isValidShippingSettings(obj: any): obj is { partner_code: string; cost_type: string; flat_rate: number; api_key: string } {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.partner_code === 'string' &&
    typeof obj.cost_type === 'string' &&
    typeof obj.flat_rate === 'number' &&
    typeof obj.api_key === 'string'
  );
}

export const getShippingSettingsForStore = async (storeId: string): Promise<ShippingSettings | null> => {
  try {
    // Get store's shipping settings from store_shipping_settings table
    const { data: storeSettings, error: storeError } = await supabase
      .from('store_shipping_settings')
      .select('partner_code, cost_type, flat_rate, api_key')
      .eq('store_id', storeId)
      .single();

    if (storeError || !isValidShippingSettings(storeSettings)) {
      console.log('No valid shipping settings found for store:', storeId, 'initializing default...');
      // Initialize default shipping settings
      await initializeDefaultShippingForStore(storeId);
      // Return default settings
      return {
        partner_code: 'courierguy',
        cost_type: 'flat',
        flat_rate: 50,
        api_key: 'sandbox-courierguy-key'  // Default sandbox key
      };
    }
    // storeSettings is guaranteed to have the required properties here
    return {
      partner_code: storeSettings.partner_code,
      cost_type: storeSettings.cost_type as 'flat' | 'api',
      flat_rate: storeSettings.flat_rate,
      api_key: storeSettings.api_key || 'sandbox-api-key'  // Fallback sandbox key
    };
  } catch (error) {
    console.error('Error getting shipping settings:', error);
    return null;
  }
};

export const getShippingCostForStore = async (params: {
  settings: ShippingSettings;
  collection: Address;
  delivery: Address;
  parcel: Parcel;
}): Promise<ShippingCalculationResult> => {
  return await calculateShippingCost(params.settings, params.collection, params.delivery, params.parcel);
};
