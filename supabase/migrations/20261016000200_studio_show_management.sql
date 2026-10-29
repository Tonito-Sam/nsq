alter table public.studio_shows
  add column if not exists logo_url text,
  add column if not exists banner_url text,
  add column if not exists brand_color text;

create table if not exists public.studio_show_managers (
  show_id uuid not null references public.studio_shows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (show_id, user_id)
);

alter table public.studio_show_managers enable row level security;
grant select on public.studio_show_managers to authenticated;

drop policy if exists "Show managers can read their own membership" on public.studio_show_managers;
create policy "Show managers can read their own membership"
  on public.studio_show_managers for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Approved show managers can read applications" on public.studio_show_applications;
create policy "Approved show managers can read applications"
  on public.studio_show_applications for select to authenticated
  using (exists (
    select 1 from public.studio_show_managers m
    where m.show_id = approved_show_id and m.user_id = auth.uid()
  ));

drop policy if exists "Approved show teams can read their show" on public.studio_shows;
create policy "Approved show teams can read their show"
  on public.studio_shows for select to authenticated
  using (exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = studio_shows.id and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = studio_shows.id and m.user_id = auth.uid()
      ))
  ));

drop policy if exists "Approved show teams can read their episodes" on public.studio_episodes;
create policy "Approved show teams can read their episodes"
  on public.studio_episodes for select to authenticated
  using (exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = studio_episodes.show_id and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = studio_episodes.show_id and m.user_id = auth.uid()
      ))
  ));

create or replace function public.get_studio_show_managers(p_show_id uuid)
returns table(manager_id uuid, username text, avatar_url text, added_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
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

  return query
  select m.user_id, coalesce(u.username, 'NexSq user'), u.avatar_url, m.created_at
  from public.studio_show_managers m
  left join public.users u on u.id = m.user_id
  where m.show_id = p_show_id order by m.created_at asc;
end;
$$;

create or replace function public.add_studio_show_manager(p_show_id uuid, p_username text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  manager_user_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = p_show_id and a.applicant_id = auth.uid() and a.status = 'approved'
  ) then
    raise exception 'Only the approved show owner can add managers' using errcode = '42501';
  end if;

  select u.id into manager_user_id from public.users u
  where lower(u.username) = lower(trim(both '@' from trim(p_username))) limit 1;
  if manager_user_id is null then
    raise exception 'No registered NexSq user was found with that username' using errcode = 'P0002';
  end if;
  if manager_user_id = auth.uid() then
    raise exception 'The show owner is already a show manager' using errcode = '22023';
  end if;

  insert into public.studio_show_managers (show_id, user_id, invited_by)
  values (p_show_id, manager_user_id, auth.uid()) on conflict (show_id, user_id) do nothing;
  return manager_user_id;
end;
$$;

create or replace function public.remove_studio_show_manager(p_show_id uuid, p_manager_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = p_show_id and a.applicant_id = auth.uid() and a.status = 'approved'
  ) then
    raise exception 'Only the approved show owner can remove managers' using errcode = '42501';
  end if;
  delete from public.studio_show_managers where show_id = p_show_id and user_id = p_manager_id;
end;
$$;

create or replace function public.update_studio_show_management(
  p_show_id uuid, p_title text, p_description text, p_category text,
  p_thumbnail_url text, p_logo_url text, p_banner_url text, p_brand_color text
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
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
  if char_length(trim(p_title)) not between 2 and 100
    or char_length(trim(p_description)) not between 10 and 1200
    or nullif(trim(p_category), '') is null then
    raise exception 'Show title, synopsis, or category is invalid' using errcode = '22023';
  end if;

  update public.studio_shows
  set title = trim(p_title), description = trim(p_description), category = trim(p_category),
      thumbnail_url = p_thumbnail_url, logo_url = p_logo_url, banner_url = p_banner_url,
      brand_color = p_brand_color, updated_at = now()
  where id = p_show_id;
  if not found then raise exception 'TV show not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.create_studio_show_episode(
  p_show_id uuid, p_title text, p_description text, p_video_url text, p_thumbnail_url text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
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

  insert into public.studio_episodes (
    show_id, title, description, video_url, thumbnail_url, duration,
    is_active, created_by, created_at, updated_at
  ) values (
    p_show_id, trim(p_title), coalesce(p_description, ''), trim(p_video_url), p_thumbnail_url,
    0, true, auth.uid(), now(), now()
  ) returning id into episode_id;
  return episode_id;
end;
$$;

create or replace function public.delete_studio_show_episode(p_episode_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  target_show_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to manage show episodes' using errcode = '42501'; end if;
  select e.show_id into target_show_id from public.studio_episodes e where e.id = p_episode_id;
  if target_show_id is null then raise exception 'Episode not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = target_show_id and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = target_show_id and m.user_id = auth.uid()
      ))
  ) then
    raise exception 'You are not a manager of this approved show' using errcode = '42501';
  end if;
  delete from public.studio_episodes where id = p_episode_id;
end;
$$;

revoke all on function public.get_studio_show_managers(uuid) from public, anon;
revoke all on function public.add_studio_show_manager(uuid, text) from public, anon;
revoke all on function public.remove_studio_show_manager(uuid, uuid) from public, anon;
revoke all on function public.update_studio_show_management(uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.create_studio_show_episode(uuid, text, text, text, text) from public, anon;
revoke all on function public.delete_studio_show_episode(uuid) from public, anon;

grant execute on function public.get_studio_show_managers(uuid) to authenticated;
grant execute on function public.add_studio_show_manager(uuid, text) to authenticated;
grant execute on function public.remove_studio_show_manager(uuid, uuid) to authenticated;
grant execute on function public.update_studio_show_management(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_studio_show_episode(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_studio_show_episode(uuid) to authenticated;