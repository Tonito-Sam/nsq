ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_share_special_days boolean NOT NULL DEFAULT false;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS personal_special_day_key text UNIQUE;