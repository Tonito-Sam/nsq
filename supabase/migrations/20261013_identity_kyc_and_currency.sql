alter table public.wallet_compliance_profiles
  add column if not exists identity_country char(2),
  add column if not exists latest_submission_id uuid;

alter table public.users
  add column if not exists kyc_status text not null default 'unverified',
  add column if not exists identity_country char(2);

alter table public.user_stores
  add column if not exists owner_kyc_status text not null default 'unverified',
  add column if not exists owner_identity_country char(2);

alter table public.users alter column currency set default 'USD';
update public.users set currency = 'USD' where currency is null or btrim(currency) = '';

create table if not exists public.identity_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  country_code char(2) not null,
  document_type text not null check (document_type in ('nigerian_nin', 'passport', 'south_african_id', 'national_id')),
  identity_number_ciphertext text not null,
  identity_number_iv text not null,
  identity_number_tag text not null,
  identity_number_hash text not null,
  document_object_path text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists identity_submission_country_hash_uidx
  on public.identity_verification_submissions(country_code, identity_number_hash)
  where status in ('pending', 'verified');
create index if not exists identity_submission_review_idx
  on public.identity_verification_submissions(status, submitted_at asc);

alter table public.identity_verification_submissions enable row level security;
revoke all on public.identity_verification_submissions from anon, authenticated;
grant select (id, user_id, country_code, document_type, status, review_note, submitted_at, reviewed_at, updated_at)
  on public.identity_verification_submissions to authenticated;
create policy identity_submission_read_own
  on public.identity_verification_submissions for select to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-documents', 'identity-documents', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists identity_documents_insert_own on storage.objects;
create policy identity_documents_insert_own
  on storage.objects for insert to authenticated
  with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_documents_read_own on storage.objects;
create policy identity_documents_read_own
  on storage.objects for select to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_documents_update_own on storage.objects;
create policy identity_documents_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists identity_documents_delete_own on storage.objects;
create policy identity_documents_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.wallet_currency_for_country(country_code text)
returns varchar(3)
language sql
immutable
as $$
  select case upper(coalesce(country_code, ''))
    when 'ZA' then 'ZAR' when 'NG' then 'NGN' when 'BW' then 'BWP' when 'LS' then 'LSL'
    when 'SZ' then 'SZL' when 'NA' then 'NAD' when 'ZW' then 'USD' when 'KE' then 'KES'
    when 'GH' then 'GHS' when 'UG' then 'UGX' when 'TZ' then 'TZS' when 'RW' then 'RWF'
    when 'ZM' then 'ZMW' when 'MW' then 'MWK' when 'EG' then 'EGP' when 'MA' then 'MAD'
    when 'US' then 'USD' when 'CA' then 'CAD' when 'GB' then 'GBP' when 'AU' then 'AUD'
    when 'NZ' then 'NZD' when 'IN' then 'INR' when 'JP' then 'JPY' when 'CN' then 'CNY'
    when 'BR' then 'BRL' when 'MX' then 'MXN' when 'SG' then 'SGD' when 'AE' then 'AED'
    when 'SA' then 'SAR' when 'CH' then 'CHF' when 'TR' then 'TRY' when 'PK' then 'PKR'
    when 'ID' then 'IDR' when 'MY' then 'MYR' when 'TH' then 'THB' when 'PH' then 'PHP'
    when 'KR' then 'KRW' when 'HK' then 'HKD' when 'IL' then 'ILS' when 'RU' then 'RUB'
    when 'AR' then 'ARS' when 'CL' then 'CLP' when 'CO' then 'COP' when 'PE' then 'PEN'
    else 'USD'
  end::varchar(3);
$$;

create or replace function public.user_stores_set_country_currency()
returns trigger
language plpgsql
as $$
begin
  if new.base_currency is null or btrim(new.base_currency) = '' then
    new.base_currency := public.wallet_currency_for_country(new.country);
  end if;
  return new;
end;
$$;

drop trigger if exists user_stores_set_country_currency_trigger on public.user_stores;
create trigger user_stores_set_country_currency_trigger
before insert or update of country, base_currency on public.user_stores
for each row execute function public.user_stores_set_country_currency();

update public.user_stores
set base_currency = public.wallet_currency_for_country(country)
where base_currency is null or btrim(base_currency) = '';
