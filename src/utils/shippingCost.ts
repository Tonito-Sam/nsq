import { shippingPartners } from './shippingPartners';
import type { ShippingPartner } from './shippingPartners';
import { supabase } from '@/integrations/supabase/client';
import apiUrl from '@/lib/api';

export interface Address {
  country: string;
  postal_code: string;
  city: string;
  street: string;
  province: string;
  suburb?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  line2?: string;
}

export interface Parcel {
  weight: number;
  length: number;
  width: number;
  height: number;
  description?: string;
  items?: Array<{
    product_id: string;
    name: string;
    description: string;
    type: 'document' | 'parcel';
    currency: string;
    value: number;
    quantity: number;
    weight: number;
  }>;
  parcels?: Array<{
    weight: number;
    length: number;
    width: number;
    height: number;
  }>;
}

export interface ShippingSettings {
  partner_code?: string;
  cost_type?: 'flat' | 'api';
  flat_rate?: number;
  api_key?: string;
}

export interface LiveShippingQuote {
  provider: 'courierguy' | 'terminalafrica';
  rate_id: string;
  quote_token: string;
  service: string;
  amount: number;
  currency: string;
  estimated_delivery?: string | null;
  service_code?: string;
  pickup_options?: Array<{ type: string }>;
}

export interface ShippingCalculationResult {
  cost: number | null;
  error?: string;
  partner?: ShippingPartner;
  quote?: LiveShippingQuote;
}

export const calculateShippingCost = async (
  settings: ShippingSettings,
  delivery: Address,
  parcel: Parcel,
  storeId?: string
): Promise<ShippingCalculationResult> => {
  if (!settings.partner_code) {
    return { cost: null, error: 'No shipping partner configured' };
  }

  const partner = shippingPartners.find(p => p.code === settings.partner_code);
  if (!partner) {
    return { cost: null, error: 'Invalid shipping partner' };
  }

  if (settings.cost_type === 'flat' && Number.isFinite(settings.flat_rate) && settings.flat_rate! >= 0) {
    return { cost: settings.flat_rate!, partner };
  }

  if (settings.cost_type === 'api') {
    if (!['courierguy', 'shiplogic', 'terminalafrica'].includes(settings.partner_code)) {
      return { cost: null, error: `Live rates for ${partner.name} are not enabled`, partner };
    }
    if (!storeId) return { cost: null, error: 'Store information is required to request a shipping quote', partner };
    return await fetchLiveShippingRate(partner, delivery, parcel, storeId);
  }

  return { cost: null, error: 'Invalid shipping configuration', partner };
};

const fetchLiveShippingRate = async (
  partner: ShippingPartner,
  delivery: Address,
  parcel: Parcel,
  storeId: string
): Promise<ShippingCalculationResult> => {
  try {
    if (partner.code === 'courierguy' || partner.code === 'shiplogic') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in to calculate shipping');
      const response = await fetch(apiUrl('/api/shipping/courierguy/rates'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          store_id: storeId,
          delivery,
          product_items: parcel.items?.map(item => ({ product_id: item.product_id, quantity: item.quantity })) || [],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `CourierGuy rate error: ${response.status}`);
      }

      const data = await response.json();
      const quote = data.quotes?.[0];
      if (!quote || !Number.isFinite(Number(quote.amount)) || !quote.rate_id || !quote.service_code || !quote.quote_token) {
        return { cost: null, error: 'No bookable CourierGuy rates found for this route', partner };
      }
      return {
        cost: Number(quote.amount),
        partner: { ...partner, name: quote.service || partner.name },
        quote: { ...quote, provider: 'courierguy' },
      };
    } else if (partner.code === 'terminalafrica') {
      if (!parcel.items?.length) return { cost: null, error: 'Add product weights and values to calculate a Terminal Africa quote', partner };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sign in to calculate shipping');
      const response = await fetch(apiUrl('/api/shipping/terminal-africa/rates'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          store_id: storeId,
          delivery,
          product_items: parcel.items?.map(item => ({ product_id: item.product_id, quantity: item.quantity })) || [],
          currency: 'ZAR',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Terminal Africa rate error: ${response.status}`);
      }

      const data = await response.json();
      const quote = data.quotes?.[0];
      if (!quote || !Number.isFinite(Number(quote.amount)) || !quote.rate_id || !quote.quote_token) {
        return { cost: null, error: 'No bookable Terminal Africa rates found for this route', partner };
      }
      return {
        cost: Number(quote.amount),
        partner: { ...partner, name: quote.service || partner.name },
        quote: { ...quote, provider: 'terminalafrica' },
      };
    }
    return { cost: null, error: `Live rates for ${partner.name} are not enabled`, partner };
  } catch (error: unknown) {
    console.error('Shipping rate calculation error:', error);
    const message = error instanceof Error ? error.message : 'Please try again.';
    return { cost: null, error: `Failed to calculate shipping: ${message}`, partner };
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
        cost_type: 'api',
        flat_rate: 0,
        api_key: '',
      });

    if (error) throw error;
    console.log(`Default shipping initialized for store: ${storeId}`);
  } catch (error) {
    console.error('Error initializing default shipping:', error);
  }
};

function isValidShippingSettings(obj: any): obj is { partner_code: string; cost_type: string; flat_rate: number } {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.partner_code === 'string' &&
    typeof obj.cost_type === 'string' &&
    typeof obj.flat_rate === 'number'
  );
}

export const getShippingSettingsForStore = async (storeId: string): Promise<ShippingSettings | null> => {
  try {
    // Get store's shipping settings from store_shipping_settings table
    const { data: storeSettings, error: storeError } = await supabase
      .from('store_shipping_settings')
      .select('partner_code, cost_type, flat_rate')
      .eq('store_id', storeId)
      .single();

    if (storeError || !isValidShippingSettings(storeSettings)) {
      console.log('No valid shipping settings found for store:', storeId, 'initializing default...');
      // Initialize default shipping settings
      await initializeDefaultShippingForStore(storeId);
      // Return default settings
      return {
        partner_code: 'courierguy',
        cost_type: 'api',
        flat_rate: 0,
        api_key: '',
      };
    }
    // storeSettings is guaranteed to have the required properties here
    return {
      partner_code: storeSettings.partner_code,
      cost_type: storeSettings.cost_type as 'flat' | 'api',
      flat_rate: storeSettings.flat_rate,
      api_key: ''
    };
  } catch (error) {
    console.error('Error getting shipping settings:', error);
    return null;
  }
};

export const getShippingCostForStore = async (params: {
  settings: ShippingSettings;
  delivery: Address;
  parcel: Parcel;
}): Promise<ShippingCalculationResult> => {
  return await calculateShippingCost(params.settings, params.delivery, params.parcel);
};
