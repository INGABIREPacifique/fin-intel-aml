-- Adds the new UN sanctions sync to the same weekly schedule as OFAC
-- (migration_030). The EU sync isn't scheduled here since it requires a
-- personal access token (EU_SANCTIONS_TOKEN) that hasn't been configured —
-- add its own cron.schedule call once that token is set up, following the
-- same pattern below.
select cron.schedule(
  'sync-un-sanctions-list-weekly',
  '30 3 * * 1', -- every Monday at 03:30 UTC, offset from the OFAC sync
  $$
  select net.http_post(
    url := 'https://jqvwyqsznehmfuoedaxo.supabase.co/functions/v1/sync-un-sanctions-list',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY_HERE',
      'Content-Type', 'application/json'
    )
  );
  $$
);
