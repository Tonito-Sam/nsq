drop policy if exists "Anyone can view published creator TV shows" on public.studio_shows;
create policy "Anyone can view published creator TV shows"
  on public.studio_shows
  for select
  to anon, authenticated
  using (
    show_source = 'creator'
    and publication_status = 'published'
    and is_active = true
  );

drop policy if exists "Anyone can view episodes from published creator TV shows" on public.studio_episodes;
create policy "Anyone can view episodes from published creator TV shows"
  on public.studio_episodes
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.studio_shows s
      where s.id = studio_episodes.show_id
        and s.show_source = 'creator'
        and s.publication_status = 'published'
        and s.is_active = true
    )
  );