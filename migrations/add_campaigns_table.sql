-- Migration: add campaigns and ad_transactions tables
-- Run this against your Postgres DB (supabase) as service role

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid,
  name text,
  objective text,
  budget_usd numeric(12,2) NOT NULL DEFAULT 0,
  spent_usd numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  start_at timestamptz,
  end_at timestamptz,
  target_options jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  user_id uuid NOT NULL,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  amount_virtual_charged numeric(12,2) NOT NULL DEFAULT 0,
  amount_real_charged numeric(12,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'charge',
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_adtx_user_id ON ad_transactions(user_id);
