ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS anniversary1_song_url text,
  ADD COLUMN IF NOT EXISTS anniversary2_song_url text,
  ADD COLUMN IF NOT EXISTS anniversary3_song_url text;