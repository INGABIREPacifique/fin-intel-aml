-- Run in Supabase SQL Editor (New query)

-- 1. Real watchlist toggle on entities (genuinely functional)
alter table entities add column if not exists watchlisted boolean not null default false;

-- 2. Cross-market anomalies — clearly demo, since no real cross-asset trading
-- feed exists yet (would need live equities/derivatives/crypto ingestion).
create table if not exists cross_market_anomalies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  confidence numeric not null,
  algorithm text,
  leg_a_label text,
  leg_a_detail text,
  leg_a_account text,
  leg_b_label text,
  leg_b_detail text,
  leg_b_account text,
  severity text not null default 'high', -- high | medium
  sort_order int not null default 0
);

alter table cross_market_anomalies enable row level security;
create policy "Authenticated staff can view cross_market_anomalies" on cross_market_anomalies
  for select using (auth.role() = 'authenticated');

insert into cross_market_anomalies (title, description, confidence, algorithm, leg_a_label, leg_a_detail, leg_a_account, leg_b_label, leg_b_detail, leg_b_account, severity, sort_order) values
  ('Mirror Trading Sequence', 'Simultaneous identical position taking across disconnected brokerages.', 88, 'MT-CrossBorder-v4', 'LEG A (EQUITIES)', 'BUY 50k $TSLA @ 184.2', 'Acc: 00-492-X', 'LEG B (DERIVATIVES)', 'SELL 500 PUT $TSLA 185', 'Acc: 99-881-Y', 'high', 1),
  ('Temporal Structuring', 'Staggered fiat-to-crypto bridging designed to evade reporting thresholds.', 94, null, null, null, null, null, null, null, 'medium', 2)
on conflict do nothing;
