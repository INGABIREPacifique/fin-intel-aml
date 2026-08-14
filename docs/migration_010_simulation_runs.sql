-- Run in Supabase SQL Editor (New query)
-- Stores each "What-If" simulation the user actually runs, computed from a
-- real (disclosed, simplified) heuristic against the live risk_models data —
-- not a trained backtesting engine, but a genuine stored computation, not a
-- static picture.

create table if not exists simulation_runs (
  id uuid primary key default gen_random_uuid(),
  run_by uuid references profiles(id),
  strictness_adjustment numeric not null,   -- the slider input, -20 to +20
  base_total_flags int not null,            -- real total flags at time of run
  predicted_fp_reduction numeric not null,  -- computed, %
  detection_yield_shift numeric not null,   -- computed, %
  weekly_current jsonb not null,            -- [w1,w2,w3,w4] current volumes
  weekly_simulated jsonb not null,          -- [w1,w2,w3,w4] simulated volumes
  created_at timestamptz default now()
);

alter table simulation_runs enable row level security;

create policy "Authenticated staff can view simulation_runs" on simulation_runs
  for select using (auth.role() = 'authenticated');
create policy "Admin can create simulation_runs" on simulation_runs
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
