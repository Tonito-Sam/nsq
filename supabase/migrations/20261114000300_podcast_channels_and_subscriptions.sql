alter table public.studio_podcast_branding
  add column if not exists podcast_name text not null default '',
  add column if not exists podcast_description text not null default '',
  add column if not exists subscription_mode text not null default 'free',
  add column if not exists subscription_price numeric(10, 2) not null default 0;

alter table public.studio_podcast_branding
  drop constraint if exists studio_podcast_branding_subscription_mode_check;
alter table public.studio_podcast_branding
  add constraint studio_podcast_branding_subscription_mode_check
  check (subscription_mode in ('free', 'paid'));
alter table public.studio_podcast_branding
  drop constraint if exists studio_podcast_branding_subscription_price_check;
alter table public.studio_podcast_branding
  add constraint studio_podcast_branding_subscription_price_check
  check (
    subscription_price >= 0
    and subscription_price <= 500
    and ((subscription_mode = 'free' and subscription_price = 0)
      or (subscription_mode = 'paid' and subscription_price > 0))
  );
alter table public.studio_podcast_branding
  drop constraint if exists studio_podcast_branding_podcast_name_check;
alter table public.studio_podcast_branding
  add constraint studio_podcast_branding_podcast_name_check
  check (char_length(trim(podcast_name)) <= 120);
alter table public.studio_podcast_branding
  drop constraint if exists studio_podcast_branding_podcast_description_check;
alter table public.studio_podcast_branding
  add constraint studio_podcast_branding_podcast_description_check
  check (char_length(podcast_description) <= 1200);

drop policy if exists "Public can read published Podcast channels" on public.studio_podcast_branding;
grant select on public.studio_podcast_branding to anon, authenticated;
create policy "Public can read published Podcast channels"
  on public.studio_podcast_branding for select to anon, authenticated
  using (exists (
    select 1
    from public.studio_shows s
    where s.id = studio_podcast_branding.show_id
      and s.show_source = 'creator'
      and s.publication_status = 'published'
      and s.is_active = true
  ));

create table if not exists public.studio_podcast_subscriptions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.studio_shows(id) on delete cascade,
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_payment_reference text,
  unique (show_id, subscriber_id)
);

create index if not exists studio_podcast_subscriptions_subscriber_idx
  on public.studio_podcast_subscriptions (subscriber_id, expires_at);
create index if not exists studio_podcast_subscriptions_show_idx
  on public.studio_podcast_subscriptions (show_id, expires_at);
create index if not exists creator_podcast_published_episode_lookup_idx
  on public.creator_podcast_drafts (episode_id)
  where status = 'published' and episode_id is not null;
create index if not exists creator_podcast_published_asset_lookup_idx
  on public.creator_podcast_drafts (recording_path)
  where status = 'published' and recording_path is not null;

alter table public.studio_podcast_subscriptions enable row level security;
revoke all on public.studio_podcast_subscriptions from anon, authenticated;
grant select on public.studio_podcast_subscriptions to authenticated;

drop policy if exists "Users can view their Podcast subscriptions" on public.studio_podcast_subscriptions;
create policy "Users can view their Podcast subscriptions"
  on public.studio_podcast_subscriptions for select to authenticated
  using (subscriber_id = auth.uid());

create or replace function public.update_studio_podcast_settings(
  p_show_id uuid,
  p_podcast_name text,
  p_podcast_description text,
  p_subscription_mode text,
  p_subscription_price numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_name text := trim(coalesce(p_podcast_name, ''));
  normalized_description text := trim(coalesce(p_podcast_description, ''));
  normalized_price numeric(10, 2) := coalesce(p_subscription_price, 0);
begin
  if auth.uid() is null or not exists (
    select 1
    from public.studio_show_applications a
    where a.approved_show_id = p_show_id
      and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = p_show_id and m.user_id = auth.uid()
      ))
  ) then
    raise exception 'You are not a manager of this approved show' using errcode = '42501';
  end if;
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Podcast channel name must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if char_length(normalized_description) > 1200 then
    raise exception 'Podcast description cannot exceed 1200 characters' using errcode = '22023';
  end if;
  if p_subscription_mode is null or p_subscription_mode not in ('free', 'paid') then
    raise exception 'Choose free or paid subscriptions' using errcode = '22023';
  end if;
  if (p_subscription_mode = 'free' and normalized_price <> 0)
    or (p_subscription_mode = 'paid' and (normalized_price <= 0 or normalized_price > 500)) then
    raise exception 'Paid subscriptions must be priced between $0.01 and $500 per month' using errcode = '22023';
  end if;

  insert into public.studio_podcast_branding (
    show_id, podcast_name, podcast_description, subscription_mode, subscription_price, updated_at
  ) values (
    p_show_id, normalized_name, normalized_description, p_subscription_mode, normalized_price, now()
  )
  on conflict (show_id) do update
  set podcast_name = excluded.podcast_name,
      podcast_description = excluded.podcast_description,
      subscription_mode = excluded.subscription_mode,
      subscription_price = excluded.subscription_price,
      updated_at = now();
end;
$$;

revoke all on function public.update_studio_podcast_settings(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.update_studio_podcast_settings(uuid, text, text, text, numeric) to authenticated;

create or replace function public.is_podcast_show_manager(p_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.studio_show_applications a
    where a.approved_show_id = p_show_id
      and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = p_show_id and m.user_id = auth.uid()
      ))
  );
$$;

revoke all on function public.is_podcast_show_manager(uuid) from public, anon;
grant execute on function public.is_podcast_show_manager(uuid) to authenticated;

create or replace function public.can_view_creator_podcast_episode(p_episode_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  episode_show_id uuid;
  episode_owner_id uuid;
begin
  select d.show_id, d.owner_id
    into episode_show_id, episode_owner_id
  from public.creator_podcast_drafts d
  where d.episode_id = p_episode_id and d.status = 'published';

  if not found then
    return true;
  end if;
  if auth.uid() = episode_owner_id
    or public.is_podcast_show_manager(episode_show_id)
    or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
    ) then
    return true;
  end if;
  return exists (
    select 1
    from public.studio_podcast_subscriptions s
    where s.show_id = episode_show_id
      and s.subscriber_id = auth.uid()
      and (s.expires_at is null or s.expires_at > now())
  );
end;
$$;

revoke all on function public.can_view_creator_podcast_episode(uuid) from public;
grant execute on function public.can_view_creator_podcast_episode(uuid) to anon, authenticated;

drop policy if exists "Anyone can view episodes from published creator TV shows" on public.studio_episodes;
create policy "Anyone can view episodes from published creator TV shows"
  on public.studio_episodes
  for select
  to anon, authenticated
  using (
    is_active = true
    and public.can_view_creator_podcast_episode(id)
    and exists (
      select 1
      from public.studio_shows s
      where s.id = studio_episodes.show_id
        and s.show_source = 'creator'
        and s.publication_status = 'published'
        and s.is_active = true
    )
  );

create or replace function public.can_access_creator_podcast_asset(p_asset_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  podcast_show_id uuid;
  podcast_owner_id uuid;
begin
  select d.show_id, d.owner_id
    into podcast_show_id, podcast_owner_id
  from public.creator_podcast_drafts d
  where d.recording_path = p_asset_path and d.status = 'published'
  limit 1;

  if not found then
    return false;
  end if;
  if auth.uid() = podcast_owner_id
    or public.is_podcast_show_manager(podcast_show_id)
    or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
    ) then
    return true;
  end if;
  return exists (
    select 1
    from public.studio_podcast_subscriptions s
    where s.show_id = podcast_show_id
      and s.subscriber_id = auth.uid()
      and (s.expires_at is null or s.expires_at > now())
  );
end;
$$;

revoke all on function public.can_access_creator_podcast_asset(text) from public, anon;
grant execute on function public.can_access_creator_podcast_asset(text) to authenticated;

drop policy if exists creator_podcast_files_read_active_subscribers on storage.objects;
create policy creator_podcast_files_read_active_subscribers
  on storage.objects for select to authenticated
  using (
    bucket_id = 'creator-podcast-drafts'
    and public.can_access_creator_podcast_asset(name)
  );

update public.studio_episodes e
set video_url = 'podcast-private://' || d.recording_path
from public.creator_podcast_drafts d
where d.episode_id = e.id
  and d.status = 'published'
  and d.recording_path is not null
  and e.video_url not like 'podcast-private://%';

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
    perform public.wallet_post_personal_transfer(
      subscriber,
      channel_owner,
      plan_price,
      renewal_reference,
      500
    );
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
    'amount_usd', case when plan_mode = 'paid' then plan_price else 0 end
  );
end;
$$;

revoke all on function public.subscribe_to_podcast(uuid) from public, anon;
grant execute on function public.subscribe_to_podcast(uuid) to authenticated;
