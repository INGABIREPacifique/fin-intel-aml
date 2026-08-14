-- Run in Supabase SQL Editor (New query)
alter table institutions add column if not exists next_audit_date date;
