-- Run in Supabase SQL Editor (New query)
-- Adds a real status field (so entries can be flagged for review) and a
-- human-readable target_label (so the audit table doesn't show raw UUIDs).

alter table audit_logs add column if not exists status text not null default 'success';
alter table audit_logs add column if not exists target_label text;

-- Backfill target_label for existing institution-related entries
update audit_logs
set target_label = (select name from institutions where institutions.id = audit_logs.target_id)
where target_type = 'institution' and target_label is null;

-- Backfill target_label for existing case-related entries (case_resolved uses case id)
update audit_logs
set target_label = (select case_code from cases where cases.id = audit_logs.target_id)
where target_type = 'case' and target_label is null;
