create table if not exists public.platform_special_days (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  event_date date not null,
  country_code char(2) not null,
  name text not null,
  local_name text not null,
  description text,
  icon text not null default '🎉',
  background text not null,
  event_types text[] not null default '{}',
  is_national boolean not null default false,
  source text not null default 'Nager.Date',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_special_days_date_country_idx
  on public.platform_special_days (event_date, country_code)
  where is_enabled = true;

alter table public.platform_special_days enable row level security;
drop policy if exists platform_special_days_public_read on public.platform_special_days;
create policy platform_special_days_public_read
  on public.platform_special_days for select to anon, authenticated
  using (is_enabled = true);
revoke insert, update, delete on public.platform_special_days from anon, authenticated;
grant select on public.platform_special_days to anon, authenticated;

alter table public.posts
  add column if not exists platform_special_day_id uuid references public.platform_special_days(id) on delete set null,
  add column if not exists is_platform_celebration boolean not null default false,
  add column if not exists pinned_until timestamptz;

create unique index if not exists posts_platform_special_day_uidx
  on public.posts (platform_special_day_id);
create index if not exists posts_active_pins_idx
  on public.posts (pinned_until desc)
  where pinned_until is not null;