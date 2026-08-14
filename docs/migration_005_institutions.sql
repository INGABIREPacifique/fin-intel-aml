-- Run in Supabase SQL Editor (New query)
-- Institutions are partner reporting banks (distinct from `entities`, which
-- are subjects under investigation). Real institution data will replace
-- these seeded rows once a partnership is signed.

create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  institution_code text unique not null,   -- e.g. GBL-889-UK
  name text not null,
  jurisdiction_code text,                  -- e.g. UK - FCA
  status text not null default 'active',   -- active | suspended
  last_audit_date date,
  sar_filing_accuracy numeric,
  ctr_pass_rate numeric,
  schema_validation_rate numeric,
  is_demo boolean not null default true
);

create table if not exists institution_legal_agreements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) on delete cascade,
  title text not null,
  reference text,
  status text not null default 'active',  -- active | expired
  expires_on date
);

alter table institutions enable row level security;
alter table institution_legal_agreements enable row level security;

create policy "Authenticated staff can view institutions" on institutions
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view institution_legal_agreements" on institution_legal_agreements
  for select using (auth.role() = 'authenticated');

-- Seed one demo institution (clearly fictional — "Global Bank PLC")
insert into institutions (institution_code, name, jurisdiction_code, status, last_audit_date, sar_filing_accuracy, ctr_pass_rate, schema_validation_rate, is_demo)
values ('GBL-889-UK', 'Global Bank PLC', 'UK - FCA', 'active', '2023-10-12', 98.4, 99.1, 92.7, true)
on conflict (institution_code) do nothing;

insert into institution_legal_agreements (institution_id, title, reference, status, expires_on)
select id, 'Data Sharing Agreement v3', 'DSA-UK-2023', 'active', '2024-12-31'::date from institutions where institution_code = 'GBL-889-UK'
union all
select id, 'Privacy Impact Assessment', 'PIA-2023-Q4', 'active', '2025-10-01'::date from institutions where institution_code = 'GBL-889-UK'
union all
select id, 'Cross-Border MoU', 'MOU-EU-2021', 'expired', '2023-01-15'::date from institutions where institution_code = 'GBL-889-UK'
on conflict do nothing;

-- Seed a few audit_logs entries for this institution, reusing the real audit_logs table
insert into audit_logs (actor_id, action, target_type, target_id, details, created_at)
select null, 'compliance_review_completed', 'institution', id, '{"note":"Annual FCA Assessment"}'::jsonb, '2023-10-12 14:32:01'
from institutions where institution_code = 'GBL-889-UK'
union all
select null, 'legal_agreement_renewed', 'institution', id, '{"note":"Data Sharing Agreement v3 Renewed"}'::jsonb, '2023-09-28 09:15:44'
from institutions where institution_code = 'GBL-889-UK'
union all
select null, 'data_stream_suspended', 'institution', id, '{"note":"Schema Validation Failure (v2.1)"}'::jsonb, '2023-08-14 18:02:11'
from institutions where institution_code = 'GBL-889-UK'
union all
select null, 'data_stream_restored', 'institution', id, '{"note":"Schema Patch Applied"}'::jsonb, '2023-08-15 08:30:00'
from institutions where institution_code = 'GBL-889-UK';
