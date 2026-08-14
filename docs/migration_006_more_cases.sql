-- Run in Supabase SQL Editor (New query)
-- Adds case records for the demo alerts seeded in migration_004, so the
-- Investigations page has a realistic, populated list for demo purposes.

insert into cases (case_code, title, entity_id, status, risk_level)
select 'CASE-2023-8944', 'Meridian International Bank — Rapid Pass-Through Investigation', id, 'active', 'critical'
from entities where entity_name = 'Meridian International Bank'
union all
select 'CASE-2023-8945', 'Vanguard Trading LLC — Structuring Investigation', id, 'active', 'high'
from entities where entity_name = 'Vanguard Trading LLC'
union all
select 'CASE-2023-8946', 'Crescent Logistics Co. — Circular Flow Investigation', id, 'active', 'high'
from entities where entity_name = 'Crescent Logistics Co.'
union all
select 'CASE-2023-8947', 'Oasis Property Management — Volume Anomaly Investigation', id, 'active', 'medium'
from entities where entity_name = 'Oasis Property Management'
on conflict (case_code) do nothing;
