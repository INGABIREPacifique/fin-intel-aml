-- Run in Supabase SQL Editor (New query)

-- Operational fields for the Integrations feed table
alter table institutions add column if not exists environment text default 'production';
alter table institutions add column if not exists api_version text default 'v1.0.0';
alter table institutions add column if not exists latency_ms int;
alter table institutions add column if not exists banking_license_number text;
alter table institutions add column if not exists lei_code text;
alter table institutions add column if not exists operational_zones text[];
alter table institutions add column if not exists onboarding_status text not null default 'active'; -- draft | active

update institutions set environment = 'Production', api_version = 'v2.4.1', latency_ms = 42 where institution_code = 'GBL-889-UK';
update institutions set environment = 'Production', api_version = 'v3.0.0', latency_ms = 380 where institution_code = 'APX-441-US';
update institutions set environment = 'UAT', api_version = 'v2.5.0-beta', latency_ms = 85 where institution_code = 'SWX-772-CH';

-- Real API keys — genuinely generated, stored, expiring, and revocable
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key_alias text not null,
  key_prefix text not null,     -- shown to user, e.g. "gb_a_9f2c"
  full_key text not null,       -- shown once at creation, demo-grade (not hashed) since this is a prototype
  scopes text[] not null,
  expires_at date not null,
  revoked boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table api_keys enable row level security;
create policy "Authenticated staff can view api_keys" on api_keys for select using (auth.role() = 'authenticated');
create policy "Admin can manage api_keys" on api_keys for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
