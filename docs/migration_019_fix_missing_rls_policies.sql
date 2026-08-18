-- Run in Supabase SQL Editor (New query)
-- Fixes silent write failures: these tables had SELECT (and sometimes INSERT)
-- policies but were missing UPDATE policies entirely, so Supabase's Row Level
-- Security quietly rejected every update with no visible error.

create policy "Authenticated staff can update entities" on entities
  for update using (auth.role() = 'authenticated');

create policy "Authenticated staff can insert alerts" on alerts
  for insert with check (auth.role() = 'authenticated');

create policy "Officers and admins can insert institutions" on institutions
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('compliance_officer', 'admin'))
  );

create policy "Officers and admins can update institutions" on institutions
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('compliance_officer', 'admin'))
  );
