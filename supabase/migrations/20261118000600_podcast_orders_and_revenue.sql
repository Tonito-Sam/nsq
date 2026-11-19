create table if not exists public.podcast_subscription_orders (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid unique references public.podcast_subscription_payments(id) on delete set null,
  reference text not null unique,
  order_number text not null unique,
  invoice_number text not null unique,
  show_id uuid references public.studio_shows(id) on delete set null,
  subscriber_id uuid not null references auth.users(id) on delete restrict,
  channel_owner_id uuid not null references auth.users(id) on delete restrict,
  podcast_name text not null,
  item_description text not null default '30-day Podcast subscription',
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  gross_amount numeric(10, 2) not null check (gross_amount > 0),
  platform_fee_rate numeric(5, 2) not null default 10.00 check (platform_fee_rate = 10.00),
  platform_fee_amount numeric(10, 2) not null check (platform_fee_amount >= 0),
  creator_net_amount numeric(10, 2) not null check (creator_net_amount >= 0),
  currency varchar(3) not null default 'USD' check (currency = 'USD'),
  service_period_start timestamptz not null,
  service_period_end timestamptz not null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint podcast_subscription_order_split_check
    check (gross_amount = platform_fee_amount + creator_net_amount),
  constraint podcast_subscription_order_period_check
    check (service_period_end > service_period_start)
);

create index if not exists podcast_subscription_orders_subscriber_paid_idx
  on public.podcast_subscription_orders (subscriber_id, paid_at desc);
create index if not exists podcast_subscription_orders_show_paid_idx
  on public.podcast_subscription_orders (show_id, paid_at desc);
create index if not exists podcast_subscription_orders_owner_paid_idx
  on public.podcast_subscription_orders (channel_owner_id, paid_at desc);

alter table public.podcast_subscription_orders enable row level security;
revoke all on public.podcast_subscription_orders from anon, authenticated;
grant select on public.podcast_subscription_orders to authenticated;

drop policy if exists "Podcast order participants can view orders" on public.podcast_subscription_orders;
create policy "Podcast order participants can view orders"
  on public.podcast_subscription_orders for select to authenticated
  using (
    subscriber_id = auth.uid()
    or channel_owner_id = auth.uid()
    or (show_id is not null and public.is_podcast_show_manager(show_id))
  );

create or replace function public.get_podcast_subscription_revenue_summary(p_show_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  summary jsonb;
begin
  if auth.uid() is null or not public.is_podcast_show_manager(p_show_id) then
    raise exception 'You are not a manager of this Podcast channel' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'paid_orders', count(*),
    'unique_subscribers', count(distinct subscriber_id),
    'gross_revenue', coalesce(sum(gross_amount), 0),
    'platform_fees', coalesce(sum(platform_fee_amount), 0),
    'creator_earnings', coalesce(sum(creator_net_amount), 0),
    'last_30_days_net', coalesce(sum(creator_net_amount) filter (
      where paid_at >= now() - interval '30 days'
    ), 0)
  )
  into summary
  from public.podcast_subscription_orders
  where show_id = p_show_id
    and status = 'paid';

  return summary;
end;
$$;

revoke all on function public.get_podcast_subscription_revenue_summary(uuid) from public, anon;
grant execute on function public.get_podcast_subscription_revenue_summary(uuid) to authenticated;

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
  channel_name text;
  existing_subscription public.studio_podcast_subscriptions%rowtype;
  renewal_reference text;
  new_expiry timestamptz;
  period_start timestamptz;
  payment_result jsonb;
  platform_fee numeric(10, 2) := 0;
  creator_net numeric(10, 2) := 0;
  payment_id uuid;
  order_number text;
  invoice_number text;
begin
  if subscriber is null then
    raise exception 'Sign in to subscribe to a Podcast channel' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_show_id::text || ':' || subscriber::text, 0));

  select a.applicant_id, b.subscription_mode, b.subscription_price, b.podcast_name
    into channel_owner, plan_mode, plan_price, channel_name
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
    period_start := now();
    new_expiry := period_start + interval '30 days';
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

    select id into payment_id
    from public.podcast_subscription_payments
    where reference = renewal_reference;
    if payment_id is null then
      raise exception 'The Podcast payment record could not be created';
    end if;

    invoice_number := 'POD-' || to_char(period_start, 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    order_number := 'PORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

    insert into public.podcast_subscription_orders (
      payment_id, reference, order_number, invoice_number, show_id, subscriber_id,
      channel_owner_id, podcast_name, item_description, status, gross_amount,
      platform_fee_rate, platform_fee_amount, creator_net_amount, currency,
      service_period_start, service_period_end, paid_at
    ) values (
      payment_id, renewal_reference, order_number, invoice_number, p_show_id, subscriber,
      channel_owner, channel_name, '30-day subscription to ' || channel_name, 'paid', plan_price,
      10.00, platform_fee, creator_net, 'USD', period_start, new_expiry, period_start
    );
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
    'creator_net_usd', creator_net,
    'order_number', order_number,
    'invoice_number', invoice_number
  );
end;
$$;

revoke all on function public.subscribe_to_podcast(uuid) from public, anon;
grant execute on function public.subscribe_to_podcast(uuid) to authenticated;

notify pgrst, 'reload schema';
