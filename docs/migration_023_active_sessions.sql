-- Tracks one row per active browser/device login, so concurrent_session_limit
-- (Security Config's Session Governance) can be genuinely enforced rather
-- than just stored and displayed. No service_role / admin API is used —
-- enforcement is entirely client-driven and RLS-safe (see AuthContext.jsx):
-- on login each device upserts its own row, trims its own oldest rows down
-- to the configured limit, and each surviving device periodically checks
-- that its own row still exists — if another login later trims it away,
-- that device signs itself out locally within one poll interval.
create table if not exists active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  client_session_id text not null,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique (user_id, client_session_id)
);

alter table active_sessions enable row level security;

create policy "Users can view their own sessions" on active_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert their own sessions" on active_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own sessions" on active_sessions
  for update using (auth.uid() = user_id);

-- Deleting is how trimming-to-limit works: a user's own newest session
-- deletes their own older rows once the count exceeds the configured limit.
create policy "Users can delete their own sessions" on active_sessions
  for delete using (auth.uid() = user_id);
