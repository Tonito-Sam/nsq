-- Migration: create transfers table
-- Requirements: pgcrypto extension for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  from_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  to_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  amount_usd numeric(18,4) NOT NULL,
  currency varchar(10) DEFAULT 'USD',
  reference varchar(255),
  status varchar(50) DEFAULT 'pending',
  related_transaction_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  destination_info jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS transfers_created_at_idx ON public.transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS transfers_status_idx ON public.transfers(status);
CREATE INDEX IF NOT EXISTS transfers_from_user_idx ON public.transfers(from_user_id);
CREATE INDEX IF NOT EXISTS transfers_to_user_idx ON public.transfers(to_user_id);
