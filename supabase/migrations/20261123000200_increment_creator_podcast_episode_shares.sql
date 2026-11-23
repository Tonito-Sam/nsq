alter table public.studio_episodes
  add column if not exists shares integer not null default 0;

create or replace function public.increment_studio_episode_shares(p_episode_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_shares integer;
begin
  update public.studio_episodes
  set shares = coalesce(shares, 0) + 1,
      updated_at = now()
  where id = p_episode_id
    and is_active = true
    and public.can_view_creator_podcast_episode(id)
  returning shares into updated_shares;

  if updated_shares is null then
    raise exception 'Episode not found, inactive, or unavailable to this user';
  end if;

  return updated_shares;
end;
$$;

revoke all on function public.increment_studio_episode_shares(uuid) from public, anon;
grant execute on function public.increment_studio_episode_shares(uuid) to authenticated;

notify pgrst, 'reload schema';
