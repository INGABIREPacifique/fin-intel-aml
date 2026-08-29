-- Text notes, file uploads, and voice notes in the Collaborative Case
-- Workspace previously only appeared after a manual page refresh — the app
-- never used Supabase's Postgres Changes realtime feature anywhere, only
-- ephemeral broadcast/presence channels (video call signaling, ring
-- notifications), which don't touch table data at all. This adds real
-- replication so INSERTs on case_evidence_log push live to every other
-- browser viewing the same case's workspace.
alter publication supabase_realtime add table case_evidence_log;
