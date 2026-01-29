export interface ShippingPartner {
  code: string;
  name: string;
  supportsApi: boolean;
  docs?: string;
  description: string;
}

export const shippingPartners: ShippingPartner[] = [
  {
    code: 'courierguy',
    name: 'The Courier Guy',
    supportsApi: true,
    docs: 'https://www.shiplogic.com/developers',
    description: 'South African courier service with nationwide coverage'
  },
  {
    code: 'shiplogic',
    name: 'Ship Logic',
    supportsApi: true,
    docs: 'https://www.shiplogic.com/developers',
    description: 'Multi-carrier shipping platform'
  },
  {
    code: 'fedex',
    name: 'FedEx',
    supportsApi: true,
    docs: 'https://developer.fedex.com/',
    description: 'International express delivery service'
  },
  {
    code: 'dhl',
    name: 'DHL',
    supportsApi: true,
    docs: 'https://developer.dhl.com/',
    description: 'Global courier and logistics company'
  },
  {
    code: 'ups',
    name: 'UPS',
    supportsApi: true,
    docs: 'https://developer.ups.com/',
    description: 'United Parcel Service - global shipping'
  },
  {
    code: 'postnet',
    name: 'PostNet',
    supportsApi: false,
    description: 'South African postal and courier service'
  },
  {
    code: 'aramex',
    name: 'Aramex',
    supportsApi: true,
    docs: 'https://www.aramex.com/developers',
    description: 'Middle East and global logistics provider'
  }
];

// Utility function to select default shipping partner based on vendor and buyer country
export function getDefaultShippingPartner(vendorCountry: string, buyerCountry: string, storeDefaultPartner?: string): string {
  // If vendor is in South Africa and buyer is outside, use Aramex by default
  if (vendorCountry === 'ZA' && buyerCountry !== 'ZA') {
    return 'aramex';
  }
  // If both are in South Africa, use Courier Guy by default
  if (vendorCountry === 'ZA' && buyerCountry === 'ZA') {
    return 'courierguy';
  }
  // Fallback to store's configured partner or another logic
  return storeDefaultPartner || 'courierguy';
}

// Alias for backward compatibility
export const selectDefaultShippingPartner = getDefaultShippingPartner;
