alter table public.studio_channels
  add column if not exists social_links jsonb not null default '{}'::jsonb;
