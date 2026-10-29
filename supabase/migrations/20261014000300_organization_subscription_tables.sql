alter table public.organizations
  add column if not exists email text;

create table if not exists public.organization_subscription_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accepted_by uuid not null references auth.users(id) on delete restrict,
  accepted_name text not null,
  accepted_email text not null,
  plan_code text not null,
  plan_name text not null,
  monthly_amount numeric(10, 2) not null check (monthly_amount > 0),
  contract_started_at timestamptz not null,
  free_access_ends_at timestamptz not null,
  billing_starts_at timestamptz not null,
  contract_ends_at timestamptz not null,
  terms_version text not null,
  terms_text text not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contract_ends_at > contract_started_at),
  check (billing_starts_at >= free_access_ends_at)
);

create index if not exists organization_subscription_contracts_org_status_idx
  on public.organization_subscription_contracts (organization_id, status);

create table if not exists public.organization_subscription_invoice_schedule (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.organization_subscription_contracts(id) on delete cascade,
  installment_number integer not null check (installment_number between 1 and 6),
  amount_due numeric(10, 2) not null check (amount_due > 0),
  currency text not null default 'USD',
  due_at date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'issued', 'paid', 'void', 'cancelled')),
  invoice_reference text unique,
  issued_at timestamptz,
  email_sent_at timestamptz,
  email_attempt_count integer not null default 0 check (email_attempt_count >= 0),
  next_email_attempt_at timestamptz not null default now(),
  email_claimed_at timestamptz,
  email_claim_token uuid,
  email_delivery_status text not null default 'pending'
    check (email_delivery_status in ('pending', 'sent', 'failed')),
  email_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, installment_number)
);

create index if not exists organization_subscription_invoice_due_idx
  on public.organization_subscription_invoice_schedule (due_at, status);

create or replace function public.schedule_organization_subscription_installments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' then
    insert into public.organization_subscription_invoice_schedule (
      contract_id,
      installment_number,
      amount_due,
      currency,
      due_at
    )
    select
      new.id,
      installment,
      new.monthly_amount,
      'USD',
      (new.billing_starts_at::date + make_interval(months => installment - 1))::date
    from generate_series(1, 6) as series(installment)
    on conflict (contract_id, installment_number) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_subscription_schedule_installments
  on public.organization_subscription_contracts;
create trigger organization_subscription_schedule_installments
  after insert on public.organization_subscription_contracts
  for each row execute function public.schedule_organization_subscription_installments();

alter table public.organization_subscription_contracts enable row level security;
alter table public.organization_subscription_invoice_schedule enable row level security;
revoke all on public.organization_subscription_contracts from anon, authenticated;
revoke all on public.organization_subscription_invoice_schedule from anon, authenticated;
grant all on public.organization_subscription_contracts to service_role;
grant all on public.organization_subscription_invoice_schedule to service_role;

revoke all on function public.schedule_organization_subscription_installments()
  from public, anon, authenticated;