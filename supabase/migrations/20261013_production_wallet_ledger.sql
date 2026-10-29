create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  post_id uuid,
  name text,
  objective text,
  budget_usd numeric(12,2) not null default 0,
  spent_usd numeric(12,2) not null default 0,
  status text not null default 'draft',
  start_at timestamptz,
  end_at timestamptz,
  target_options jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ad_transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  user_id uuid not null,
  amount_usd numeric(12,2) not null default 0,
  amount_virtual_charged numeric(12,2) not null default 0,
  amount_real_charged numeric(12,2) not null default 0,
  type text not null default 'charge',
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists public.wallet_compliance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kyc_status text not null default 'unverified' check (kyc_status in ('unverified', 'pending', 'verified', 'rejected')),
  risk_status text not null default 'active' check (risk_status in ('active', 'review', 'blocked')),
  kyc_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists seller_amount numeric(18,2);

create table if not exists public.store_wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.user_stores(id) on delete cascade,
  currency varchar(3) not null,
  available_balance numeric(18,2) not null default 0 check (available_balance >= 0),
  held_balance numeric(18,2) not null default 0 check (held_balance >= 0),
  total_earned numeric(18,2) not null default 0 check (total_earned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, currency)
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('personal', 'store')),
  user_id uuid references auth.users(id) on delete restrict,
  store_id uuid references public.user_stores(id) on delete restrict,
  entry_type text not null check (entry_type in ('topup', 'p2p_transfer', 'promo_transfer', 'store_transfer', 'sale_credit', 'payout_hold', 'payout_release', 'payout_paid', 'campaign_spend')),
  direction text not null check (direction in ('debit', 'credit', 'hold', 'release')),
  amount numeric(18,2) not null check (amount > 0),
  currency varchar(3) not null,
  reference text not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wallet_ledger_account_owner_check check (
    (account_type = 'personal' and user_id is not null and store_id is null)
    or (account_type = 'store' and store_id is not null and user_id is null)
  )
);

create index if not exists wallet_ledger_user_created_idx
  on public.wallet_ledger_entries (user_id, created_at desc)
  where user_id is not null;
create index if not exists wallet_ledger_store_created_idx
  on public.wallet_ledger_entries (store_id, created_at desc)
  where store_id is not null;

alter table public.wallet_ledger_entries
  drop constraint if exists wallet_ledger_entries_entry_type_check;
alter table public.wallet_ledger_entries
  add constraint wallet_ledger_entries_entry_type_check
  check (entry_type in ('topup', 'p2p_transfer', 'promo_transfer', 'store_transfer', 'sale_credit', 'payout_hold', 'payout_release', 'payout_paid', 'campaign_spend'));

create table if not exists public.promo_transfers (
  id bigserial primary key,
  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

alter table public.promo_transfers
  add column if not exists reference text;
update public.promo_transfers
  set reference = 'PROMO-LEGACY-' || id::text
  where reference is null;
alter table public.promo_transfers
  alter column reference set not null;
create unique index if not exists promo_transfers_reference_uidx
  on public.promo_transfers (reference);

alter table public.promo_transfers enable row level security;
revoke all on public.promo_transfers from anon, authenticated;
grant select on public.promo_transfers to authenticated;
drop policy if exists promo_transfers_read_participant on public.promo_transfers;
create policy promo_transfers_read_participant
  on public.promo_transfers for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create table if not exists public.wallet_topup_intents (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  gateway text not null check (gateway in ('paystack', 'flutterwave')),
  amount_local numeric(18,2) not null check (amount_local > 0),
  currency_local varchar(3) not null,
  amount_usd numeric(18,2) not null check (amount_usd > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  status text not null default 'pending' check (status in ('pending', 'credited', 'failed', 'expired')),
  provider_reference text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);

create table if not exists public.store_payout_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.user_stores(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  currency varchar(3) not null,
  amount numeric(18,2) not null check (amount > 0),
  beneficiary jsonb not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'processing', 'paid', 'rejected', 'failed')),
  reference text not null unique,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists store_payout_requests_review_idx
  on public.store_payout_requests (status, created_at asc);

alter table public.wallet_compliance_profiles enable row level security;
alter table public.store_wallet_accounts enable row level security;
alter table public.wallet_ledger_entries enable row level security;
alter table public.wallet_topup_intents enable row level security;
alter table public.store_payout_requests enable row level security;
alter table public.wallets enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_transactions enable row level security;

create policy wallet_compliance_read_own
  on public.wallet_compliance_profiles for select to authenticated
  using (user_id = auth.uid());
create policy store_wallet_read_owner
  on public.store_wallet_accounts for select to authenticated
  using (exists (select 1 from public.user_stores s where s.id = store_id and s.user_id = auth.uid()));
create policy wallet_ledger_read_owner
  on public.wallet_ledger_entries for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.user_stores s where s.id = store_id and s.user_id = auth.uid())
  );
create policy wallet_topup_read_own
  on public.wallet_topup_intents for select to authenticated
  using (user_id = auth.uid());
create policy store_payout_read_owner
  on public.store_payout_requests for select to authenticated
  using (owner_user_id = auth.uid());
create policy personal_wallet_read_own
  on public.wallets for select to authenticated
  using (user_id = auth.uid());
create policy personal_wallet_seed_own
  on public.wallets for insert to authenticated
  with check (user_id = auth.uid() and real_balance = 0 and virtual_balance = 100 and total_balance = 100);
drop policy if exists campaigns_read_own on public.campaigns;
create policy campaigns_read_own
  on public.campaigns for select to authenticated
  using (user_id = auth.uid());
drop policy if exists ad_transactions_read_own on public.ad_transactions;
create policy ad_transactions_read_own
  on public.ad_transactions for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.wallets from anon, authenticated;
revoke insert, update, delete on public.campaigns, public.ad_transactions from anon, authenticated;
grant select on public.wallets to authenticated;
grant select on public.campaigns, public.ad_transactions to authenticated;
revoke all on public.wallet_compliance_profiles, public.store_wallet_accounts,
  public.wallet_ledger_entries, public.wallet_topup_intents, public.store_payout_requests
  from anon, authenticated;
grant select on public.wallet_compliance_profiles, public.store_wallet_accounts,
  public.wallet_ledger_entries, public.wallet_topup_intents, public.store_payout_requests
  to authenticated;

create or replace function public.wallet_post_personal_transfer(
  p_sender_user_id uuid,
  p_recipient_user_id uuid,
  p_amount_usd numeric,
  p_reference text,
  p_daily_limit_usd numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric(18,2);
  recipient_balance numeric(18,2);
  sender_kyc text;
  recipient_kyc text;
  sender_risk text;
  recipient_risk text;
  already_posted boolean;
  operation_id uuid := gen_random_uuid();
begin
  if p_sender_user_id = p_recipient_user_id or p_amount_usd <= 0 or p_amount_usd > 100000 then
    raise exception 'Invalid transfer';
  end if;
  if p_reference is null or length(p_reference) < 12 then raise exception 'Invalid transfer reference'; end if;

  select exists (
    select 1 from wallet_ledger_entries
    where idempotency_key = p_reference || ':sender'
  ) into already_posted;
  if already_posted then return jsonb_build_object('status', 'already_processed', 'reference', p_reference); end if;

  select kyc_status, risk_status into sender_kyc, sender_risk
  from wallet_compliance_profiles where user_id = p_sender_user_id for update;
  select kyc_status, risk_status into recipient_kyc, recipient_risk
  from wallet_compliance_profiles where user_id = p_recipient_user_id for update;
  if sender_kyc is distinct from 'verified' or recipient_kyc is distinct from 'verified'
    or sender_risk is distinct from 'active' or recipient_risk is distinct from 'active' then
    raise exception 'Wallet transfers require verified, active accounts';
  end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_sender_user_id, 0, 100, 100), (p_recipient_user_id, 0, 100, 100)
    on conflict (user_id) do nothing;
  perform id from wallets where user_id in (p_sender_user_id, p_recipient_user_id) order by user_id for update;

  select real_balance into sender_balance from wallets where user_id = p_sender_user_id;
  select real_balance into recipient_balance from wallets where user_id = p_recipient_user_id;
  if sender_balance < p_amount_usd then raise exception 'Insufficient real wallet balance'; end if;

  if p_daily_limit_usd <= 0 or p_amount_usd + coalesce((
    select sum(amount) from wallet_ledger_entries
    where user_id = p_sender_user_id and entry_type = 'p2p_transfer'
      and direction = 'debit' and created_at >= date_trunc('day', now())
  ), 0) > p_daily_limit_usd then
    raise exception 'Daily transfer limit exceeded';
  end if;

  update wallets set real_balance = real_balance - p_amount_usd, updated_at = now() where user_id = p_sender_user_id;
  update wallets set real_balance = real_balance + p_amount_usd, updated_at = now() where user_id = p_recipient_user_id;
  insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key)
  values
    ('personal', p_sender_user_id, 'p2p_transfer', 'debit', p_amount_usd, 'USD', p_reference, p_reference || ':sender'),
    ('personal', p_recipient_user_id, 'p2p_transfer', 'credit', p_amount_usd, 'USD', p_reference, p_reference || ':recipient');
  insert into transfers (from_user_id, to_user_id, amount_usd, currency, reference, status, metadata)
    values (p_sender_user_id, p_recipient_user_id, p_amount_usd, 'USD', p_reference, 'completed', jsonb_build_object('operation_id', operation_id));

  return jsonb_build_object('status', 'completed', 'reference', p_reference, 'amount_usd', p_amount_usd);
end;
$$;

create or replace function public.wallet_post_virtual_transfer(
  p_sender_user_id uuid,
  p_recipient_user_id uuid,
  p_amount_usd numeric,
  p_reference text,
  p_note text default null,
  p_daily_limit_usd numeric default 1000
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric(18,2);
  recipient_balance numeric(18,2);
  already_posted boolean;
begin
  if p_sender_user_id = p_recipient_user_id or p_amount_usd <= 0 or p_amount_usd > 100000 then
    raise exception 'Invalid promo transfer';
  end if;
  if p_reference is null or length(p_reference) < 12 then raise exception 'Invalid transfer reference'; end if;

  select exists (select 1 from wallet_ledger_entries where idempotency_key = p_reference || ':promo-sender')
    into already_posted;
  if already_posted then return jsonb_build_object('status', 'already_processed', 'reference', p_reference); end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_sender_user_id, 0, 100, 100), (p_recipient_user_id, 0, 100, 100)
    on conflict (user_id) do nothing;
  perform id from wallets where user_id in (p_sender_user_id, p_recipient_user_id) order by user_id for update;

  select virtual_balance into sender_balance from wallets where user_id = p_sender_user_id;
  select virtual_balance into recipient_balance from wallets where user_id = p_recipient_user_id;
  if sender_balance < p_amount_usd then raise exception 'Insufficient virtual balance'; end if;
  if p_daily_limit_usd <= 0 or p_amount_usd + coalesce((
    select sum(amount) from wallet_ledger_entries
    where user_id = p_sender_user_id and entry_type = 'promo_transfer'
      and direction = 'debit' and created_at >= date_trunc('day', now())
  ), 0) > p_daily_limit_usd then raise exception 'Daily promo transfer limit exceeded'; end if;

  update wallets set virtual_balance = virtual_balance - p_amount_usd, updated_at = now() where user_id = p_sender_user_id;
  update wallets set virtual_balance = virtual_balance + p_amount_usd, updated_at = now() where user_id = p_recipient_user_id;
  insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
  values
    ('personal', p_sender_user_id, 'promo_transfer', 'debit', p_amount_usd, 'USD', p_reference, p_reference || ':promo-sender', jsonb_build_object('balance_type', 'virtual')),
    ('personal', p_recipient_user_id, 'promo_transfer', 'credit', p_amount_usd, 'USD', p_reference, p_reference || ':promo-recipient', jsonb_build_object('balance_type', 'virtual'));
  insert into promo_transfers (from_user_id, to_user_id, amount, note, reference, metadata)
    values (p_sender_user_id, p_recipient_user_id, p_amount_usd, p_note, p_reference, jsonb_build_object('balance_type', 'virtual'));

  return jsonb_build_object('status', 'completed', 'reference', p_reference, 'amount_usd', p_amount_usd);
end;
$$;

create or replace function public.wallet_transfer_to_store(
  p_owner_user_id uuid,
  p_store_id uuid,
  p_amount_usd numeric,
  p_reference text,
  p_daily_limit_usd numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric(18,2);
  store_account_id uuid;
  store_owner uuid;
  kyc text;
  risk text;
  already_posted boolean;
begin
  if p_amount_usd <= 0 or p_amount_usd > 100000 then raise exception 'Invalid transfer amount'; end if;
  if p_reference is null or length(p_reference) < 12 then raise exception 'Invalid transfer reference'; end if;
  select exists (select 1 from wallet_ledger_entries where idempotency_key = p_reference || ':personal') into already_posted;
  if already_posted then return jsonb_build_object('status', 'already_processed', 'reference', p_reference); end if;

  select kyc_status, risk_status into kyc, risk from wallet_compliance_profiles where user_id = p_owner_user_id for update;
  if kyc is distinct from 'verified' or risk is distinct from 'active' then
    raise exception 'Store transfers require verified, active accounts';
  end if;
  select user_id into store_owner from user_stores where id = p_store_id and is_active = true;
  if store_owner is distinct from p_owner_user_id then raise exception 'Store is not owned by this account'; end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_owner_user_id, 0, 100, 100) on conflict (user_id) do nothing;
  select real_balance into sender_balance from wallets where user_id = p_owner_user_id for update;
  if sender_balance < p_amount_usd then raise exception 'Insufficient real wallet balance'; end if;
  if p_daily_limit_usd <= 0 or p_amount_usd + coalesce((
    select sum(amount) from wallet_ledger_entries
    where user_id = p_owner_user_id and entry_type = 'store_transfer'
      and direction = 'debit' and created_at >= date_trunc('day', now())
  ), 0) > p_daily_limit_usd then raise exception 'Daily transfer limit exceeded'; end if;

  insert into store_wallet_accounts (store_id, currency) values (p_store_id, 'USD')
    on conflict (store_id, currency) do nothing;
  select id into store_account_id from store_wallet_accounts where store_id = p_store_id and currency = 'USD' for update;
  update wallets set real_balance = real_balance - p_amount_usd, updated_at = now() where user_id = p_owner_user_id;
  update store_wallet_accounts set available_balance = available_balance + p_amount_usd, updated_at = now() where id = store_account_id;
  insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key)
    values ('personal', p_owner_user_id, 'store_transfer', 'debit', p_amount_usd, 'USD', p_reference, p_reference || ':personal');
  insert into wallet_ledger_entries (account_type, store_id, entry_type, direction, amount, currency, reference, idempotency_key)
    values ('store', p_store_id, 'store_transfer', 'credit', p_amount_usd, 'USD', p_reference, p_reference || ':store');
  return jsonb_build_object('status', 'completed', 'reference', p_reference, 'amount_usd', p_amount_usd);
end;
$$;

create or replace function public.wallet_transfer_virtual_promo(
  p_sender_user_id uuid,
  p_recipient_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric(18,2);
  recipient_balance numeric(18,2);
  already_posted boolean;
begin
  if p_sender_user_id = p_recipient_user_id or p_amount <= 0 or p_amount > 100000 then raise exception 'Invalid promo transfer'; end if;
  if p_reference is null or length(p_reference) < 12 then raise exception 'Invalid promo transfer reference'; end if;
  select exists(select 1 from wallet_ledger_entries where idempotency_key = p_reference || ':sender') into already_posted;
  if already_posted then return jsonb_build_object('status', 'already_processed', 'reference', p_reference); end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_sender_user_id, 0, 100, 100), (p_recipient_user_id, 0, 100, 100)
    on conflict (user_id) do nothing;
  perform id from wallets where user_id in (p_sender_user_id, p_recipient_user_id) order by user_id for update;
  select virtual_balance into sender_balance from wallets where user_id = p_sender_user_id;
  select virtual_balance into recipient_balance from wallets where user_id = p_recipient_user_id;
  if sender_balance < p_amount then raise exception 'Insufficient promo balance'; end if;

  update wallets set virtual_balance = virtual_balance - p_amount, updated_at = now() where user_id = p_sender_user_id;
  update wallets set virtual_balance = virtual_balance + p_amount, updated_at = now() where user_id = p_recipient_user_id;
  insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
    values
      ('personal', p_sender_user_id, 'promo_transfer', 'debit', p_amount, 'USD', p_reference, p_reference || ':sender', jsonb_build_object('note', p_note)),
      ('personal', p_recipient_user_id, 'promo_transfer', 'credit', p_amount, 'USD', p_reference, p_reference || ':recipient', jsonb_build_object('note', p_note));
  insert into promo_transfers (from_user_id, to_user_id, amount, note, reference, metadata)
    values (p_sender_user_id, p_recipient_user_id, p_amount, p_note, p_reference, jsonb_build_object('from_balance', 'virtual'));
  return jsonb_build_object('status', 'completed', 'reference', p_reference, 'amount', p_amount);
end;
$$;

create or replace function public.wallet_credit_paid_order(p_order_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  existing_entry uuid;
begin
  select * into order_row from orders where id = p_order_id for update;
  if not found or order_row.status not in ('paid', 'completed') then raise exception 'Order is not paid'; end if;
  select id into existing_entry from wallet_ledger_entries where idempotency_key = 'sale:' || p_order_id::text;
  if existing_entry is not null then return jsonb_build_object('status', 'already_credited', 'order_id', p_order_id); end if;

  insert into store_wallet_accounts (store_id, currency) values (order_row.store_id, upper(coalesce(order_row.currency, 'USD')))
    on conflict (store_id, currency) do nothing;
  update store_wallet_accounts
    set available_balance = available_balance + coalesce(order_row.seller_amount, order_row.total_amount),
        total_earned = total_earned + coalesce(order_row.seller_amount, order_row.total_amount),
        updated_at = now()
    where store_id = order_row.store_id and currency = upper(coalesce(order_row.currency, 'USD'));
  insert into wallet_ledger_entries (account_type, store_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
    values ('store', order_row.store_id, 'sale_credit', 'credit', coalesce(order_row.seller_amount, order_row.total_amount), upper(coalesce(order_row.currency, 'USD')),
      coalesce(order_row.payment_reference, p_order_id::text), 'sale:' || p_order_id::text,
      jsonb_build_object('order_id', p_order_id, 'buyer_total', order_row.total_amount));
  return jsonb_build_object('status', 'credited', 'order_id', p_order_id, 'amount', coalesce(order_row.seller_amount, order_row.total_amount), 'currency', upper(coalesce(order_row.currency, 'USD')));
end;
$$;

create or replace function public.wallet_credit_topup(
  p_reference text,
  p_provider_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intent wallet_topup_intents%rowtype;
begin
  select * into intent from wallet_topup_intents where reference = p_reference for update;
  if not found then raise exception 'Top-up intent not found'; end if;
  if intent.status = 'credited' then return jsonb_build_object('status', 'already_credited', 'reference', p_reference); end if;
  if intent.status <> 'pending' or intent.expires_at <= now() then raise exception 'Top-up intent is not payable'; end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (intent.user_id, 0, 100, 100) on conflict (user_id) do nothing;
  perform id from wallets where user_id = intent.user_id for update;
  update wallets set real_balance = real_balance + intent.amount_usd, updated_at = now()
    where user_id = intent.user_id;
  insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
    values ('personal', intent.user_id, 'topup', 'credit', intent.amount_usd, 'USD', p_reference,
      'topup:' || p_reference, jsonb_build_object('gateway', intent.gateway, 'provider_reference', p_provider_reference,
        'amount_local', intent.amount_local, 'currency_local', intent.currency_local, 'fx_rate', intent.fx_rate));
  update wallet_topup_intents set status = 'credited', provider_reference = p_provider_reference, credited_at = now()
    where reference = p_reference;
  return jsonb_build_object('status', 'credited', 'reference', p_reference, 'amount_usd', intent.amount_usd);
end;
$$;

create or replace function public.wallet_request_store_payout(
  p_owner_user_id uuid,
  p_store_id uuid,
  p_currency varchar,
  p_amount numeric,
  p_reference text,
  p_beneficiary jsonb,
  p_daily_limit numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row store_wallet_accounts%rowtype;
  request_id uuid;
  store_owner uuid;
  kyc text;
  risk text;
begin
  if p_amount <= 0 or p_reference is null or length(p_reference) < 12 then raise exception 'Invalid payout request'; end if;
  if p_beneficiary is null or jsonb_typeof(p_beneficiary) <> 'object' then raise exception 'A verified beneficiary is required'; end if;
  select kyc_status, risk_status into kyc, risk from wallet_compliance_profiles where user_id = p_owner_user_id for update;
  if kyc is distinct from 'verified' or risk is distinct from 'active' then raise exception 'Payouts require verified, active accounts'; end if;
  select user_id into store_owner from user_stores where id = p_store_id and is_active = true;
  if store_owner is distinct from p_owner_user_id then raise exception 'Store is not owned by this account'; end if;

  select * into account_row from store_wallet_accounts
    where store_id = p_store_id and currency = upper(p_currency) for update;
  if not found or account_row.available_balance < p_amount then raise exception 'Insufficient store wallet balance'; end if;
  if p_daily_limit <= 0 or p_amount + coalesce((
    select sum(amount) from store_payout_requests
    where store_id = p_store_id and created_at >= date_trunc('day', now())
      and status not in ('rejected', 'failed')
  ), 0) > p_daily_limit then raise exception 'Daily payout limit exceeded'; end if;

  update store_wallet_accounts set available_balance = available_balance - p_amount,
    held_balance = held_balance + p_amount, updated_at = now() where id = account_row.id;
  insert into store_payout_requests (store_id, owner_user_id, currency, amount, beneficiary, reference)
    values (p_store_id, p_owner_user_id, upper(p_currency), p_amount, p_beneficiary, p_reference)
    returning id into request_id;
  insert into wallet_ledger_entries (account_type, store_id, entry_type, direction, amount, currency, reference, idempotency_key)
    values ('store', p_store_id, 'payout_hold', 'hold', p_amount, upper(p_currency), p_reference, p_reference || ':hold');
  return jsonb_build_object('status', 'pending_review', 'request_id', request_id, 'reference', p_reference);
end;
$$;

create or replace function public.wallet_decide_store_payout(
  p_request_id uuid,
  p_decision text,
  p_reviewer_user_id uuid,
  p_note text default null,
  p_provider_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payout store_payout_requests%rowtype;
begin
  if p_decision not in ('approved', 'processing', 'paid', 'rejected', 'failed') then raise exception 'Invalid payout decision'; end if;
  select * into payout from store_payout_requests where id = p_request_id for update;
  if not found then raise exception 'Payout request not found'; end if;

  if p_decision = 'approved' and payout.status <> 'pending_review' then raise exception 'Only pending requests can be approved'; end if;
  if p_decision = 'processing' and payout.status <> 'approved' then raise exception 'Only approved requests can be processed'; end if;
  if p_decision = 'paid' and (payout.status <> 'processing' or coalesce(p_provider_reference, '') = '') then
    raise exception 'A processing request and payout provider reference are required';
  end if;
  if p_decision = 'rejected' and payout.status not in ('pending_review', 'approved') then raise exception 'Request cannot be rejected from its current state'; end if;
  if p_decision = 'failed' and payout.status <> 'processing' then raise exception 'Only processing payouts can fail'; end if;

  if p_decision in ('rejected', 'failed') then
    update store_wallet_accounts set available_balance = available_balance + payout.amount,
      held_balance = held_balance - payout.amount, updated_at = now()
      where store_id = payout.store_id and currency = payout.currency;
    insert into wallet_ledger_entries (account_type, store_id, entry_type, direction, amount, currency, reference, idempotency_key)
      values ('store', payout.store_id, 'payout_release', 'release', payout.amount, payout.currency,
        payout.reference, payout.reference || ':release');
  elsif p_decision = 'paid' then
    update store_wallet_accounts set held_balance = held_balance - payout.amount, updated_at = now()
      where store_id = payout.store_id and currency = payout.currency;
    insert into wallet_ledger_entries (account_type, store_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
      values ('store', payout.store_id, 'payout_paid', 'debit', payout.amount, payout.currency,
        payout.reference, payout.reference || ':paid', jsonb_build_object('provider_reference', p_provider_reference));
  end if;

  update store_payout_requests set status = p_decision, reviewer_user_id = p_reviewer_user_id,
    review_note = coalesce(p_note, review_note), provider_reference = coalesce(p_provider_reference, provider_reference),
    updated_at = now(), completed_at = case when p_decision = 'paid' then now() else completed_at end
    where id = p_request_id;
  return jsonb_build_object('id', p_request_id, 'status', p_decision);
end;
$$;

create or replace function public.wallet_create_campaign(
  p_user_id uuid,
  p_reference text,
  p_post_id uuid,
  p_name text,
  p_objective text,
  p_budget_usd numeric,
  p_days integer,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_target_options jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_id uuid;
  existing_campaign_id uuid;
  existing_virtual numeric(18,2);
  existing_real numeric(18,2);
  wallet_row wallets%rowtype;
  virtual_charge numeric(18,2);
  real_charge numeric(18,2);
  minimum_daily numeric(8,2);
begin
  if p_reference is null or length(p_reference) < 12 or length(p_reference) > 80 then raise exception 'Invalid campaign reference'; end if;
  if p_budget_usd is null or p_budget_usd <= 0 or p_budget_usd > 100000 then raise exception 'Invalid campaign budget'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'Invalid campaign duration'; end if;

  select campaign_id, amount_virtual_charged, amount_real_charged
    into existing_campaign_id, existing_virtual, existing_real
    from ad_transactions
    where user_id = p_user_id and type = 'charge' and meta->>'reference' = p_reference
    limit 1;
  if found then
    return jsonb_build_object(
      'status', 'already_processed',
      'campaign', (select to_jsonb(c) from campaigns c where c.id = existing_campaign_id),
      'charged', jsonb_build_object('virtual', existing_virtual, 'real', existing_real)
    );
  end if;

  minimum_daily := case when p_post_id is not null then 0.75 else 1.00 end;
  if p_budget_usd / p_days < minimum_daily then raise exception 'Campaign daily budget is below the minimum'; end if;

  insert into wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_user_id, 0, 100, 100) on conflict (user_id) do nothing;
  select * into wallet_row from wallets where user_id = p_user_id for update;

  virtual_charge := least(wallet_row.virtual_balance, p_budget_usd);
  real_charge := p_budget_usd - virtual_charge;
  if real_charge > wallet_row.real_balance then raise exception 'Insufficient total balance'; end if;

  insert into campaigns (user_id, post_id, name, objective, budget_usd, spent_usd, status, start_at, end_at, target_options)
    values (p_user_id, p_post_id, coalesce(nullif(p_name, ''), 'Campaign ' || current_date::text),
      case when p_post_id is not null then 'boost_post' else coalesce(nullif(p_objective, ''), 'general') end,
      p_budget_usd, 0, 'active', coalesce(p_start_at, now()), p_end_at, p_target_options)
    returning id into campaign_id;

  update wallets set
    virtual_balance = virtual_balance - virtual_charge,
    real_balance = real_balance - real_charge,
    total_balance = virtual_balance - virtual_charge + real_balance - real_charge,
    updated_at = now()
    where user_id = p_user_id;

  if virtual_charge > 0 then
    insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
      values ('personal', p_user_id, 'campaign_spend', 'debit', virtual_charge, 'USD', p_reference,
        'campaign:' || p_reference || ':virtual', jsonb_build_object('campaign_id', campaign_id, 'balance_type', 'virtual'));
  end if;
  if real_charge > 0 then
    insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
      values ('personal', p_user_id, 'campaign_spend', 'debit', real_charge, 'USD', p_reference,
        'campaign:' || p_reference || ':real', jsonb_build_object('campaign_id', campaign_id, 'balance_type', 'real'));
  end if;
  insert into ad_transactions (campaign_id, user_id, amount_usd, amount_virtual_charged, amount_real_charged, type, meta)
    values (campaign_id, p_user_id, p_budget_usd, virtual_charge, real_charge, 'charge', jsonb_build_object('note', 'Campaign purchase', 'reference', p_reference));

  return jsonb_build_object(
    'status', 'completed',
    'campaign', (select to_jsonb(c) from campaigns c where c.id = campaign_id),
    'charged', jsonb_build_object('virtual', virtual_charge, 'real', real_charge)
  );
end;
$$;

create or replace function public.wallet_cancel_campaign(
  p_user_id uuid,
  p_campaign_id uuid,
  p_refund boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row campaigns%rowtype;
  wallet_row wallets%rowtype;
  total_charged numeric(18,2);
  virtual_charged numeric(18,2);
  real_charged numeric(18,2);
  remaining numeric(18,2);
  virtual_refund numeric(18,2) := 0;
  real_refund numeric(18,2) := 0;
begin
  select * into campaign_row from campaigns where id = p_campaign_id and user_id = p_user_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if campaign_row.status = 'cancelled' then
    return jsonb_build_object('status', 'already_cancelled', 'refunded', 0);
  end if;

  remaining := greatest(0, round(campaign_row.budget_usd - campaign_row.spent_usd, 2));
  if p_refund and remaining > 0 then
    select coalesce(sum(amount_virtual_charged), 0), coalesce(sum(amount_real_charged), 0)
      into virtual_charged, real_charged
      from ad_transactions where campaign_id = p_campaign_id and user_id = p_user_id and type = 'charge';
    total_charged := virtual_charged + real_charged;
    if total_charged <= 0 then
      virtual_refund := remaining;
    elsif virtual_charged <= 0 then
      real_refund := remaining;
    elsif real_charged <= 0 then
      virtual_refund := remaining;
    else
      virtual_refund := round(remaining * virtual_charged / total_charged, 2);
      real_refund := remaining - virtual_refund;
    end if;

    insert into wallets (user_id, real_balance, virtual_balance, total_balance)
      values (p_user_id, 0, 100, 100) on conflict (user_id) do nothing;
    select * into wallet_row from wallets where user_id = p_user_id for update;
    update wallets set
      virtual_balance = virtual_balance + virtual_refund,
      real_balance = real_balance + real_refund,
      total_balance = virtual_balance + virtual_refund + real_balance + real_refund,
      updated_at = now()
      where user_id = p_user_id;

    if virtual_refund > 0 then
      insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
        values ('personal', p_user_id, 'campaign_spend', 'credit', virtual_refund, 'USD', 'campaign:' || p_campaign_id || ':refund',
          'campaign:' || p_campaign_id || ':refund:virtual', jsonb_build_object('campaign_id', p_campaign_id, 'balance_type', 'virtual'));
    end if;
    if real_refund > 0 then
      insert into wallet_ledger_entries (account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata)
        values ('personal', p_user_id, 'campaign_spend', 'credit', real_refund, 'USD', 'campaign:' || p_campaign_id || ':refund',
          'campaign:' || p_campaign_id || ':refund:real', jsonb_build_object('campaign_id', p_campaign_id, 'balance_type', 'real'));
    end if;
    insert into ad_transactions (campaign_id, user_id, amount_usd, amount_virtual_charged, amount_real_charged, type, meta)
      values (p_campaign_id, p_user_id, remaining, virtual_refund, real_refund, 'refund', jsonb_build_object('note', 'Campaign cancelled refund'));
  end if;

  update campaigns set status = 'cancelled', updated_at = now() where id = p_campaign_id;
  return jsonb_build_object('status', 'cancelled', 'refunded', virtual_refund + real_refund,
    'refunded_virtual', virtual_refund, 'refunded_real', real_refund);
end;
$$;

revoke all on function public.wallet_post_personal_transfer(uuid, uuid, numeric, text, numeric) from public, anon, authenticated;
revoke all on function public.wallet_post_virtual_transfer(uuid, uuid, numeric, text, text, numeric) from public, anon, authenticated;
revoke all on function public.wallet_transfer_to_store(uuid, uuid, numeric, text, numeric) from public, anon, authenticated;
revoke all on function public.wallet_transfer_virtual_promo(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.wallet_credit_paid_order(uuid) from public, anon, authenticated;
revoke all on function public.wallet_credit_topup(text, text) from public, anon, authenticated;
revoke all on function public.wallet_request_store_payout(uuid, uuid, varchar, numeric, text, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.wallet_decide_store_payout(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.wallet_create_campaign(uuid, text, uuid, text, text, numeric, integer, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.wallet_cancel_campaign(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_post_personal_transfer(uuid, uuid, numeric, text, numeric) to service_role;
grant execute on function public.wallet_post_virtual_transfer(uuid, uuid, numeric, text, text, numeric) to service_role;
grant execute on function public.wallet_transfer_to_store(uuid, uuid, numeric, text, numeric) to service_role;
grant execute on function public.wallet_transfer_virtual_promo(uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.wallet_credit_paid_order(uuid) to service_role;
grant execute on function public.wallet_credit_topup(text, text) to service_role;
grant execute on function public.wallet_request_store_payout(uuid, uuid, varchar, numeric, text, jsonb, numeric) to service_role;
grant execute on function public.wallet_decide_store_payout(uuid, text, uuid, text, text) to service_role;
grant execute on function public.wallet_create_campaign(uuid, text, uuid, text, text, numeric, integer, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.wallet_cancel_campaign(uuid, uuid, boolean) to service_role;
