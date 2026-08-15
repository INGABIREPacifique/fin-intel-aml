-- Run in Supabase SQL Editor (New query)

create table if not exists entity_relationships (
  id uuid primary key default gen_random_uuid(),
  from_entity_id uuid references entities(id) on delete cascade,
  to_entity_id uuid references entities(id) on delete cascade,
  relationship_type text not null, -- wire_transfer | equity_ownership | cash_deposit
  label text,
  is_demo boolean not null default true
);

alter table entity_relationships enable row level security;
create policy "Authenticated staff can view entity_relationships" on entity_relationships
  for select using (auth.role() = 'authenticated');

-- Seed relationships between real named entities already in the system.
-- These specific links are demo (no real relationship-mining engine exists
-- yet) but the entities themselves are real rows from your entities table.
insert into entity_relationships (from_entity_id, to_entity_id, relationship_type, label)
select a.id, b.id, 'wire_transfer', 'Wire Transfer (High Risk)'
from entities a, entities b
where a.entity_name = 'Apex Global Trading LLC' and b.entity_name = 'Meridian International Bank'
union all
select a.id, b.id, 'equity_ownership', 'Equity / Ownership'
from entities a, entities b
where a.entity_name = 'Vanguard Trading LLC' and b.entity_name = 'Apex Global Trading LLC'
union all
select a.id, b.id, 'cash_deposit', 'Cash Deposit'
from entities a, entities b
where a.entity_name = 'Crescent Logistics Co.' and b.entity_name = 'Oasis Property Management'
union all
select a.id, b.id, 'wire_transfer', 'Wire Transfer (High Risk)'
from entities a, entities b
where a.entity_name = 'Quantum Logistics Inc.' and b.entity_name = 'Meridian International Bank';
