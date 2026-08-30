-- Schedules sync-sanctions-list to run automatically every Monday at
-- 03:00 UTC, so the sanctions watchlist stays current without relying on
-- anyone remembering to re-run it manually. Uses pg_cron (Postgres-native
-- scheduling) + pg_net (async HTTP from Postgres) — the standard Supabase
-- pattern for scheduled Edge Function calls, not a workaround.
--
-- IMPORTANT: before running this, replace YOUR_ANON_KEY_HERE below with
-- your project's real anon key (the same one already in your .env file as
-- VITE_SUPABASE_ANON_KEY — it's meant to be public, same key your app
-- already sends on every request, so this is not a new secret exposure).
--
-- If "create extension pg_cron" fails with a permission error, enable it
-- first via Supabase Dashboard → Database → Extensions → search "pg_cron"
-- → Enable, then re-run this migration.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'sync-sanctions-list-weekly',
  '0 3 * * 1', -- every Monday at 03:00 UTC
  $$
  select net.http_post(
    url := 'https://jqvwyqsznehmfuoedaxo.supabase.co/functions/v1/sync-sanctions-list',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY_HERE',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- To check it's registered:
--   select * from cron.job where jobname = 'sync-sanctions-list-weekly';
-- To check run history after it's fired at least once:
--   select * from cron.job_run_details order by start_time desc limit 5;
-- To remove the schedule if ever needed:
--   select cron.unschedule('sync-sanctions-list-weekly');
