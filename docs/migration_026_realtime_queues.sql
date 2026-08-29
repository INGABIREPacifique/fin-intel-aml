-- Extends the same fix applied to case_evidence_log (migration_025) to three
-- more shared, multi-viewer queues that previously required a manual page
-- refresh to see anything new: the Alert Queue, pending Access Requests,
-- and the Investigations list. All three are places where more than one
-- staff member is expected to be watching the same data at the same time —
-- exactly the case where "you have to refresh to see it" is a real problem,
-- not just polish.
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table access_requests;
alter publication supabase_realtime add table cases;
