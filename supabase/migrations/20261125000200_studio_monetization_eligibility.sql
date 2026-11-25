create or replace function public.enforce_studio_channel_monetization_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  qualifying_reel_count bigint;
begin
  if tg_op = 'INSERT' then
    if new.donation_enabled then
      select count(*) into qualifying_reel_count
      from public.studio_videos v
      where v.channel_id = new.id
        and v.user_id = new.user_id
        and v.is_reel = true
        and v.duration >= 90;

      if qualifying_reel_count < 10 then
        raise exception 'Live donations require at least 10 Reels of 90 seconds or longer'
          using errcode = '23514';
      end if;
    end if;

    if new.subscription_enabled and not exists (
      select 1
      from public.studio_show_applications a
      where a.channel_id = new.id
        and a.applicant_id = new.user_id
        and a.status = 'approved'
        and a.approved_show_id is not null
    ) then
      raise exception 'Series subscriptions require an approved Podcast channel'
        using errcode = '23514';
    end if;
  else
    if new.donation_enabled and not old.donation_enabled then
      select count(*) into qualifying_reel_count
      from public.studio_videos v
      where v.channel_id = new.id
        and v.user_id = new.user_id
        and v.is_reel = true
        and v.duration >= 90;

      if qualifying_reel_count < 10 then
        raise exception 'Live donations require at least 10 Reels of 90 seconds or longer'
          using errcode = '23514';
      end if;
    end if;

    if new.subscription_enabled and not old.subscription_enabled and not exists (
      select 1
      from public.studio_show_applications a
      where a.channel_id = new.id
        and a.applicant_id = new.user_id
        and a.status = 'approved'
        and a.approved_show_id is not null
    ) then
      raise exception 'Series subscriptions require an approved Podcast channel'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists studio_channels_monetization_eligibility_insert on public.studio_channels;
create trigger studio_channels_monetization_eligibility_insert
  before insert on public.studio_channels
  for each row execute function public.enforce_studio_channel_monetization_eligibility();

drop trigger if exists studio_channels_monetization_eligibility_update on public.studio_channels;
create trigger studio_channels_monetization_eligibility_update
  before update of donation_enabled, subscription_enabled on public.studio_channels
  for each row execute function public.enforce_studio_channel_monetization_eligibility();

revoke all on function public.enforce_studio_channel_monetization_eligibility() from public, anon, authenticated;

update public.studio_channels c
set donation_enabled = false
where c.donation_enabled = true
  and (
    select count(*)
    from public.studio_videos v
    where v.channel_id = c.id
      and v.user_id = c.user_id
      and v.is_reel = true
      and v.duration >= 90
  ) < 10;

update public.studio_channels c
set subscription_enabled = false
where c.subscription_enabled = true
  and not exists (
    select 1
    from public.studio_show_applications a
    where a.channel_id = c.id
      and a.applicant_id = c.user_id
      and a.status = 'approved'
      and a.approved_show_id is not null
  );
