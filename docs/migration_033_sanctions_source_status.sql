-- Real source-status summary for the sanctions watchlist — lets the UI
-- show which sources are actually active (and when they last synced)
-- without fetching the full ~20,000+ row table just to count it. Used by
-- Entity Profile's Sanctions Screening panel so an analyst can see at a
-- glance whether, say, EU screening is live or still pending setup,
-- rather than that gap being silent.
create or replace function sanctions_source_status()
returns table (
  source text,
  record_count bigint,
  most_recent_sync timestamptz
) as $$
  select source, count(*) as record_count, max(synced_at) as most_recent_sync
  from sanctions_watchlist
  group by source
  order by source;
$$ language sql stable;
