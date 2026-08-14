-- Run in Supabase SQL Editor (New query)

-- Real sync tracking on institutions (genuinely updatable via "Sync Now")
alter table institutions add column if not exists sync_status text not null default 'live';
alter table institutions add column if not exists last_sync_at timestamptz default now();

-- Two more demo institutions to populate the Active Integration Feeds panel
insert into institutions (institution_code, name, jurisdiction_code, status, last_audit_date, sar_filing_accuracy, ctr_pass_rate, schema_validation_rate, sync_status, last_sync_at, is_demo)
values
  ('APX-441-US', 'Apex Financial', 'US - FinCEN', 'active', '2023-09-01', 91.2, 88.5, 79.4, 'lagging', now() - interval '45 minutes', true),
  ('SWX-772-CH', 'Swift Exchange Hub', 'CH - FINMA', 'active', '2023-10-05', 96.7, 95.0, 90.1, 'live', now() - interval '1 minute', true)
on conflict (institution_code) do nothing;

-- Entity resolution audit — clearly demo, since no real fuzzy-matching engine
-- exists yet. Real matches would be produced by an actual resolution pipeline.
create table if not exists entity_resolution_audit (
  id uuid primary key default gen_random_uuid(),
  matched_at timestamptz not null,
  source_a text not null,
  source_a_ref text,
  source_b text not null,
  source_b_ref text,
  match_logic text not null,
  confidence numeric not null,
  is_demo boolean not null default true
);

alter table entity_resolution_audit enable row level security;
create policy "Authenticated staff can view entity_resolution_audit" on entity_resolution_audit
  for select using (auth.role() = 'authenticated');

insert into entity_resolution_audit (matched_at, source_a, source_a_ref, source_b, source_b_ref, match_logic, confidence) values
  ('2023-10-27 14:32:01', 'Corp_DB_EU', 'ID: 994-A', 'Watchlist_Intl', 'ID: WL-02', 'Exact string match (LEI)', 99.8),
  ('2023-10-27 14:31:45', 'Retail_Tx_Stream', 'Acct: 4432...', 'Fraud_Registry', 'Alias: J.Doe', 'Fuzzy (Levenshtein d=1) + Address', 87.2);
