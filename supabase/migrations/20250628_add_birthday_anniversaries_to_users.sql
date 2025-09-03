-- Add birthday and up to 3 anniversaries to users table
ALTER TABLE users ADD COLUMN birthday DATE;
ALTER TABLE users ADD COLUMN anniversary1_date DATE;
ALTER TABLE users ADD COLUMN anniversary1_label VARCHAR(64);
ALTER TABLE users ADD COLUMN anniversary2_date DATE;
ALTER TABLE users ADD COLUMN anniversary2_label VARCHAR(64);
ALTER TABLE users ADD COLUMN anniversary3_date DATE;
ALTER TABLE users ADD COLUMN anniversary3_label VARCHAR(64);
