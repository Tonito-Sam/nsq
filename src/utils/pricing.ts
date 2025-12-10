export interface PriceInfo {
  displayPrice: number;
  originalPrice: number;
  isOnSale: boolean;
}

// Determine the display price for a product-like object.
// Accepts any shape that may contain sale_price, discount_price, is_on_sale, sale_starts, sale_ends, price.
export function getDisplayPrice(product: any): PriceInfo {
  try {
    const rawPrice = Number(product?.price ?? 0) || 0;
    const spRaw = product?.sale_price;
    const dpRaw = product?.discount_price;

    const salePrice = spRaw != null && spRaw !== '' ? Number(spRaw) : null;
    const discountPrice = dpRaw != null && dpRaw !== '' ? Number(dpRaw) : null;
    const isOn = !!product?.is_on_sale;

    const starts = product?.sale_starts ? new Date(product.sale_starts) : null;
    const ends = product?.sale_ends ? new Date(product.sale_ends) : null;
    const now = new Date();

    // Only apply salePrice if flagged and within optional window
    if (salePrice != null && isOn) {
      if (starts && now < starts) {
        return { displayPrice: rawPrice, originalPrice: rawPrice, isOnSale: false };
      }
      if (ends && now > ends) {
        return { displayPrice: rawPrice, originalPrice: rawPrice, isOnSale: false };
      }
      if (salePrice < rawPrice) {
        return { displayPrice: salePrice, originalPrice: rawPrice, isOnSale: true };
      }
    }

    // fallback to discount_price if present and lower
    if (discountPrice != null && discountPrice < rawPrice) {
      return { displayPrice: discountPrice, originalPrice: rawPrice, isOnSale: true };
    }

    return { displayPrice: rawPrice, originalPrice: rawPrice, isOnSale: false };
  } catch (e) {
    const p = Number(product?.price ?? 0) || 0;
    return { displayPrice: p, originalPrice: p, isOnSale: false };
  }
}

export function getDiscountPercentage(originalPrice: number, salePrice: number) {
  if (!originalPrice || originalPrice <= 0) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}
