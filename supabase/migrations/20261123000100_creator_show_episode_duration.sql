drop function if exists public.create_studio_show_episode(uuid, text, text, text, text);

create or replace function public.create_studio_show_episode(
  p_show_id uuid,
  p_title text,
  p_description text,
  p_video_url text,
  p_duration_seconds integer,
  p_thumbnail_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  episode_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = p_show_id and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = p_show_id and m.user_id = auth.uid()
      ))
  ) then
    raise exception 'You are not a manager of this approved show' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_video_url), '') is null then
    raise exception 'Episode title and video are required' using errcode = '22023';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 or p_duration_seconds > 21600 then
    raise exception 'Episode duration must be between 1 second and 6 hours' using errcode = '22023';
  end if;

  insert into public.studio_episodes (
    show_id, title, description, video_url, thumbnail_url, duration,
    is_active, created_by, created_at, updated_at
  ) values (
    p_show_id, trim(p_title), coalesce(p_description, ''), trim(p_video_url), p_thumbnail_url,
    p_duration_seconds, true, auth.uid(), now(), now()
  ) returning id into episode_id;
  return episode_id;
end;
$$;

revoke all on function public.create_studio_show_episode(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.create_studio_show_episode(uuid, text, text, text, integer, text) to authenticated;

notify pgrst, 'reload schema';
