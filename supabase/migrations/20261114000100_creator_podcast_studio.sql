create table if not exists public.creator_podcast_drafts (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.studio_channels(id) on delete cascade,
  application_id uuid references public.studio_show_applications(id) on delete set null,
  show_id uuid references public.studio_shows(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 120),
  topic text not null default '' check (char_length(topic) <= 500),
  target_duration_minutes integer not null default 10 check (target_duration_minutes between 10 and 60),
  description text not null default '' check (char_length(description) <= 1200),
  script text not null default '' check (char_length(script) <= 40000),
  host_names text not null default '' check (char_length(host_names) <= 120),
  recording_path text,
  cover_image_path text,
  logo_image_path text,
  intro_video_path text,
  outro_video_path text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'changes_requested', 'published')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  episode_id uuid references public.studio_episodes(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_podcast_drafts_owner_updated_idx
  on public.creator_podcast_drafts (owner_id, updated_at desc);
create index if not exists creator_podcast_drafts_review_queue_idx
  on public.creator_podcast_drafts (submitted_at asc)
  where status = 'pending_review';

alter table public.creator_podcast_drafts enable row level security;
grant select on public.creator_podcast_drafts to authenticated;
revoke insert, update, delete on public.creator_podcast_drafts from public, anon, authenticated;

drop policy if exists "Creators and admins can read podcast drafts" on public.creator_podcast_drafts;
create policy "Creators and admins can read podcast drafts"
  on public.creator_podcast_drafts
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-podcast-drafts',
  'creator-podcast-drafts',
  false,
  536870912,
  array['video/webm', 'video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists creator_podcast_files_insert_own on storage.objects;
create policy creator_podcast_files_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'creator-podcast-drafts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists creator_podcast_files_read_owner_admin on storage.objects;
create policy creator_podcast_files_read_owner_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'creator-podcast-drafts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
      )
    )
  );

drop policy if exists creator_podcast_files_update_own on storage.objects;
create policy creator_podcast_files_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'creator-podcast-drafts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'creator-podcast-drafts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists creator_podcast_files_delete_owner_admin on storage.objects;
create policy creator_podcast_files_delete_owner_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'creator-podcast-drafts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
      )
    )
  );

create or replace function public.creator_can_use_podcast_studio()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.studio_channels c
    where c.user_id = auth.uid()
      and (
        select count(*) from public.studio_videos v
        where v.channel_id = c.id and v.user_id = auth.uid() and v.is_reel = true
      ) >= 10
      and exists (
        select 1 from public.studio_channel_subscribers s
        where s.channel_id = c.id
      )
  );
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
    raise exception 'A Studio channel needs at least 10 reels and 1 subscriber to use Podcast Studio'
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
  order by c.created_at asc
  limit 1;
  if not found then raise exception 'Studio channel not found' using errcode = 'P0002'; end if;
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

create or replace function public.submit_creator_podcast_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  draft_row public.creator_podcast_drafts%rowtype;
  application_row public.studio_show_applications%rowtype;
begin
  if auth.uid() is null or not public.creator_can_use_podcast_studio() then
    raise exception 'A qualifying Studio channel is required to submit a podcast'
      using errcode = '42501';
  end if;

  select * into draft_row
  from public.creator_podcast_drafts
  where id = p_draft_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'Podcast draft not found' using errcode = 'P0002'; end if;
  if draft_row.status not in ('draft', 'changes_requested') then
    raise exception 'Only a draft or returned podcast can be submitted'
      using errcode = '55000';
  end if;
  if nullif(trim(draft_row.recording_path), '') is null then
    raise exception 'Record and save the podcast before submitting it'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'creator-podcast-drafts'
      and o.name = draft_row.recording_path
      and split_part(o.name, '/', 1) = auth.uid()::text
  ) then
    raise exception 'The private podcast recording is missing; record it again before submitting'
      using errcode = '23514';
  end if;
  if nullif(trim(draft_row.script), '') is null then
    raise exception 'Add a script before submitting the podcast'
      using errcode = '23514';
  end if;

  select * into application_row
  from public.studio_show_applications
  where applicant_id = auth.uid()
    and status = 'approved'
    and approved_show_id is not null
  order by reviewed_at desc nulls last, created_at desc
  limit 1;
  if not found then
    raise exception 'An approved TV show application is required before submitting this podcast'
      using errcode = '23514';
  end if;

  update public.creator_podcast_drafts
  set application_id = application_row.id,
      show_id = application_row.approved_show_id,
      status = 'pending_review',
      reviewer_notes = null,
      submitted_at = now(),
      updated_at = now()
  where id = p_draft_id;
end;
$$;

create or replace function public.review_creator_podcast_draft(
  p_draft_id uuid,
  p_decision text,
  p_video_url text default null,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  draft_row public.creator_podcast_drafts%rowtype;
  created_episode_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Only Studio administrators can review creator podcasts'
      using errcode = '42501';
  end if;
  if p_decision not in ('publish', 'changes_requested') then
    raise exception 'Decision must be publish or changes_requested'
      using errcode = '22023';
  end if;
  if p_decision = 'changes_requested' and nullif(trim(p_reviewer_notes), '') is null then
    raise exception 'Add a review note when requesting changes'
      using errcode = '22023';
  end if;
  if p_decision = 'publish' and nullif(trim(p_video_url), '') is null then
    raise exception 'A public episode video URL is required to publish'
      using errcode = '22023';
  end if;

  select * into draft_row
  from public.creator_podcast_drafts
  where id = p_draft_id
  for update;
  if not found or draft_row.status <> 'pending_review' or draft_row.show_id is null then
    raise exception 'Creator podcast is not awaiting review'
      using errcode = '55000';
  end if;

  if p_decision = 'publish' then
    insert into public.studio_episodes (
      show_id, title, description, video_url, thumbnail_url, duration,
      is_active, created_by, created_at, updated_at
    ) values (
      draft_row.show_id, draft_row.title, draft_row.description, trim(p_video_url), null, 0,
      true, draft_row.owner_id, now(), now()
    ) returning id into created_episode_id;
  end if;

  update public.creator_podcast_drafts
  set status = case when p_decision = 'publish' then 'published' else 'changes_requested' end,
      reviewer_notes = nullif(trim(p_reviewer_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      episode_id = created_episode_id,
      updated_at = now()
  where id = p_draft_id;
  return created_episode_id;
end;
$$;

create or replace function public.delete_creator_podcast_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to delete a podcast draft' using errcode = '42501'; end if;
  delete from public.creator_podcast_drafts
  where id = p_draft_id
    and owner_id = auth.uid()
    and status in ('draft', 'changes_requested');
  if not found then
    raise exception 'Only your draft or returned podcast can be deleted'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.creator_can_use_podcast_studio() from public, anon;
revoke all on function public.save_creator_podcast_draft(uuid, text, text, integer, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.submit_creator_podcast_draft(uuid) from public, anon;
revoke all on function public.review_creator_podcast_draft(uuid, text, text, text) from public, anon;
revoke all on function public.delete_creator_podcast_draft(uuid) from public, anon;
grant execute on function public.creator_can_use_podcast_studio() to authenticated;
grant execute on function public.save_creator_podcast_draft(uuid, text, text, integer, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_creator_podcast_draft(uuid) to authenticated;
grant execute on function public.review_creator_podcast_draft(uuid, text, text, text) to authenticated;
grant execute on function public.delete_creator_podcast_draft(uuid) to authenticated;
