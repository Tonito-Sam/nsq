drop function if exists public.review_studio_show_publication(uuid, text, text[], text);

create or replace function public.review_studio_show_publication(
  p_show_id uuid,
  p_decision text,
  p_approved_days text[],
  p_time_slot_start time,
  p_time_slot_end time,
  p_reviewer_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_days text[];
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

  select coalesce(a.preferred_days, '{}') into requested_days
  from public.studio_show_applications a
  where a.approved_show_id = p_show_id and a.status = 'approved'
  limit 1;
  if not found then
    raise exception 'Approved creator application not found' using errcode = 'P0002';
  end if;

  if p_decision = 'publish' then
    if coalesce(cardinality(p_approved_days), 0) = 0 then
      raise exception 'Approve at least one requested broadcast day before publishing' using errcode = '22023';
    end if;
    if p_time_slot_start is null or p_time_slot_end is null or p_time_slot_start = p_time_slot_end then
      raise exception 'Set a valid broadcast start and end time before publishing' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(p_approved_days) as selected_day(day)
      where day not in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    ) then
      raise exception 'Approved broadcast days must be valid weekdays' using errcode = '22023';
    end if;
    if not (p_approved_days <@ requested_days) then
      raise exception 'Approved broadcast days must be selected by the creator' using errcode = '22023';
    end if;
  end if;

  update public.studio_shows
  set publication_status = case when p_decision = 'publish' then 'published' else 'changes_requested' end,
      publication_review_notes = nullif(trim(p_reviewer_notes), ''),
      publication_reviewed_by = auth.uid(),
      publication_reviewed_at = now(),
      published_at = case when p_decision = 'publish' then now() else published_at end,
      approved_days = case when p_decision = 'publish' then p_approved_days else approved_days end,
      days_of_week = case when p_decision = 'publish' then p_approved_days else days_of_week end,
      time_slot_start = case when p_decision = 'publish' then p_time_slot_start else time_slot_start end,
      time_slot_end = case when p_decision = 'publish' then p_time_slot_end else time_slot_end end,
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

revoke all on function public.review_studio_show_publication(uuid, text, text[], time, time, text) from public, anon;
grant execute on function public.review_studio_show_publication(uuid, text, text[], time, time, text) to authenticated;