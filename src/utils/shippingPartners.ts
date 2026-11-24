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
    description: 'South African domestic delivery via ShipLogic'
  },
  {
    code: 'shiplogic',
    name: 'Ship Logic',
    supportsApi: true,
    docs: 'https://www.shiplogic.com/developers',
    description: 'Multi-carrier shipping platform'
  },
  {
    code: 'terminalafrica',
    name: 'Terminal Africa',
    supportsApi: true,
    docs: 'https://docs.terminal.africa/tship/master.md',
    description: 'Shipping quotes and booking for routes to or from Nigeria'
  },
  {
    code: 'fedex',
    name: 'FedEx',
    supportsApi: false,
    docs: 'https://developer.fedex.com/',
    description: 'International express delivery service'
  },
  {
    code: 'dhl',
    name: 'DHL',
    supportsApi: false,
    docs: 'https://developer.dhl.com/',
    description: 'Global courier and logistics company'
  },
  {
    code: 'ups',
    name: 'UPS',
    supportsApi: false,
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
    supportsApi: false,
    docs: 'https://www.aramex.com/developers',
    description: 'Middle East and global logistics provider'
  }
];

// Utility function to select default shipping partner based on vendor and buyer country
export function getDefaultShippingPartner(vendorCountry: string, buyerCountry: string, storeDefaultPartner?: string): string {
  const origin = vendorCountry.trim().toUpperCase();
  const destination = buyerCountry.trim().toUpperCase();
  if (origin === 'NG' || destination === 'NG') {
    return 'terminalafrica';
  }
  if (origin === 'ZA' && destination === 'ZA') {
    return 'courierguy';
  }
  return storeDefaultPartner?.trim().toLowerCase() || '';
}

// Alias for backward compatibility
export const selectDefaultShippingPartner = getDefaultShippingPartner;
