alter table public.studio_episodes
  add column if not exists host_names text not null default '';

update public.studio_episodes e
set host_names = d.host_names
from public.creator_podcast_drafts d
where d.episode_id = e.id
  and d.status = 'published'
  and e.host_names = '';

create or replace function public.publish_creator_podcast_episode(
  p_draft_id uuid,
  p_scheduled_time timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  draft_row public.creator_podcast_drafts%rowtype;
  application_row public.studio_show_applications%rowtype;
  created_episode_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to publish a Podcast episode' using errcode = '28000';
  end if;
  if not public.creator_can_use_podcast_studio() then
    raise exception 'A qualifying Studio channel is required to publish a Podcast episode'
      using errcode = '42501';
  end if;

  select * into draft_row
  from public.creator_podcast_drafts
  where id = p_draft_id
    and owner_id = auth.uid()
  for update;
  if not found then
    raise exception 'Podcast episode draft not found' using errcode = 'P0002';
  end if;
  if draft_row.status not in ('draft', 'changes_requested') or draft_row.episode_id is not null then
    raise exception 'Only an unpublished episode draft can be published' using errcode = '55000';
  end if;
  if nullif(trim(draft_row.recording_path), '') is null
    or nullif(trim(draft_row.script), '') is null then
    raise exception 'Record the episode and add its script before publishing' using errcode = '23514';
  end if;
  if p_scheduled_time is not null and (
    not isfinite(p_scheduled_time)
    or p_scheduled_time <= now()
  ) then
    raise exception 'A scheduled premiere must be in the future' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'creator-podcast-drafts'
      and o.name = draft_row.recording_path
      and split_part(o.name, '/', 1) = auth.uid()::text
  ) then
    raise exception 'The private episode recording is missing; record it again before publishing'
      using errcode = '23514';
  end if;

  select a.* into application_row
  from public.studio_show_applications a
  join public.studio_shows s on s.id = a.approved_show_id
  join public.studio_podcast_branding b on b.show_id = a.approved_show_id
  where a.applicant_id = auth.uid()
    and a.status = 'approved'
    and a.approved_show_id is not null
    and (draft_row.show_id is null or draft_row.show_id = a.approved_show_id)
    and s.show_source = 'creator'
    and s.publication_status = 'published'
    and s.is_active = true
    and b.channel_status = 'active'
  order by a.reviewed_at desc nulls last, a.created_at desc
  limit 1;
  if not found then
    raise exception 'An active Podcast channel linked to a published TV show is required'
      using errcode = '23514';
  end if;

  insert into public.studio_episodes (
    show_id, title, topic, host_names, description, video_url, thumbnail_url, duration,
    scheduled_time, is_active, created_by, created_at, updated_at
  ) values (
    application_row.approved_show_id,
    draft_row.title,
    draft_row.topic,
    draft_row.host_names,
    draft_row.description,
    'podcast-private://' || draft_row.recording_path,
    null,
    0,
    coalesce(p_scheduled_time, now()),
    true,
    auth.uid(),
    now(),
    now()
  ) returning id into created_episode_id;

  update public.creator_podcast_drafts
  set application_id = application_row.id,
      show_id = application_row.approved_show_id,
      status = 'published',
      reviewer_notes = null,
      reviewed_by = null,
      reviewed_at = null,
      submitted_at = now(),
      episode_id = created_episode_id,
      updated_at = now()
  where id = p_draft_id;

  return created_episode_id;
end;
$$;

notify pgrst, 'reload schema';
