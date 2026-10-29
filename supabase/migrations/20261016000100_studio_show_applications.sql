alter table public.studio_videos
  add column if not exists is_reel boolean not null default true;

create table if not exists public.studio_show_applications (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.studio_channels(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  show_title text not null check (char_length(trim(show_title)) between 2 and 100),
  description text not null check (char_length(trim(description)) between 10 and 1200),
  category text not null,
  format text not null check (format in ('recorded', 'live', 'mixed')),
  co_host_credits text[] not null default '{}',
  preferred_days text[] not null default '{}',
  preferred_time text,
  timezone text not null default 'UTC',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_show_id uuid references public.studio_shows(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_show_applications_channel_created_idx
  on public.studio_show_applications (channel_id, created_at desc);

create index if not exists studio_show_applications_status_created_idx
  on public.studio_show_applications (status, created_at asc);

create unique index if not exists studio_show_applications_one_pending_per_channel_idx
  on public.studio_show_applications (channel_id)
  where status = 'pending';

alter table public.studio_show_applications enable row level security;

grant select, insert on public.studio_show_applications to authenticated;
revoke update on public.studio_show_applications from public, anon, authenticated;

drop policy if exists "Applicants and admins can read show applications" on public.studio_show_applications;
create policy "Applicants and admins can read show applications"
  on public.studio_show_applications
  for select
  to authenticated
  using (
    applicant_id = auth.uid()
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.privilege in ('admin', 'superadmin')
    )
  );

drop policy if exists "Creators can apply for their own Studio channel" on public.studio_show_applications;
create policy "Creators can apply for their own Studio channel"
  on public.studio_show_applications
  for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.studio_channels c
      where c.id = channel_id
        and c.user_id = auth.uid()
    )
  );

create or replace function public.enforce_studio_show_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  published_video_count integer;
  channel_subscriber_count integer;
begin
  if not exists (
    select 1
    from public.studio_channels c
    where c.id = new.channel_id
      and c.user_id = new.applicant_id
  ) then
    raise exception 'Application must belong to the applicant''s Studio channel'
      using errcode = '42501';
  end if;

  select count(*)::integer into published_video_count
  from public.studio_videos v
  where v.channel_id = new.channel_id
    and v.user_id = new.applicant_id
    and v.is_reel = true;

  select count(*)::integer into channel_subscriber_count
  from public.studio_channel_subscribers s
  where s.channel_id = new.channel_id;

  if published_video_count < 10 or channel_subscriber_count < 1 then
    raise exception 'A Studio channel needs at least 10 published videos and 1 subscriber to apply'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists studio_show_application_eligibility on public.studio_show_applications;
create trigger studio_show_application_eligibility
  before insert on public.studio_show_applications
  for each row execute function public.enforce_studio_show_application_eligibility();

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
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.privilege in ('admin', 'superadmin')
  ) then
    raise exception 'Only Studio administrators can review show applications'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '22023';
  end if;

  select * into application_row
  from public.studio_show_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Show application not found'
      using errcode = 'P0002';
  end if;

  if application_row.status <> 'pending' then
    raise exception 'Only pending applications can be reviewed'
      using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    insert into public.studio_shows (
      title,
      description,
      video_url,
      duration,
      scheduled_time,
      end_time,
      is_live,
      is_active,
      created_by,
      category,
      show_type
    ) values (
      application_row.show_title,
      application_row.description,
      '',
      0,
      now(),
      null,
      false,
      false,
      application_row.applicant_id,
      application_row.category,
      'show'
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

revoke all on function public.review_studio_show_application(uuid, text, text) from public, anon;
grant execute on function public.review_studio_show_application(uuid, text, text) to authenticated;

revoke all on function public.enforce_studio_show_application_eligibility() from public, anon, authenticated;