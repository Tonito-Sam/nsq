alter table public.user_stores
  add column if not exists business_whatsapp_verified_at timestamptz;

alter table public.orders
  add column if not exists item_summary text;

create unique index if not exists orders_payment_reference_store_id_uidx
  on public.orders (payment_reference, store_id)
  where payment_reference is not null;

create table if not exists public.store_whatsapp_verifications (
  store_id uuid primary key references public.user_stores(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.store_whatsapp_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.user_stores(id) on delete cascade,
  recipient_phone text not null,
  payment_reference text not null,
  store_name text not null,
  order_reference text not null,
  item_summary text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'ZAR',
  order_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (payment_reference, store_id)
);

create index if not exists store_whatsapp_order_notifications_pending_idx
  on public.store_whatsapp_order_notifications (available_at, created_at)
  where status = 'pending';

alter table public.store_whatsapp_verifications enable row level security;
alter table public.store_whatsapp_order_notifications enable row level security;
