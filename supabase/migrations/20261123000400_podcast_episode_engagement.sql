alter table public.studio_episodes
  add column if not exists likes integer not null default 0;

create table if not exists public.studio_episode_likes (
  episode_id uuid not null references public.studio_episodes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (episode_id, user_id)
);

create table if not exists public.studio_episode_comments (
  id bigserial primary key,
  episode_id uuid not null references public.studio_episodes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  comment text not null check (char_length(btrim(comment)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists studio_episode_comments_episode_created_idx
  on public.studio_episode_comments (episode_id, created_at);

alter table public.studio_episode_likes enable row level security;
alter table public.studio_episode_comments enable row level security;

drop policy if exists "Podcast members can read their own episode likes" on public.studio_episode_likes;
create policy "Podcast members can read their own episode likes"
  on public.studio_episode_likes for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.studio_episodes e
      join public.studio_podcast_branding b on b.show_id = e.show_id
      where e.id = episode_id
        and e.is_active = true
        and b.channel_status = 'active'
        and public.can_view_creator_podcast_episode(e.id)
    )
  );

drop policy if exists "Podcast members can read episode comments" on public.studio_episode_comments;
create policy "Podcast members can read episode comments"
  on public.studio_episode_comments for select to authenticated
  using (
    exists (
      select 1
      from public.studio_episodes e
      join public.studio_podcast_branding b on b.show_id = e.show_id
      where e.id = episode_id
        and e.is_active = true
        and b.channel_status = 'active'
        and public.can_view_creator_podcast_episode(e.id)
    )
  );

drop policy if exists "Podcast members can comment on episodes" on public.studio_episode_comments;
create policy "Podcast members can comment on episodes"
  on public.studio_episode_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.studio_episodes e
      join public.studio_podcast_branding b on b.show_id = e.show_id
      where e.id = episode_id
        and e.is_active = true
        and b.channel_status = 'active'
        and public.can_view_creator_podcast_episode(e.id)
    )
  );

revoke all on public.studio_episode_likes from anon, authenticated;
grant select on public.studio_episode_likes to authenticated;
revoke all on public.studio_episode_comments from anon, authenticated;
grant select, insert on public.studio_episode_comments to authenticated;
grant usage, select on sequence public.studio_episode_comments_id_seq to authenticated;

create or replace function public.toggle_studio_episode_like(p_episode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to like this episode' using errcode = '28000';
  end if;

  perform 1
  from public.studio_episodes e
  join public.studio_podcast_branding b on b.show_id = e.show_id
  where e.id = p_episode_id
    and e.is_active = true
    and b.channel_status = 'active'
    and public.can_view_creator_podcast_episode(e.id)
  for update of e;

  if not found then
    raise exception 'Episode not found or unavailable to this subscriber';
  end if;

  delete from public.studio_episode_likes
  where episode_id = p_episode_id
    and user_id = auth.uid();

  if found then
    update public.studio_episodes
    set likes = greatest(coalesce(likes, 0) - 1, 0),
        updated_at = now()
    where id = p_episode_id;
  else
    insert into public.studio_episode_likes (episode_id, user_id)
    values (p_episode_id, auth.uid());
    update public.studio_episodes
    set likes = coalesce(likes, 0) + 1,
        updated_at = now()
    where id = p_episode_id;
  end if;

  select jsonb_build_object(
    'liked', exists (
      select 1
      from public.studio_episode_likes l
      where l.episode_id = p_episode_id
        and l.user_id = auth.uid()
    ),
    'likes_count', coalesce(e.likes, 0)
  )
  into result
  from public.studio_episodes e
  where e.id = p_episode_id;

  return result;
end;
$$;

revoke all on function public.toggle_studio_episode_like(uuid) from public, anon;
grant execute on function public.toggle_studio_episode_like(uuid) to authenticated;

notify pgrst, 'reload schema';
a