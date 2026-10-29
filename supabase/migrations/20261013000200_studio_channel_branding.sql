alter table public.studio_channels
  add column if not exists avatar_url text,
  add column if not exists cover_url text;
