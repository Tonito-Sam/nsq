-- Migration: add profile DOB, posts fields for processed images, and special_days table
-- Run in Supabase SQL editor or with your migration runner

-- 1. Ensure the extensions for gen_random_uuid (pgcrypto) are available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add date_of_birth to profiles (if you store date of birth in profiles)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 3. Add required fields to posts table used by the TextMomentCreator
ALTER TABLE IF EXISTS posts
  ADD COLUMN IF NOT EXISTS processed_image_url TEXT,
  ADD COLUMN IF NOT EXISTS meme_filter VARCHAR(50),
  ADD COLUMN IF NOT EXISTS moment_special_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS moment_special_bg TEXT,
  ADD COLUMN IF NOT EXISTS moment_special_icon TEXT,
  ADD COLUMN IF NOT EXISTS moment_special_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS moment_special_name TEXT,
  ADD COLUMN IF NOT EXISTS moment_special_id TEXT,
  ADD COLUMN IF NOT EXISTS moment_special_countries TEXT[],
  ADD COLUMN IF NOT EXISTS moment_special_message TEXT,
  ADD COLUMN IF NOT EXISTS is_custom_special_day BOOLEAN DEFAULT false;

-- 4. Create a server-side table to manage special days (optional)
CREATE TABLE IF NOT EXISTS special_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) NOT NULL,
  background TEXT NOT NULL,
  date_type VARCHAR(20) NOT NULL CHECK (date_type IN ('fixed','rule','birthday')),
  date_rule VARCHAR(255),
  fixed_date VARCHAR(10),
  country_codes TEXT[],
  is_global BOOLEAN DEFAULT false,
  category VARCHAR(20) NOT NULL CHECK (category IN ('holiday','observance','birthday','custom')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Optional: index for lookup by fixed_date
CREATE INDEX IF NOT EXISTS idx_special_days_fixed_date ON special_days(fixed_date);

-- 6. Optional sample inserts (uncomment to run)
-- INSERT INTO special_days (name, description, icon, background, date_type, fixed_date, is_global, category)
-- VALUES ('New Year''s Day','Start of the new year','🎉','linear-gradient(135deg,#667eea 0%,#764ba2 100%)','fixed','01-01',true,'holiday');
-- Additional sample inserts: New Year's Eve and Last Day of the Year
INSERT INTO special_days (name, description, icon, background, date_type, fixed_date, is_global, category)
VALUES
  ('New Year''s Day','Start of the new year','🎉','linear-gradient(135deg,#667eea 0%,#764ba2 100%)','fixed','01-01',true,'holiday'),
  ('New Year''s Eve','Countdown to the new year','🥳','linear-gradient(135deg,#f7971e 0%,#ffd200 100%)','fixed','12-31',true,'holiday'),
  ('Last Day of the Year','Last day to reflect and celebrate','📅','linear-gradient(135deg,#ff9a9e 0%,#fecfef 100%)','fixed','12-31',true,'holiday');
