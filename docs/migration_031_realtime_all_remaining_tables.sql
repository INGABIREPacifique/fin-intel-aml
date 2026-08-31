-- Critical fix: every page wired with useRealtimeRefresh (Dashboard, Graph
-- Explorer, Network Analysis, Entity Profile, Data Health, Global Audit
-- Trail, Institutions List, Entity Search, Institution Profile, API
-- Gateway, Case Detail, SAR Filing, Risk Engine Config, Risk Model Detail,
-- Security Config, Mobile Alert Detail, Mobile Field Hub) subscribes to
-- Postgres Changes on these tables — but a postgres_changes subscription
-- does nothing at all, with no error, unless the table has actually been
-- added to the supabase_realtime publication. Migrations 025 and 026 only
-- covered case_evidence_log, alerts, access_requests, and cases — every
-- other table below was never added, meaning most of the "live update"
-- work built across many pages would have silently never fired. This
-- migration is the fix. Uses the same defensive per-table membership check
-- as migration_026 so it can't fail on a table that (for whatever reason)
-- is already a publication member.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'api_keys', 'audit_logs', 'case_evidence', 'case_network_edges',
    'case_network_nodes', 'cross_market_anomalies', 'entities',
    'entity_relationships', 'entity_resolution_audit',
    'institution_legal_agreements', 'institutions', 'market_patterns',
    'risk_models', 'sar_filings', 'security_groups', 'simulation_runs',
    'system_settings'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table %I', tbl);
    end if;
  end loop;
end $$;
