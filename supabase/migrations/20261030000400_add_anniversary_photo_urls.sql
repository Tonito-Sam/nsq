ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS anniversary1_photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anniversary2_photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS anniversary3_photo_urls text[] NOT NULL DEFAULT '{}';