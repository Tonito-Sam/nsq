create or replace function public.is_podcast_studio_eligibility_exempt(p_user_id uuid)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_user_id = '0c00e1ba-6893-4b6f-a3ad-164e7d96b3b0'::uuid;
$$;

revoke all on function public.is_podcast_studio_eligibility_exempt(uuid) from public, anon, authenticated;

create or replace function public.creator_can_use_podcast_studio()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    public.is_podcast_studio_eligibility_exempt(auth.uid())
    or exists (
      select 1
      from public.studio_show_applications a
      join public.studio_channels c on c.id = a.channel_id
      where a.applicant_id = auth.uid()
        and c.user_id = auth.uid()
        and a.status = 'approved'
        and a.approved_show_id is not null
    )
    or exists (
      select 1
      from public.studio_channels c
      where c.user_id = auth.uid()
        and (
          select count(*) from public.studio_videos v
          where v.channel_id = c.id
            and v.user_id = auth.uid()
            and v.is_reel = true
            and v.duration <= 360
        ) >= 50
        and (
          select count(*) from public.studio_channel_subscribers s
          where s.channel_id = c.id
        ) >= 20
    )
  );
$$;

create or replace function public.enforce_studio_show_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  published_video_count integer;
  channel_subscriber_count integer;
begin
  if not exists (
    select 1
    from public.studio_channels c
    where c.id = new.channel_id
      and c.user_id = new.applicant_id
  ) then
    raise exception 'Application must belong to the applicant''s Studio channel'
      using errcode = '42501';
  end if;

  select count(*)::integer into published_video_count
  from public.studio_videos v
  where v.channel_id = new.channel_id
    and v.user_id = new.applicant_id
    and v.is_reel = true
    and v.duration <= 360;

  select count(*)::integer into channel_subscriber_count
  from public.studio_channel_subscribers s
  where s.channel_id = new.channel_id;

  if (published_video_count < 50 or channel_subscriber_count < 20)
    and not public.is_podcast_studio_eligibility_exempt(new.applicant_id) then
    raise exception 'A Studio channel needs at least 50 Reels of 360 seconds or less and 20 subscribers to apply'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.save_creator_podcast_draft(
  p_id uuid,
  p_title text,
  p_topic text,
  p_target_duration_minutes integer,
  p_description text,
  p_script text,
  p_host_names text,
  p_recording_path text,
  p_cover_image_path text,
  p_logo_image_path text,
  p_intro_video_path text,
  p_outro_video_path text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  channel_row public.studio_channels%rowtype;
  next_channel_id uuid;
  asset_path text;
begin
  if auth.uid() is null or not public.creator_can_use_podcast_studio() then
    raise exception 'Podcast Studio requires an approved Podcast or a Studio channel with at least 50 Reels of 360 seconds or less and 20 subscribers'
      using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
    or char_length(coalesce(p_topic, '')) > 500
    or coalesce(p_target_duration_minutes, 0) not between 10 and 60
    or char_length(coalesce(p_description, '')) > 1200
    or char_length(coalesce(p_script, '')) > 40000
    or char_length(coalesce(p_host_names, '')) > 120 then
    raise exception 'Podcast title, description, script, or host names are invalid'
      using errcode = '22023';
  end if;

  select c.* into channel_row
  from public.studio_channels c
  where c.user_id = auth.uid()
    and (
      exists (
        select 1
        from public.studio_show_applications a
        where a.channel_id = c.id
          and a.applicant_id = auth.uid()
          and a.status = 'approved'
          and a.approved_show_id is not null
      )
      or public.is_podcast_studio_eligibility_exempt(auth.uid())
      or (
        (
          select count(*) from public.studio_videos v
          where v.channel_id = c.id
            and v.user_id = auth.uid()
            and v.is_reel = true
            and v.duration <= 360
        ) >= 50
        and (
          select count(*) from public.studio_channel_subscribers s
          where s.channel_id = c.id
        ) >= 20
      )
    )
  order by case when exists (
    select 1
    from public.studio_show_applications a
    where a.channel_id = c.id
      and a.applicant_id = auth.uid()
      and a.status = 'approved'
      and a.approved_show_id is not null
  ) then 0 else 1 end, c.created_at asc
  limit 1;
  if not found then raise exception 'Eligible Studio channel not found' using errcode = 'P0002'; end if;
  next_channel_id := channel_row.id;

  foreach asset_path in array array[
    p_recording_path,
    p_cover_image_path,
    p_logo_image_path,
    p_intro_video_path,
    p_outro_video_path
  ] loop
    if asset_path is not null and (
      split_part(asset_path, '/', 1) <> auth.uid()::text
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'creator-podcast-drafts' and o.name = asset_path
      )
    ) then
      raise exception 'Podcast media must be uploaded to your private draft folder'
        using errcode = '42501';
    end if;
  end loop;

  if exists (
    select 1 from public.creator_podcast_drafts d
    where d.id = p_id and d.owner_id = auth.uid()
  ) then
    update public.creator_podcast_drafts
    set title = trim(p_title),
        topic = coalesce(p_topic, ''),
        target_duration_minutes = p_target_duration_minutes,
        description = coalesce(p_description, ''),
        script = coalesce(p_script, ''),
        host_names = coalesce(p_host_names, ''),
        recording_path = p_recording_path,
        cover_image_path = p_cover_image_path,
        logo_image_path = p_logo_image_path,
        intro_video_path = p_intro_video_path,
        outro_video_path = p_outro_video_path,
        status = 'draft',
        reviewer_notes = null,
        updated_at = now()
    where id = p_id
      and owner_id = auth.uid()
      and status in ('draft', 'changes_requested');
    if not found then
      raise exception 'Only your draft or returned podcast can be edited'
        using errcode = '55000';
    end if;
  else
    insert into public.creator_podcast_drafts (
      id, owner_id, channel_id, title, topic, target_duration_minutes, description, script, host_names,
      recording_path, cover_image_path, logo_image_path, intro_video_path, outro_video_path
    ) values (
      p_id, auth.uid(), next_channel_id, trim(p_title), coalesce(p_topic, ''),
      p_target_duration_minutes, coalesce(p_description, ''),
      coalesce(p_script, ''), coalesce(p_host_names, ''), p_recording_path,
      p_cover_image_path, p_logo_image_path, p_intro_video_path, p_outro_video_path
    );
  end if;
  return p_id;
end;
$$;
