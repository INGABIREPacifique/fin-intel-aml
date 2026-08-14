-- Run in Supabase SQL Editor (New query)
-- Adds forensic detail fields used by the Case Investigation / Network Graph
-- screen. Real for Apex Global (matches original case data); demo-tagged
-- estimates for the other seeded cases until real transaction feeds exist.

alter table alerts add column if not exists funds_in numeric;
alter table alerts add column if not exists funds_out numeric;
alter table alerts add column if not exists narrative text;

create table if not exists case_network_nodes (
  id uuid primary key default gen_random_uuid(),
  case_code text not null,
  node_key text not null,       -- stable key used to draw edges, e.g. 'subject'
  label text not null,
  node_type text not null,      -- subject | shell_corp | financial_institution
  amount_label text,
  pos_x numeric not null,       -- 0-100, percentage position on canvas
  pos_y numeric not null
);

create table if not exists case_network_edges (
  id uuid primary key default gen_random_uuid(),
  case_code text not null,
  from_key text not null,
  to_key text not null,
  label text
);

create table if not exists case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_code text not null,
  occurred_at timestamptz not null,
  source text not null,      -- e.g. 'SWIFT Log', 'KYC File'
  record text not null
);

alter table case_network_nodes enable row level security;
alter table case_network_edges enable row level security;
alter table case_evidence enable row level security;

create policy "Authenticated staff can view case_network_nodes" on case_network_nodes for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view case_network_edges" on case_network_edges for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view case_evidence" on case_evidence for select using (auth.role() = 'authenticated');

-- Real numbers for Apex Global (matches the original approved design exactly)
update alerts set funds_in = 4250000, funds_out = 4186250,
  narrative = 'Funds entering Apex Global accounts are swept out within a 48-hour window, retaining less than 2% of total volume.'
where case_code = 'CASE-2023-8942';

insert into case_network_nodes (case_code, node_key, label, node_type, amount_label, pos_x, pos_y) values
  ('CASE-2023-8942', 'subject', 'Apex Global', 'subject', null, 50, 55),
  ('CASE-2023-8942', 'shell_x', 'Shell Corp X', 'shell_corp', '$4.2M', 8, 20),
  ('CASE-2023-8942', 'bank_y', 'Bank Y (Cayman)', 'financial_institution', '$4.1M', 88, 25),
  ('CASE-2023-8942', 'bank_z', 'Bank Z (CH)', 'financial_institution', null, 88, 85)
on conflict do nothing;

insert into case_network_edges (case_code, from_key, to_key, label) values
  ('CASE-2023-8942', 'shell_x', 'subject', null),
  ('CASE-2023-8942', 'subject', 'bank_y', 'Rapid Transfer < 2hr'),
  ('CASE-2023-8942', 'subject', 'bank_z', null)
on conflict do nothing;

insert into case_evidence (case_code, occurred_at, source, record) values
  ('CASE-2023-8942', '2023-10-14 14:32:00', 'SWIFT Log', 'MT103 > Bank Y'),
  ('CASE-2023-8942', '2023-10-13 09:15:00', 'KYC File', 'Beneficial Owner Update'),
  ('CASE-2023-8942', '2023-10-12 11:05:00', 'SWIFT Log', 'MT103 < Shell Corp X')
on conflict do nothing;
