-- Run in Supabase SQL Editor (New query)
-- Real file storage for case evidence (documents, images, voice notes).

insert into storage.buckets (id, name, public)
values ('case-evidence', 'case-evidence', true)
on conflict (id) do nothing;

create policy "Authenticated staff can upload case evidence"
  on storage.objects for insert
  with check (bucket_id = 'case-evidence' and auth.role() = 'authenticated');

create policy "Authenticated staff can view case evidence"
  on storage.objects for select
  using (bucket_id = 'case-evidence' and auth.role() = 'authenticated');

alter table case_evidence_log add column if not exists attachment_url text;
alter table case_evidence_log add column if not exists message_type text not null default 'text'; -- text | file | voice
