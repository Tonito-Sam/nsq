alter table public.studio_videos
  add column if not exists download_count bigint not null default 0;

create or replace function public.increment_studio_video_downloads(p_video_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count bigint;
begin
  update public.studio_videos
    set download_count = coalesce(download_count, 0) + 1
    where id = p_video_id
    returning download_count into updated_count;

  if updated_count is null then
    raise exception 'Video not found';
  end if;

  return updated_count;
end;
$$;

revoke all on function public.increment_studio_video_downloads(uuid) from public;
grant execute on function public.increment_studio_video_downloads(uuid) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'studio_videos'
     ) then
    alter publication supabase_realtime add table public.studio_videos;
  end if;
end;
$$;
