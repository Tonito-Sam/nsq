create table if not exists public.podcast_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.studio_shows(id) on delete cascade,
  subscriber_id uuid not null references auth.users(id) on delete restrict,
  channel_owner_id uuid not null references auth.users(id) on delete restrict,
  reference text not null unique,
  gross_amount numeric(10, 2) not null check (gross_amount > 0),
  platform_fee_rate numeric(5, 2) not null default 10.00 check (platform_fee_rate = 10.00),
  platform_fee_amount numeric(10, 2) not null check (platform_fee_amount >= 0),
  creator_net_amount numeric(10, 2) not null check (creator_net_amount >= 0),
  currency varchar(3) not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now(),
  constraint podcast_subscription_payment_split_check
    check (gross_amount = platform_fee_amount + creator_net_amount)
);

create index if not exists podcast_subscription_payments_show_created_idx
  on public.podcast_subscription_payments (show_id, created_at desc);
create index if not exists podcast_subscription_payments_creator_created_idx
  on public.podcast_subscription_payments (channel_owner_id, created_at desc);

alter table public.podcast_subscription_payments enable row level security;
revoke all on public.podcast_subscription_payments from anon, authenticated;
grant select on public.podcast_subscription_payments to authenticated;

drop policy if exists "Podcast payment participants can view their records" on public.podcast_subscription_payments;
create policy "Podcast payment participants can view their records"
  on public.podcast_subscription_payments for select to authenticated
  using (
    subscriber_id = auth.uid()
    or channel_owner_id = auth.uid()
    or public.is_podcast_show_manager(show_id)
  );

alter table public.wallet_ledger_entries
  drop constraint if exists wallet_ledger_entries_entry_type_check;
alter table public.wallet_ledger_entries
  add constraint wallet_ledger_entries_entry_type_check
  check (entry_type in (
    'topup', 'p2p_transfer', 'promo_transfer', 'store_transfer', 'sale_credit',
    'payout_hold', 'payout_release', 'payout_paid', 'campaign_spend',
    'podcast_subscription'
  ));

create or replace function public.wallet_post_podcast_subscription_transfer(
  p_show_id uuid,
  p_subscriber_user_id uuid,
  p_creator_user_id uuid,
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
  sender_kyc text;
  recipient_kyc text;
  sender_risk text;
  recipient_risk text;
  existing_payment public.podcast_subscription_payments%rowtype;
  platform_fee numeric(10,2);
  creator_net numeric(10,2);
  operation_id uuid := gen_random_uuid();
begin
  if p_show_id is null
    or p_subscriber_user_id is null
    or p_creator_user_id is null
    or p_subscriber_user_id = p_creator_user_id
    or p_amount_usd is null
    or p_amount_usd <= 0
    or p_amount_usd > 100000 then
    raise exception 'Invalid Podcast subscription payment';
  end if;
  if p_reference is null or length(p_reference) < 12 then
    raise exception 'Invalid Podcast subscription payment reference';
  end if;

  select * into existing_payment
  from public.podcast_subscription_payments
  where reference = p_reference
  for update;
  if found then
    return jsonb_build_object(
      'status', 'already_processed',
      'reference', p_reference,
      'amount_usd', existing_payment.gross_amount,
      'platform_fee_usd', existing_payment.platform_fee_amount,
      'creator_net_usd', existing_payment.creator_net_amount
    );
  end if;

  select kyc_status, risk_status into sender_kyc, sender_risk
  from public.wallet_compliance_profiles where user_id = p_subscriber_user_id for update;
  select kyc_status, risk_status into recipient_kyc, recipient_risk
  from public.wallet_compliance_profiles where user_id = p_creator_user_id for update;
  if sender_kyc is distinct from 'verified' or recipient_kyc is distinct from 'verified'
    or sender_risk is distinct from 'active' or recipient_risk is distinct from 'active' then
    raise exception 'Wallet transfers require verified, active accounts';
  end if;

  insert into public.wallets (user_id, real_balance, virtual_balance, total_balance)
    values (p_subscriber_user_id, 0, 100, 100), (p_creator_user_id, 0, 100, 100)
    on conflict (user_id) do nothing;
  perform id from public.wallets
  where user_id in (p_subscriber_user_id, p_creator_user_id)
  order by user_id
  for update;

  select real_balance into sender_balance
  from public.wallets where user_id = p_subscriber_user_id;
  if sender_balance < p_amount_usd then
    raise exception 'Insufficient real wallet balance';
  end if;

  if p_daily_limit_usd <= 0 or p_amount_usd + coalesce((
    select sum(amount)
    from public.wallet_ledger_entries
    where user_id = p_subscriber_user_id
      and entry_type in ('p2p_transfer', 'podcast_subscription')
      and direction = 'debit'
      and created_at >= date_trunc('day', now())
  ), 0) > p_daily_limit_usd then
    raise exception 'Daily transfer limit exceeded';
  end if;

  platform_fee := round(p_amount_usd * 0.10, 2);
  creator_net := p_amount_usd - platform_fee;

  update public.wallets
  set real_balance = real_balance - p_amount_usd, updated_at = now()
  where user_id = p_subscriber_user_id;
  update public.wallets
  set real_balance = real_balance + creator_net, updated_at = now()
  where user_id = p_creator_user_id;

  insert into public.wallet_ledger_entries (
    account_type, user_id, entry_type, direction, amount, currency, reference, idempotency_key, metadata
  ) values
    (
      'personal', p_subscriber_user_id, 'podcast_subscription', 'debit',
      p_amount_usd, 'USD', p_reference, p_reference || ':subscriber',
      jsonb_build_object('show_id', p_show_id, 'platform_fee_usd', platform_fee, 'creator_net_usd', creator_net)
    ),
    (
      'personal', p_creator_user_id, 'podcast_subscription', 'credit',
      creator_net, 'USD', p_reference, p_reference || ':creator',
      jsonb_build_object('show_id', p_show_id, 'gross_amount_usd', p_amount_usd, 'platform_fee_usd', platform_fee)
    );

  insert into public.transfers (
    from_user_id, to_user_id, amount_usd, currency, reference, status, metadata
  ) values (
    p_subscriber_user_id, p_creator_user_id, p_amount_usd, 'USD', p_reference, 'completed',
    jsonb_build_object(
      'operation_id', operation_id,
      'type', 'podcast_subscription',
      'platform_fee_usd', platform_fee,
      'creator_net_usd', creator_net
    )
  );

  insert into public.podcast_subscription_payments (
    show_id, subscriber_id, channel_owner_id, reference, gross_amount,
    platform_fee_rate, platform_fee_amount, creator_net_amount
  ) values (
    p_show_id, p_subscriber_user_id, p_creator_user_id, p_reference, p_amount_usd,
    10.00, platform_fee, creator_net
  );

  return jsonb_build_object(
    'status', 'completed',
    'reference', p_reference,
    'amount_usd', p_amount_usd,
    'platform_fee_usd', platform_fee,
    'creator_net_usd', creator_net
  );
end;
$$;

revoke all on function public.wallet_post_podcast_subscription_transfer(uuid, uuid, uuid, numeric, text, numeric)
  from public, anon, authenticated;
grant execute on function public.wallet_post_podcast_subscription_transfer(uuid, uuid, uuid, numeric, text, numeric)
  to service_role;

create or replace function public.subscribe_to_podcast(p_show_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  subscriber uuid := auth.uid();
  channel_owner uuid;
  plan_mode text;
  plan_price numeric(10, 2);
  existing_subscription public.studio_podcast_subscriptions%rowtype;
  renewal_reference text;
  new_expiry timestamptz;
  payment_result jsonb;
  platform_fee numeric(10, 2) := 0;
  creator_net numeric(10, 2) := 0;
begin
  if subscriber is null then
    raise exception 'Sign in to subscribe to a Podcast channel' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_show_id::text || ':' || subscriber::text, 0));

  select a.applicant_id, b.subscription_mode, b.subscription_price
    into channel_owner, plan_mode, plan_price
  from public.studio_show_applications a
  join public.studio_shows sh on sh.id = a.approved_show_id
  join public.studio_podcast_branding b on b.show_id = a.approved_show_id
  where a.approved_show_id = p_show_id
    and a.status = 'approved'
    and sh.show_source = 'creator'
    and sh.publication_status = 'published'
    and sh.is_active = true
  limit 1;
  if not found then
    raise exception 'This Podcast channel is not available for subscriptions' using errcode = 'P0002';
  end if;
  if subscriber = channel_owner then
    raise exception 'You cannot subscribe to your own Podcast channel' using errcode = '22023';
  end if;

  select * into existing_subscription
  from public.studio_podcast_subscriptions
  where show_id = p_show_id and subscriber_id = subscriber
  for update;
  if found and (existing_subscription.expires_at is null or existing_subscription.expires_at > now()) then
    return jsonb_build_object(
      'status', 'already_subscribed',
      'expires_at', existing_subscription.expires_at,
      'subscription_mode', plan_mode
    );
  end if;

  if plan_mode = 'paid' then
    if plan_price <= 0 or plan_price > 500 then
      raise exception 'The Podcast subscription price is invalid' using errcode = '22023';
    end if;
    renewal_reference := 'podcast-' || gen_random_uuid()::text;
    payment_result := public.wallet_post_podcast_subscription_transfer(
      p_show_id,
      subscriber,
      channel_owner,
      plan_price,
      renewal_reference,
      500
    );
    platform_fee := (payment_result->>'platform_fee_usd')::numeric;
    creator_net := (payment_result->>'creator_net_usd')::numeric;
    new_expiry := now() + interval '30 days';
  else
    renewal_reference := null;
    new_expiry := null;
  end if;

  insert into public.studio_podcast_subscriptions (
    show_id, subscriber_id, created_at, expires_at, last_payment_reference
  ) values (
    p_show_id, subscriber, now(), new_expiry, renewal_reference
  )
  on conflict (show_id, subscriber_id) do update
  set created_at = now(),
      expires_at = excluded.expires_at,
      last_payment_reference = excluded.last_payment_reference;

  return jsonb_build_object(
    'status', 'subscribed',
    'expires_at', new_expiry,
    'subscription_mode', plan_mode,
    'amount_usd', case when plan_mode = 'paid' then plan_price else 0 end,
    'platform_fee_usd', platform_fee,
    'creator_net_usd', creator_net
  );
end;
$$;

revoke all on function public.subscribe_to_podcast(uuid) from public, anon;
grant execute on function public.subscribe_to_podcast(uuid) to authenticated;

notify pgrst, 'reload schema';
