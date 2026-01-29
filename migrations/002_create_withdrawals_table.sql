-- Migration: create withdrawals table
-- Requirements: pgcrypto extension for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  wallet_transaction_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  amount_usd numeric(18,4) NOT NULL,
  method varchar(100),
  status varchar(50) DEFAULT 'pending',
  transaction_reference varchar(255),
  bank_name varchar(255),
  account_number varchar(255),
  account_name varchar(255),
  destination_info jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS withdrawals_created_at_idx ON public.withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON public.withdrawals(user_id);
