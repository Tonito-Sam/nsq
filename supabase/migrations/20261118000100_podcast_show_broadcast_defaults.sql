alter table public.studio_podcast_branding
  add column if not exists intro_url text,
  add column if not exists outro_url text;

create or replace function public.update_studio_podcast_broadcast_defaults(
  p_show_id uuid,
  p_intro_url text,
  p_outro_url text
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

  insert into public.studio_podcast_branding (show_id, intro_url, outro_url, updated_at)
  values (p_show_id, p_intro_url, p_outro_url, now())
  on conflict (show_id) do update
  set intro_url = excluded.intro_url,
      outro_url = excluded.outro_url,
      updated_at = now();
end;
$$;

revoke all on function public.update_studio_podcast_broadcast_defaults(uuid, text, text) from public, anon;
grant execute on function public.update_studio_podcast_broadcast_defaults(uuid, text, text) to authenticated;
