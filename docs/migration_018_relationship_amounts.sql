-- Run in Supabase SQL Editor (New query)
alter table entity_relationships add column if not exists amount numeric default 50000;
alter table entity_relationships add column if not exists occurred_at timestamptz default now() - interval '10 days';

update entity_relationships set amount = 4250000, occurred_at = now() - interval '3 days'
where relationship_type = 'wire_transfer' and label = 'Wire Transfer (High Risk)'
  and from_entity_id = (select id from entities where entity_name = 'Apex Global Trading LLC');

update entity_relationships set amount = 620000, occurred_at = now() - interval '20 days'
where relationship_type = 'equity_ownership';

update entity_relationships set amount = 85000, occurred_at = now() - interval '45 days'
where relationship_type = 'cash_deposit';

update entity_relationships set amount = 3100000, occurred_at = now() - interval '5 days'
where relationship_type = 'wire_transfer' and from_entity_id = (select id from entities where entity_name = 'Quantum Logistics Inc.');
