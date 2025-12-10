-- Create dedicated promo_transfers table to track promo money movements
-- This avoids altering core tables like transactions/wallets and prevents errors

CREATE TABLE IF NOT EXISTS promo_transfers (
  id BIGSERIAL PRIMARY KEY,
  from_user_id UUID,
  to_user_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_transfers_from_user ON promo_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_promo_transfers_to_user ON promo_transfers(to_user_id);
