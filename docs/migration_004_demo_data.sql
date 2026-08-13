-- Run in Supabase SQL Editor (New query)
-- Adds demo-purpose tables for pitch/showcase metrics that don't yet have
-- a real institution feeding them. Clearly separated from real operational
-- tables (alerts, cases, sar_filings) so swapping to real data later is a
-- clean data-source change, not a rebuild.

create table if not exists demo_metrics (
  key text primary key,
  label text not null,
  value numeric not null,
  unit text default '%',
  trend_note text
);

create table if not exists demo_pattern_trends (
  id uuid primary key default gen_random_uuid(),
  week_label text not null,
  week_order int not null,
  structuring int not null default 0,
  circular_flow int not null default 0,
  pass_through int not null default 0
);

alter table demo_metrics enable row level security;
alter table demo_pattern_trends enable row level security;

create policy "Authenticated staff can view demo_metrics" on demo_metrics
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view demo_pattern_trends" on demo_pattern_trends
  for select using (auth.role() = 'authenticated');

-- Seed demo metrics (clearly synthetic, for showcase until real institution data connects)
insert into demo_metrics (key, label, value, unit, trend_note) values
  ('false_positive_rate', 'False Positive Rate', 4.2, '%', '-0.8% accuracy improvement')
on conflict (key) do nothing;

-- Seed 6-week demo trend for the Laundering Pattern Detection chart
insert into demo_pattern_trends (week_label, week_order, structuring, circular_flow, pass_through) values
  ('W1', 1, 12, 4, 2),
  ('W2', 2, 15, 6, 3),
  ('W3', 3, 19, 9, 5),
  ('W4', 4, 22, 11, 8),
  ('W5', 5, 27, 14, 12),
  ('W6', 6, 31, 18, 17)
on conflict do nothing;

-- Additional demo alerts so the dashboard/queue look populated for a pitch
-- (same pattern as the original two seed entities — clearly fictional company names)
insert into entities (entity_name, entity_type, jurisdiction, tin_ein, address) values
  ('Meridian International Bank', 'company', 'Cayman Islands', 'XX-XXXX440', '200 Meridian Plaza, George Town'),
  ('Vanguard Trading LLC', 'company', 'BVI', 'XX-XXXX102', '14 Trident Chambers, Road Town'),
  ('Crescent Logistics Co.', 'company', 'Cyprus', 'XX-XXXX301', '55 Makarios Ave, Nicosia'),
  ('Oasis Property Management', 'company', 'Panama', 'XX-XXXX094', '10 Panama City Financial District')
on conflict do nothing;

insert into alerts (entity_id, case_code, pattern, risk_score, volume, window_label, status)
select id, 'CASE-2023-8944', 'Rapid Pass-Through', 98, 4250000, '48h', 'open' from entities where entity_name = 'Meridian International Bank'
union all
select id, 'CASE-2023-8945', 'Structuring (Smurfing)', 85, 620000, '30d', 'open' from entities where entity_name = 'Vanguard Trading LLC'
union all
select id, 'CASE-2023-8946', 'Circular Flow', 79, 3100000, '30d', 'investigating' from entities where entity_name = 'Crescent Logistics Co.'
union all
select id, 'CASE-2023-8947', 'Unusual Volume', 62, 410000, '14d', 'open' from entities where entity_name = 'Oasis Property Management'
on conflict (case_code) do nothing;
