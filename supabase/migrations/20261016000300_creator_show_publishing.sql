alter table public.studio_shows
  add column if not exists show_source text not null default 'platform'
    check (show_source in ('platform', 'creator')),
  add column if not exists publication_status text not null default 'published'
    check (publication_status in ('draft', 'pending_review', 'published', 'changes_requested')),
  add column if not exists publication_review_notes text,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists publication_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists publication_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

update public.studio_shows s
set show_source = 'creator',
    publication_status = case when s.is_active then 'published' else 'draft' end
from public.studio_show_applications a
where a.approved_show_id = s.id;

create index if not exists studio_shows_creator_publication_idx
  on public.studio_shows (publication_status, submitted_for_review_at asc)
  where show_source = 'creator';

create or replace function public.review_studio_show_application(
  p_application_id uuid,
  p_decision text,
  p_reviewer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_row public.studio_show_applications%rowtype;
  created_show_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Only Studio administrators can review show applications'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into application_row
  from public.studio_show_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Show application not found' using errcode = 'P0002'; end if;
  if application_row.status <> 'pending' then
    raise exception 'Only pending applications can be reviewed' using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    insert into public.studio_shows (
      title, description, video_url, duration, scheduled_time, end_time,
      is_live, is_active, created_by, category, show_type, show_source, publication_status
    ) values (
      application_row.show_title, application_row.description, '', 0, now(), null,
      false, false, application_row.applicant_id, application_row.category, 'show', 'creator', 'draft'
    )
    returning id into created_show_id;
  end if;

  update public.studio_show_applications
  set status = p_decision,
      reviewer_notes = nullif(trim(p_reviewer_notes), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      approved_show_id = created_show_id,
      updated_at = now()
  where id = p_application_id;

  return created_show_id;
end;
$$;

create or replace function public.update_studio_show_management(
  p_show_id uuid, p_title text, p_description text, p_category text,
  p_thumbnail_url text, p_logo_url text, p_banner_url text, p_brand_color text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_publication_status text;
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

  select publication_status into current_publication_status
  from public.studio_shows where id = p_show_id for update;
  if not found then raise exception 'TV show not found' using errcode = 'P0002'; end if;
  if current_publication_status = 'pending_review' then
    raise exception 'This show is waiting for publication review' using errcode = '55000';
  end if;

  update public.studio_shows
  set title = trim(p_title), description = trim(p_description), category = trim(p_category),
      thumbnail_url = p_thumbnail_url, logo_url = p_logo_url, banner_url = p_banner_url,
      brand_color = p_brand_color,
      publication_status = case when publication_status = 'changes_requested' then 'draft' else publication_status end,
      publication_review_notes = case when publication_status = 'changes_requested' then null else publication_review_notes end,
      updated_at = now()
  where id = p_show_id;
end;
$$;

create or replace function public.submit_studio_show_for_review(p_show_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  show_row public.studio_shows%rowtype;
  episode_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.studio_show_applications a
    where a.approved_show_id = p_show_id
      and a.applicant_id = auth.uid()
      and a.status = 'approved'
  ) then
    raise exception 'Only the approved show owner can submit for publication' using errcode = '42501';
  end if;

  select * into show_row from public.studio_shows where id = p_show_id for update;
  if not found or show_row.show_source <> 'creator' then
    raise exception 'Creator TV show not found' using errcode = 'P0002';
  end if;
  if show_row.publication_status not in ('draft', 'changes_requested') then
    raise exception 'This show is not ready for a new publication review' using errcode = '55000';
  end if;
  if char_length(trim(show_row.title)) not between 2 and 100
    or char_length(trim(show_row.description)) not between 10 and 1200
    or nullif(trim(show_row.category), '') is null then
    raise exception 'Complete the show title, synopsis, and category before submitting' using errcode = '23514';
  end if;

  select count(*)::integer into episode_count
  from public.studio_episodes e where e.show_id = p_show_id;
  if episode_count < 1 then
    raise exception 'Upload at least one episode before submitting for publication' using errcode = '23514';
  end if;

  update public.studio_shows
  set publication_status = 'pending_review',
      publication_review_notes = null,
      submitted_for_review_at = now(),
      is_active = false,
      updated_at = now()
  where id = p_show_id;
end;
$$;

create or replace function public.review_studio_show_publication(
  p_show_id uuid,
  p_decision text,
  p_reviewer_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Only Studio administrators can publish creator shows' using errcode = '42501';
  end if;
  if p_decision not in ('publish', 'changes_requested') then
    raise exception 'Decision must be publish or changes_requested' using errcode = '22023';
  end if;
  if p_decision = 'changes_requested' and nullif(trim(p_reviewer_notes), '') is null then
    raise exception 'Add a review note when requesting changes' using errcode = '22023';
  end if;

  update public.studio_shows
  set publication_status = case when p_decision = 'publish' then 'published' else 'changes_requested' end,
      publication_review_notes = nullif(trim(p_reviewer_notes), ''),
      publication_reviewed_by = auth.uid(),
      publication_reviewed_at = now(),
      published_at = case when p_decision = 'publish' then now() else published_at end,
      is_active = (p_decision = 'publish'),
      updated_at = now()
  where id = p_show_id
    and show_source = 'creator'
    and publication_status = 'pending_review';

  if not found then
    raise exception 'Creator show is not awaiting publication review' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.submit_studio_show_for_review(uuid) from public, anon, authenticated;
revoke all on function public.review_studio_show_publication(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_studio_show_for_review(uuid) to authenticated;
grant execute on function public.review_studio_show_publication(uuid, text, text) to authenticated;