create table if not exists public.creator_podcast_podshorts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  show_id uuid not null references public.studio_shows(id) on delete cascade,
  episode_id uuid not null references public.studio_episodes(id) on delete cascade,
  episode_title text not null,
  clip_index smallint not null check (clip_index between 0 and 2),
  storage_path text not null unique,
  caption text not null check (char_length(caption) <= 180),
  start_seconds integer not null check (start_seconds >= 0),
  duration_seconds integer not null default 30 check (duration_seconds = 30),
  published_video_id uuid references public.studio_videos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_podcast_podshorts_episode_clip_unique unique (episode_id, clip_index),
  constraint creator_podcast_podshorts_storage_path_owner_check
    check (storage_path like owner_id::text || '/podcast-podshorts/' || episode_id::text || '/%')
);

create index if not exists creator_podcast_podshorts_owner_show_idx
  on public.creator_podcast_podshorts (owner_id, show_id, created_at desc);

alter table public.creator_podcast_podshorts enable row level security;
revoke all on public.creator_podcast_podshorts from public, anon, authenticated;
grant select, insert, update, delete on public.creator_podcast_podshorts to authenticated;

drop policy if exists "Podcast owners can manage saved Podshorts"
  on public.creator_podcast_podshorts;
create policy "Podcast owners can manage saved Podshorts"
  on public.creator_podcast_podshorts
  for all
  to authenticated
  using (
    owner_id = auth.uid()
    and public.is_podcast_show_manager(show_id)
  )
  with check (
    owner_id = auth.uid()
    and public.is_podcast_show_manager(show_id)
    and exists (
      select 1
      from public.studio_episodes episode
      where episode.id = creator_podcast_podshorts.episode_id
        and episode.show_id = creator_podcast_podshorts.show_id
    )
  );

notify pgrst, 'reload schema';
