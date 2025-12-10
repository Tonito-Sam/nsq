-- Update wallet_transactions table (use wallet_transactions instead of wallets)
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS real_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_balance DECIMAL(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_balance DECIMAL(10,2) DEFAULT 100;

-- Update existing wallet_transactions rows to have initial virtual balance and sensible defaults
-- Note: `wallet_transactions` does not contain a per-user `balance` column; set defaults and compute real_balance below if desired.
UPDATE wallet_transactions
SET
  virtual_balance = 100,
  total_balance = 100,
  real_balance = 0
WHERE virtual_balance IS NULL;

-- Add balance_type to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT 'real',
ADD COLUMN IF NOT EXISTS recipient_info TEXT;

-- Optional: compute per-user real_balance from historical wallet_transactions and store in a separate table or update a wallets table if you have one.
-- Example to compute a per-user real balance (credits - debits) from `wallet_transactions`:
-- Replace 'completed' logic and type names with your canonical values as needed.
--
-- WITH user_balances AS (
--   SELECT
--     user_id,
--     COALESCE(SUM(CASE WHEN type IN ('topup','receive') AND status = 'completed' THEN amount_usd ELSE 0 END),0) -
--     COALESCE(SUM(CASE WHEN type IN ('send','withdraw') AND status = 'completed' THEN amount_usd ELSE 0 END),0) AS real_balance_calc
--   FROM wallet_transactions
--   GROUP BY user_id
-- )
-- -- Example: update or insert into a `wallets` table if you maintain one
-- UPDATE wallets w
-- SET real_balance = ub.real_balance_calc,
--     total_balance = COALESCE(ub.real_balance_calc,0) + COALESCE(w.virtual_balance,100)
-- FROM user_balances ub
-- WHERE w.user_id = ub.user_id;
