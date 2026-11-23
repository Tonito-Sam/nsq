create or replace function public.set_studio_show_episode_active(
  p_episode_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_show_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage show episodes' using errcode = '42501';
  end if;
  if p_is_active is null then
    raise exception 'Episode publication status is required' using errcode = '22023';
  end if;

  select e.show_id into target_show_id
  from public.studio_episodes e
  where e.id = p_episode_id;
  if not found then
    raise exception 'Episode not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.privilege in ('admin', 'superadmin')
  ) and not exists (
    select 1
    from public.studio_show_applications a
    where a.approved_show_id = target_show_id
      and a.status = 'approved'
      and (
        a.applicant_id = auth.uid()
        or exists (
          select 1
          from public.studio_show_managers m
          where m.show_id = target_show_id
            and m.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'You are not authorized to manage this episode' using errcode = '42501';
  end if;

  update public.studio_episodes
  set is_active = p_is_active,
      updated_at = now()
  where id = p_episode_id;
  if not found then
    raise exception 'Episode not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_studio_show_episode_active(uuid, boolean) from public, anon;
grant execute on function public.set_studio_show_episode_active(uuid, boolean) to authenticated;
