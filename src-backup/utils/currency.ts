interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
}

export const formatCurrency = (
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {}
): string => {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    locale = 'en-US'
  } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits,
    maximumFractionDigits
  }).format(amount);
}; 