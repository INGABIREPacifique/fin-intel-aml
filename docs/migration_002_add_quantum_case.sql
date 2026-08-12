-- Run this in Supabase SQL Editor after schema.sql
-- Adds the missing case record for Quantum Logistics so its SAR page works too

insert into cases (case_code, title, entity_id, status, risk_level)
select 'CASE-2023-8938', 'Quantum Logistics Inc. — Structuring Investigation', id, 'active', 'high'
from entities where entity_name = 'Quantum Logistics Inc.'
on conflict (case_code) do nothing;
