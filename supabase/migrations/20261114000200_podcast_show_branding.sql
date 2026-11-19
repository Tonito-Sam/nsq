create table if not exists public.studio_podcast_branding (
  show_id uuid primary key references public.studio_shows(id) on delete cascade,
  cover_url text,
  logo_url text,
  updated_at timestamptz not null default now()
);

alter table public.studio_podcast_branding enable row level security;
grant select on public.studio_podcast_branding to authenticated;
revoke insert, update, delete on public.studio_podcast_branding from public, anon, authenticated;

drop policy if exists "Approved show teams can read podcast branding" on public.studio_podcast_branding;
create policy "Approved show teams can read podcast branding"
  on public.studio_podcast_branding for select to authenticated
  using (exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = studio_podcast_branding.show_id
      and a.status = 'approved'
      and (a.applicant_id = auth.uid() or exists (
        select 1 from public.studio_show_managers m
        where m.show_id = studio_podcast_branding.show_id and m.user_id = auth.uid()
      ))
  ));

create or replace function public.update_studio_podcast_branding(
  p_show_id uuid,
  p_podcast_cover_url text,
  p_podcast_logo_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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

  insert into public.studio_podcast_branding (show_id, cover_url, logo_url, updated_at)
  values (p_show_id, p_podcast_cover_url, p_podcast_logo_url, now())
  on conflict (show_id) do update
  set cover_url = excluded.cover_url,
      logo_url = excluded.logo_url,
      updated_at = now();
end;
$$;

revoke all on function public.update_studio_podcast_branding(uuid, text, text) from public, anon;
grant execute on function public.update_studio_podcast_branding(uuid, text, text) to authenticated;
