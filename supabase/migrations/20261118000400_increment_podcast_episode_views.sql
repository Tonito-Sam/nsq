create or replace function public.increment_studio_episode_views(p_episode_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_views integer;
begin
  update public.studio_episodes
  set views = coalesce(views, 0) + 1,
      last_viewed_at = now(),
      updated_at = now()
  where id = p_episode_id
    and is_active = true
    and public.can_view_creator_podcast_episode(id)
  returning views into updated_views;

  if updated_views is null then
    raise exception 'Episode not found, inactive, or unavailable to this user';
  end if;

  return updated_views;
end;
$$;

revoke all on function public.increment_studio_episode_views(uuid) from public, anon;
grant execute on function public.increment_studio_episode_views(uuid) to authenticated;

notify pgrst, 'reload schema';
