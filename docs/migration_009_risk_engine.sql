-- Run in Supabase SQL Editor (New query)
-- Risk model performance data — clearly demo, since no real ML models are
-- deployed yet. Real training/eval pipeline would populate this table later.

create table if not exists risk_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active', -- active | testing | critical
  description text,
  core_logic text,
  precision numeric,
  recall numeric,
  flags_30d int,
  sort_order int not null default 0,
  is_demo boolean not null default true
);

create table if not exists market_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  confidence numeric,
  sort_order int not null default 0,
  is_demo boolean not null default true
);

alter table risk_models enable row level security;
alter table market_patterns enable row level security;

create policy "Authenticated staff can view risk_models" on risk_models
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can view market_patterns" on market_patterns
  for select using (auth.role() = 'authenticated');
create policy "Admin can update risk_models" on risk_models
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into risk_models (name, status, description, core_logic, precision, recall, flags_30d, sort_order) values
  ('Structuring Detection', 'active', 'Identifies sub-reporting threshold deposits across linked accounts.', 'Time-windowed aggregation (72h) < $10k threshold proximity matching.', 88.5, 92.1, 4192, 1),
  ('Rapid Pass-Through', 'testing', 'Detects high-velocity funds transfer sequences across jurisdictional borders.', 'Graph traversal depth > 3 within < 24h window; Volatile origin/dest.', 76.2, 89.4, 1845, 2),
  ('Circular Flow Analysis', 'active', 'Identifies closed-loop transaction networks suggesting wash trading or layering.', 'Cycle detection in directed transaction graph; Node return probability > 0.8.', 94.1, 85.3, 820, 3),
  ('Sanctions & PEP Overlay', 'critical', 'Real-time matching against OFAC, UN, and proprietary PEP databases.', 'Fuzzy string matching (Levenshtein distance < 2) + Entity resolution heuristics.', 99.8, 99.9, 142, 4),
  ('Cross-Market Surveillance', 'active', 'Advanced AI algorithms for mirror trading and capital market anomalies.', 'Cross-exchange order book correlation & high-frequency pattern recognition.', 89.4, 93.2, 2104, 5)
on conflict do nothing;

insert into market_patterns (name, description, confidence, sort_order) values
  ('Mirror Trading', 'Detection of synchronized buy/sell orders across disparate accounts to mask beneficial ownership.', 94, 1),
  ('Temporal Structuring', 'Identification of time-delayed deposits designed to evade rolling-window aggregation logic.', 88, 2),
  ('Cross-Asset Circular Flows', 'Tracing value movement through fiat-to-crypto-to-equity hops to obscure source of funds.', 91, 3)
on conflict do nothing;

-- Demo audit_logs entries so "Recent Logic Updates" has real rows to display
insert into audit_logs (actor_id, action, target_type, target_id, target_label, details, status, created_at)
select null::uuid, 'risk_rule_threshold_updated', 'risk_model', id, 'RUL-8492',
  '{"note":"Adjusted structuring threshold window from 48h to 72h."}'::jsonb, 'success', '2023-10-24 14:32:00'::timestamptz
from risk_models where name = 'Structuring Detection'
union all
select null::uuid, 'risk_rule_weight_updated', 'risk_model', id, 'RUL-8491',
  '{"note":"Added high-risk jurisdictional weight to nodes in Cyprus."}'::jsonb, 'success', '2023-10-23 09:15:00'::timestamptz
from risk_models where name = 'Circular Flow Analysis'
union all
select null::uuid, 'risk_rule_autotuned', 'risk_model', id, 'RUL-8490',
  '{"note":"Tuned fuzzy matching sensitivity for name variants."}'::jsonb, 'flagged', '2023-10-22 00:00:00'::timestamptz
from risk_models where name = 'Sanctions & PEP Overlay';
