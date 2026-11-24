ALTER TABLE public.user_stores
  ADD COLUMN IF NOT EXISTS shipping_pickup_name text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_email text,
  ADD COLUMN IF NOT EXISTS shipping_pickup_phone text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_provider text,
  ADD COLUMN IF NOT EXISTS shipping_rate_id text,
  ADD COLUMN IF NOT EXISTS shipping_currency text,
  ADD COLUMN IF NOT EXISTS shipping_estimated_delivery text,
  ADD COLUMN IF NOT EXISTS shipping_quote_token text,
  ADD COLUMN IF NOT EXISTS shipping_status text,
  ADD COLUMN IF NOT EXISTS shipping_shipment_id text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipping_label_url text,
  ADD COLUMN IF NOT EXISTS carrier text;

CREATE INDEX IF NOT EXISTS orders_shipping_ready_to_book_idx
  ON public.orders (shipping_status, created_at)
  WHERE shipping_status = 'ready_to_book';
