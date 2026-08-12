-- Run in Supabase SQL Editor (New query)
-- Adds roles, audit logging, and proper separation-of-duties enforcement

-- 1. Add role to profiles
alter table profiles add column if not exists role text not null default 'investigator'
  check (role in ('investigator', 'compliance_officer', 'admin'));

-- 2. Audit log table
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,        -- e.g. 'sar_draft_saved', 'sar_approved', 'sar_rejected'
  target_type text not null,   -- e.g. 'sar_filing', 'case'
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;

create policy "Authenticated staff can view audit logs" on audit_logs
  for select using (auth.role() = 'authenticated');

create policy "Staff can insert their own audit entries" on audit_logs
  for insert with check (auth.uid() = actor_id);

-- 3. Tighten SAR update permissions: only compliance_officer/admin can approve or reject
drop policy if exists "Authenticated staff can update sar_filings" on sar_filings;

create policy "Investigators can save drafts, officers can decide" on sar_filings
  for update
  using (auth.role() = 'authenticated')
  with check (
    status in ('draft', 'pending_review')
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('compliance_officer', 'admin')
    )
  );

-- 4. Set your existing test account to compliance_officer so you can test both sides.
--    Replace YOUR_EMAIL below and run this separately.
-- update profiles set role = 'compliance_officer'
-- where id = (select id from auth.users where email = 'YOUR_EMAIL');
