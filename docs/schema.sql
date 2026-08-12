-- FIN-INTEL AML — Prototype #1 schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New Query)

-- 1. Staff profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  operator_id text unique not null,
  full_name text not null,
  department text not null, -- e.g. FinCEN, OFAC, IRS-CI, JTTF, SEC
  created_at timestamptz default now()
);

-- 2. Entities (subjects under investigation: companies, individuals)
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  entity_type text not null, -- 'company' | 'individual'
  jurisdiction text,
  tin_ein text,
  address text,
  created_at timestamptz default now()
);

-- 3. Alerts (flagged anomalies feeding the Alert Queue)
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  case_code text unique not null, -- e.g. CASE-2023-8942
  pattern text not null, -- e.g. 'Circular Flow', 'Structuring'
  risk_score int not null check (risk_score between 0 and 100),
  volume numeric,
  window_label text, -- e.g. '30d', '7d'
  status text not null default 'open', -- open | investigating | closed
  created_at timestamptz default now()
);

-- 4. Cases (an investigation opened from one or more alerts)
create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  case_code text unique not null,
  title text not null,
  entity_id uuid references entities(id),
  status text not null default 'active', -- active | resolved
  risk_level text not null default 'medium', -- low | medium | high | critical
  assigned_to uuid references profiles(id),
  created_at timestamptz default now()
);

-- 5. SAR filings (generated from a case, goes through approval)
create table if not exists sar_filings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  entity_id uuid references entities(id),
  narrative text,
  total_amount numeric,
  date_range_start date,
  date_range_end date,
  status text not null default 'draft', -- draft | pending_review | approved | rejected | filed
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Row Level Security: only authenticated staff can read/write
alter table profiles enable row level security;
alter table entities enable row level security;
alter table alerts enable row level security;
alter table cases enable row level security;
alter table sar_filings enable row level security;

create policy "Authenticated staff can view profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Authenticated staff can view entities" on entities for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can insert entities" on entities for insert with check (auth.role() = 'authenticated');

create policy "Authenticated staff can view alerts" on alerts for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can update alerts" on alerts for update using (auth.role() = 'authenticated');

create policy "Authenticated staff can view cases" on cases for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can insert cases" on cases for insert with check (auth.role() = 'authenticated');
create policy "Authenticated staff can update cases" on cases for update using (auth.role() = 'authenticated');

create policy "Authenticated staff can view sar_filings" on sar_filings for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can insert sar_filings" on sar_filings for insert with check (auth.role() = 'authenticated');
create policy "Authenticated staff can update sar_filings" on sar_filings for update using (auth.role() = 'authenticated');

-- Seed data so the prototype has something real to show
insert into entities (entity_name, entity_type, jurisdiction, tin_ein, address) values
  ('Apex Global Trading LLC', 'company', 'BVI', 'XX-XXXX892', '1420 Financial Dist Blvd, Suite 400, New York, NY 10004'),
  ('Quantum Logistics Inc.', 'company', 'Cayman Islands', 'XX-XXXX331', '88 Harbour Rd, George Town');

insert into alerts (entity_id, case_code, pattern, risk_score, volume, window_label, status)
select id, 'CASE-2023-8942', 'Circular Flow', 98, 14200000, '30d', 'open' from entities where entity_name = 'Apex Global Trading LLC'
union all
select id, 'CASE-2023-8938', 'Structuring (Cash)', 75, 845000, '7d', 'open' from entities where entity_name = 'Quantum Logistics Inc.';

insert into cases (case_code, title, entity_id, status, risk_level)
select 'CASE-2023-8942', 'Apex Global Trading LLC — Circular Flow Investigation', id, 'active', 'critical' from entities where entity_name = 'Apex Global Trading LLC';
