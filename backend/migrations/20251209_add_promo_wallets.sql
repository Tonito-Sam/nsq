-- Add new columns to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS real_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_balance DECIMAL(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_balance DECIMAL(10,2) DEFAULT 100;

-- Update existing wallets to have initial virtual balance
UPDATE wallets 
SET 
  virtual_balance = 100,
  total_balance = COALESCE(balance, 0) + 100,
  real_balance = COALESCE(balance, 0)
WHERE virtual_balance IS NULL;

-- Add balance_type to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT 'real',
ADD COLUMN IF NOT EXISTS recipient_info TEXT;
