-- Create wallets table used by the backend
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  real_balance numeric(12,2) NOT NULL DEFAULT 0,
  virtual_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to keep total_balance in sync
CREATE OR REPLACE FUNCTION public.wallets_update_total()
RETURNS trigger AS $$
BEGIN
  NEW.total_balance := COALESCE(NEW.real_balance,0) + COALESCE(NEW.virtual_balance,0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallets_update_total_trigger ON public.wallets;
CREATE TRIGGER wallets_update_total_trigger
BEFORE INSERT OR UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.wallets_update_total();

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
