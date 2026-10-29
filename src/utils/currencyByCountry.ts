const currencyByCountry: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', IE: 'EUR', AU: 'AUD', NZ: 'NZD',
  ZA: 'ZAR', NG: 'NGN', GH: 'GHS', KE: 'KES', UG: 'UGX', TZ: 'TZS',
  RW: 'RWF', BW: 'BWP', LS: 'LSL', SZ: 'SZL', NA: 'NAD', ZM: 'ZMW',
  MW: 'MWK', EG: 'EGP', MA: 'MAD', MU: 'MUR', SC: 'SCR', ET: 'ETB',
  SN: 'XOF', CI: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', TG: 'XOF',
  BJ: 'XOF', GW: 'XOF', CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF',
  CF: 'XAF', GQ: 'XAF', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR',
  JP: 'JPY', CN: 'CNY', HK: 'HKD', TW: 'TWD', KR: 'KRW', SG: 'SGD',
  MY: 'MYR', ID: 'IDR', TH: 'THB', PH: 'PHP', VN: 'VND', KH: 'KHR',
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  IL: 'ILS', TR: 'TRY', RU: 'RUB', UA: 'UAH', CH: 'CHF', NO: 'NOK',
  SE: 'SEK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  BG: 'BGN', IS: 'ISK', BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP',
  CO: 'COP', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB', CR: 'CRC',
  PA: 'PAB', DO: 'DOP', JM: 'JMD', TT: 'TTD',
};

export const getCurrencyByCountry = (countryCode?: string | null): string => {
  return countryCode ? currencyByCountry[countryCode.toUpperCase()] || 'USD' : 'USD';
};
