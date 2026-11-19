ALTER TABLE public.user_stores
  ADD COLUMN IF NOT EXISTS shipping_pickup_address text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_suburb text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_city text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_province text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_postal_code text;

ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS shipping_weight_kg numeric(10,3),
  ADD COLUMN IF NOT EXISTS shipping_length_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS shipping_width_cm numeric(10,2),
  ADD COLUMN IF NOT EXISTS shipping_height_cm numeric(10,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_service text;