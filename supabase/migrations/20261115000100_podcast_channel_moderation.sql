begin;

alter table public.studio_podcast_branding
  add column if not exists channel_status text not null default 'active';

alter table public.studio_podcast_branding
  drop constraint if exists studio_podcast_branding_channel_status_check;
alter table public.studio_podcast_branding
  add constraint studio_podcast_branding_channel_status_check
  check (channel_status in ('active', 'suspended', 'deleted'));

drop policy if exists "Public can read published Podcast channels" on public.studio_podcast_branding;
create policy "Public can read published Podcast channels"
  on public.studio_podcast_branding for select to anon, authenticated
  using (
    channel_status = 'active'
    and exists (
      select 1
      from public.studio_shows s
      where s.id = studio_podcast_branding.show_id
        and s.show_source = 'creator'
        and s.publication_status = 'published'
        and s.is_active = true
    )
  );

drop policy if exists "Admins can read all Podcast channels" on public.studio_podcast_branding;
create policy "Admins can read all Podcast channels"
  on public.studio_podcast_branding for select to authenticated
  using (exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.privilege in ('admin', 'superadmin')
  ));

create or replace function public.prevent_deleted_podcast_channel_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.channel_status = 'deleted'
    and not exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.privilege in ('admin', 'superadmin')
    ) then
    raise exception 'This Podcast channel has been deleted and cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_deleted_podcast_channel_edit on public.studio_podcast_branding;
create trigger prevent_deleted_podcast_channel_edit
before update on public.studio_podcast_branding
for each row execute function public.prevent_deleted_podcast_channel_edit();

create or replace function public.prevent_inactive_podcast_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.expires_at is null or new.expires_at > now() then
    if not exists (
      select 1
      from public.studio_podcast_branding b
      where b.show_id = new.show_id
        and b.channel_status = 'active'
    ) then
      raise exception 'This Podcast channel is not accepting subscriptions';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_inactive_podcast_subscription on public.studio_podcast_subscriptions;
create trigger prevent_inactive_podcast_subscription
before insert or update on public.studio_podcast_subscriptions
for each row execute function public.prevent_inactive_podcast_subscription();

create or replace function public.admin_update_podcast_channel(
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
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.studio_show_applications a
    join public.studio_shows s on s.id = a.approved_show_id
    where a.approved_show_id = p_show_id
      and a.status = 'approved'
      and s.show_source = 'creator'
  ) then
    raise exception 'This is not an approved creator Podcast channel' using errcode = 'P0002';
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

  insert into public.studio_podcast_branding as current_brand (
    show_id, podcast_name, podcast_description, subscription_mode, subscription_price, updated_at
  ) values (
    p_show_id, normalized_name, normalized_description, p_subscription_mode, normalized_price, now()
  )
  on conflict (show_id) do update
  set podcast_name = excluded.podcast_name,
      podcast_description = excluded.podcast_description,
      subscription_mode = excluded.subscription_mode,
      subscription_price = excluded.subscription_price,
      updated_at = now()
  where current_brand.channel_status <> 'deleted';

  if not found then
    raise exception 'A deleted Podcast channel cannot be edited';
  end if;
end;
$$;

create or replace function public.admin_set_podcast_channel_status(
  p_show_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fallback_name text;
begin
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Choose active or suspended status' using errcode = '22023';
  end if;

  select s.title into fallback_name
  from public.studio_show_applications a
  join public.studio_shows s on s.id = a.approved_show_id
  where a.approved_show_id = p_show_id
    and a.status = 'approved'
    and s.show_source = 'creator'
  limit 1;
  if not found then
    raise exception 'This is not an approved creator Podcast channel' using errcode = 'P0002';
  end if;

  insert into public.studio_podcast_branding as current_brand (show_id, podcast_name, channel_status, updated_at)
  values (p_show_id, coalesce(nullif(trim(fallback_name), ''), 'Podcast channel'), p_status, now())
  on conflict (show_id) do update
  set channel_status = excluded.channel_status,
      updated_at = now()
  where current_brand.channel_status <> 'deleted';

  if not found then
    raise exception 'A deleted Podcast channel cannot be reactivated';
  end if;
  if p_status = 'suspended' then
    update public.studio_podcast_subscriptions
    set expires_at = now()
    where show_id = p_show_id
      and (expires_at is null or expires_at > now());
  end if;
end;
$$;

create or replace function public.admin_delete_podcast_channel(p_show_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fallback_name text;
begin
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  select s.title into fallback_name
  from public.studio_show_applications a
  join public.studio_shows s on s.id = a.approved_show_id
  where a.approved_show_id = p_show_id
    and a.status = 'approved'
    and s.show_source = 'creator'
  limit 1;
  if not found then
    raise exception 'This is not an approved creator Podcast channel' using errcode = 'P0002';
  end if;

  insert into public.studio_podcast_branding (show_id, podcast_name, channel_status, updated_at)
  values (p_show_id, coalesce(nullif(trim(fallback_name), ''), 'Podcast channel'), 'deleted', now())
  on conflict (show_id) do update
  set channel_status = 'deleted',
      updated_at = now();

  delete from public.studio_podcast_subscriptions
  where show_id = p_show_id;
end;
$$;

revoke all on function public.admin_update_podcast_channel(uuid, text, text, text, numeric) from public, anon;
revoke all on function public.admin_set_podcast_channel_status(uuid, text) from public, anon;
revoke all on function public.admin_delete_podcast_channel(uuid) from public, anon;
grant execute on function public.admin_update_podcast_channel(uuid, text, text, text, numeric) to authenticated;
grant execute on function public.admin_set_podcast_channel_status(uuid, text) to authenticated;
grant execute on function public.admin_delete_podcast_channel(uuid) to authenticated;

commit;
