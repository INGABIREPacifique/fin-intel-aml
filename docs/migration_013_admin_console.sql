-- Run in Supabase SQL Editor (New query)

-- 1. System-wide settings (real, admin-editable via Security Config's Session Governance)
create table if not exists system_settings (
  key text primary key,
  value text not null
);
insert into system_settings (key, value) values
  ('auto_logout_minutes', '15'),
  ('concurrent_session_limit', '1')
on conflict (key) do nothing;

-- 2. Security groups — governance concept layered on top of the 3 real roles,
-- for MFA/physical-key policy display. Toggles are real and admin-editable.
create table if not exists security_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clearance_level int not null, -- 1-5
  biometric_mfa boolean not null default false,
  physical_key_required boolean not null default false,
  sort_order int not null default 0
);
insert into security_groups (name, clearance_level, biometric_mfa, physical_key_required, sort_order) values
  ('System Admin', 5, true, true, 1),
  ('Senior Investigator', 4, true, false, 2),
  ('Compliance Auditor', 3, true, false, 3),
  ('Standard Analyst', 2, false, false, 4)
on conflict do nothing;

-- 3. Permission domains + real per-level access (many-to-many). The matrix
-- checkmarks are computed live from this junction table, not hardcoded.
create table if not exists permission_domains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);
create table if not exists permission_access (
  id uuid primary key default gen_random_uuid(),
  permission_id uuid references permission_domains(id) on delete cascade,
  clearance_level int not null, -- 1-5
  unique (permission_id, clearance_level)
);

insert into permission_domains (name, sort_order) values
  ('View Global Dashboards', 1),
  ('Access SAR Database', 2),
  ('Export Sensitive Data (CSV)', 3),
  ('Decrypt Entity Identity', 4),
  ('Modify Risk Models', 5)
on conflict do nothing;

insert into permission_access (permission_id, clearance_level)
select id, lvl from permission_domains, unnest(array[1,2,3,4,5]) as lvl where name = 'View Global Dashboards'
union all
select id, lvl from permission_domains, unnest(array[2,3,4,5]) as lvl where name = 'Access SAR Database'
union all
select id, lvl from permission_domains, unnest(array[3,4,5]) as lvl where name = 'Export Sensitive Data (CSV)'
union all
select id, lvl from permission_domains, unnest(array[4,5]) as lvl where name = 'Decrypt Entity Identity'
union all
select id, lvl from permission_domains, unnest(array[5]) as lvl where name = 'Modify Risk Models'
on conflict do nothing;

-- 4. Access requests — demo personas (not linked to real accounts), real
-- approve/deny workflow with audit logging.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  requester_id_label text not null,
  initials text not null,
  requested_level int not null,
  justification text not null,
  status text not null default 'pending', -- pending | approved | denied
  is_demo boolean not null default true
);
insert into access_requests (requester_name, requester_id_label, initials, requested_level, justification) values
  ('Elias Thorne', 'US-FIN-882', 'EK', 3, 'Requires temporary L3 clearance to access specific SAR data for investigation #INV-2023-991.'),
  ('Maria Russo', 'EU-REG-014', 'MR', 4, 'Permanent escalation request to L4. Needs ability to export flagged entity datasets for quarterly compliance audit.');

alter table system_settings enable row level security;
alter table security_groups enable row level security;
alter table permission_domains enable row level security;
alter table permission_access enable row level security;
alter table access_requests enable row level security;

create policy "Authenticated staff can view system_settings" on system_settings for select using (auth.role() = 'authenticated');
create policy "Admin can update system_settings" on system_settings for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated staff can view security_groups" on security_groups for select using (auth.role() = 'authenticated');
create policy "Admin can update security_groups" on security_groups for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated staff can view permission_domains" on permission_domains for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view permission_access" on permission_access for select using (auth.role() = 'authenticated');
create policy "Admin can modify permission_access" on permission_access for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated staff can view access_requests" on access_requests for select using (auth.role() = 'authenticated');
create policy "Admin can update access_requests" on access_requests for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
