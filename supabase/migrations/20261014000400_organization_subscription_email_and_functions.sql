begin;

alter table public.organization_subscription_invoice_schedule
  add column if not exists email_claim_token uuid,
  add column if not exists email_delivery_status text not null default 'pending'
    check (email_delivery_status in ('pending', 'sent', 'failed'));

update public.organization_subscription_invoice_schedule
set email_delivery_status = case
  when email_sent_at is not null then 'sent'
  when email_attempt_count >= 8 then 'failed'
  else 'pending'
end;

create index if not exists idx_org_subscription_invoice_pending_delivery
  on public.organization_subscription_invoice_schedule (due_at, next_email_attempt_at)
  where email_delivery_status = 'pending';

create or replace function public.accept_organization_subscription_contract(
  p_plan_code text,
  p_terms_version text,
  p_accepted boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_role text;
  v_privilege text;
  v_name text;
  v_email text;
  v_plan_name text;
  v_monthly_amount numeric(10, 2);
  v_started_at timestamptz := now();
  v_contract_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to accept an organization agreement';
  end if;

  if p_terms_version is distinct from '2026-10-13-v1' then
    raise exception 'The agreement version is invalid or outdated';
  end if;

  if p_accepted is distinct from true then
    raise exception 'Explicit agreement acceptance is required';
  end if;

  select
    p.organization_id,
    lower(coalesce(p.role, '')),
    lower(coalesce(p.privilege, '')),
    trim(concat_ws(' ', p.first_name, p.last_name)),
    coalesce(nullif(p.email, ''), auth.jwt() ->> 'email', '')
  into v_organization_id, v_role, v_privilege, v_name, v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_organization_id is null then
    raise exception 'Your account must belong to an organization before signing';
  end if;

  if v_role not in ('admin', 'owner', 'organization_admin', 'superadmin')
     and v_privilege not in ('admin', 'owner', 'organization_admin', 'superadmin') then
    raise exception 'Only an organization administrator can accept this agreement';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_organization_id::text, 0));

  case upper(p_plan_code)
    when 'STARTER' then v_plan_name := 'Starter'; v_monthly_amount := 99.99;
    when 'GROWTH' then v_plan_name := 'Growth'; v_monthly_amount := 199.00;
    when 'SCALE' then v_plan_name := 'Scale'; v_monthly_amount := 399.00;
    when 'BUSINESS' then v_plan_name := 'Business'; v_monthly_amount := 699.00;
    when 'CORPORATE' then v_plan_name := 'Corporate'; v_monthly_amount := 999.00;
    when 'ENTERPRISE' then v_plan_name := 'Enterprise'; v_monthly_amount := 1499.00;
    else raise exception 'The selected plan cannot be purchased online';
  end case;

  update public.organization_subscription_contracts
  set status = 'completed'
  where organization_id = v_organization_id
    and status = 'accepted'
    and contract_ends_at <= v_started_at;

  if exists (
    select 1
    from public.organization_subscription_contracts
    where organization_id = v_organization_id
      and status = 'accepted'
  ) then
    raise exception 'This organization already has an active 12-month agreement';
  end if;

  insert into public.organization_subscription_contracts (
    organization_id,
    accepted_by,
    accepted_name,
    accepted_email,
    plan_code,
    plan_name,
    monthly_amount,
    contract_started_at,
    free_access_ends_at,
    billing_starts_at,
    contract_ends_at,
    terms_version,
    terms_text
  ) values (
    v_organization_id,
    v_user_id,
    coalesce(nullif(v_name, ''), v_email),
    v_email,
    upper(p_plan_code),
    v_plan_name,
    v_monthly_amount,
    v_started_at,
    v_started_at + interval '6 months',
    v_started_at + interval '6 months',
    v_started_at + interval '12 months',
    p_terms_version,
    'ERANOIDS Organization Subscription Agreement ' || p_terms_version || E'\n\n'
      || 'The authorized organization representative selects the ' || v_plan_name || ' plan at USD '
      || to_char(v_monthly_amount, 'FM999999990.00') || ' per month. The initial contract term is twelve consecutive months beginning when accepted. Subscription fees are waived for months 1 through 6. No payment is collected when this agreement is signed. Six monthly invoices, each for the agreed monthly amount, are scheduled for months 7 through 12. Invoices are issued for payment when each installment falls due; this agreement does not authorize automatic charges. The signer confirms authority to bind the organization and agrees to the ERANOIDS Terms of Service.'
  )
  returning id into v_contract_id;

  return v_contract_id;
end;
$$;

drop function if exists public.claim_due_organization_subscription_invoices(integer);
create function public.claim_due_organization_subscription_invoices(p_limit integer default 50)
returns table (
  invoice_id uuid,
  claim_token uuid,
  invoice_reference text,
  installment_number integer,
  amount_due numeric,
  currency text,
  due_at date,
  email text,
  contact_name text,
  plan_name text,
  organization_name text,
  email_attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organization_subscription_invoice_schedule invoice
  set email_delivery_status = 'failed',
      email_claimed_at = null,
      email_claim_token = null,
      next_email_attempt_at = 'infinity'::timestamptz,
      email_last_error = coalesce(invoice.email_last_error, 'Maximum invoice email attempts exhausted')
  where invoice.email_delivery_status = 'pending'
    and invoice.email_sent_at is null
    and invoice.email_attempt_count >= 8
    and (
      invoice.email_claimed_at is null
      or invoice.email_claimed_at < now() - interval '30 minutes'
    );

  return query
  with due_invoices as (
    select invoice.id
    from public.organization_subscription_invoice_schedule invoice
    join public.organization_subscription_contracts contract
      on contract.id = invoice.contract_id
    where invoice.due_at <= current_date
      and invoice.status in ('scheduled', 'issued')
      and invoice.email_delivery_status = 'pending'
      and invoice.email_sent_at is null
      and invoice.email_attempt_count < 8
      and invoice.next_email_attempt_at <= now()
      and (
        invoice.email_claimed_at is null
        or invoice.email_claimed_at < now() - interval '30 minutes'
      )
      and contract.status = 'accepted'
    order by invoice.due_at, invoice.installment_number
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update of invoice skip locked
  ), claimed as (
    update public.organization_subscription_invoice_schedule invoice
    set status = 'issued',
        invoice_reference = coalesce(
          invoice.invoice_reference,
          'ERA-' || upper(substr(replace(invoice.contract_id::text, '-', ''), 1, 8))
            || '-' || lpad(invoice.installment_number::text, 2, '0')
        ),
        issued_at = coalesce(invoice.issued_at, now()),
        email_claimed_at = now(),
        email_claim_token = gen_random_uuid(),
        email_attempt_count = invoice.email_attempt_count + 1
    from due_invoices due
    where invoice.id = due.id
    returning invoice.id, invoice.email_claim_token, invoice.contract_id,
      invoice.invoice_reference, invoice.installment_number, invoice.amount_due,
      invoice.currency, invoice.due_at, invoice.email_attempt_count
  )
  select claimed.id,
    claimed.email_claim_token,
    claimed.invoice_reference,
    claimed.installment_number,
    claimed.amount_due,
    claimed.currency,
    claimed.due_at,
    coalesce(nullif(contract.accepted_email, ''), organization.email),
    contract.accepted_name,
    contract.plan_name,
    organization.name,
    claimed.email_attempt_count
  from claimed
  join public.organization_subscription_contracts contract
    on contract.id = claimed.contract_id
  join public.organizations organization
    on organization.id = contract.organization_id;
end;
$$;

create or replace function public.complete_organization_subscription_invoice_email(
  p_invoice_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_success is null then
    raise exception 'A delivery result is required';
  end if;

  if p_success then
    update public.organization_subscription_invoice_schedule
    set email_delivery_status = 'sent',
        email_sent_at = now(),
        email_claimed_at = null,
        email_claim_token = null,
        email_last_error = null
    where id = p_invoice_id
      and email_claim_token = p_claim_token
      and email_sent_at is null;
  else
    update public.organization_subscription_invoice_schedule
    set email_delivery_status = case
          when email_attempt_count >= 8 then 'failed'
          else 'pending'
        end,
        next_email_attempt_at = case
          when email_attempt_count >= 8 then 'infinity'::timestamptz
          else now() + make_interval(secs => least(
            21600,
            (60 * power(2, greatest(email_attempt_count - 1, 0)))::integer
          ))
        end,
        email_claimed_at = null,
        email_claim_token = null,
        email_last_error = left(coalesce(nullif(trim(p_error), ''), 'Email delivery failed'), 2000)
    where id = p_invoice_id
      and email_claim_token = p_claim_token
      and email_sent_at is null;
  end if;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.claim_due_organization_subscription_invoices(integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_organization_subscription_invoices(integer)
  to service_role;
revoke all on function public.complete_organization_subscription_invoice_email(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.complete_organization_subscription_invoice_email(uuid, uuid, boolean, text)
  to service_role;

grant execute on function public.accept_organization_subscription_contract(text, text, boolean)
  to authenticated;
revoke all on function public.accept_organization_subscription_contract(text, text, boolean)
  from public, anon;

commit;