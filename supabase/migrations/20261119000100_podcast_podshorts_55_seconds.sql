alter table public.creator_podcast_podshorts
  alter column duration_seconds set default 55,
  drop constraint if exists creator_podcast_podshorts_duration_seconds_check;

alter table public.creator_podcast_podshorts
  add constraint creator_podcast_podshorts_duration_seconds_check
  check (duration_seconds in (30, 55));

notify pgrst, 'reload schema';
