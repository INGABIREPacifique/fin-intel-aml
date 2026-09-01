-- Real sanctions/watchlist screening, backed by actual U.S. Treasury OFAC
-- data (not mocked/fabricated) once the companion Edge Function
-- (supabase/functions/sync-sanctions-list) is deployed and run. This
-- migration only creates the schema and matching function — it seeds zero
-- fake entries, since hardcoding invented "sanctioned" names into a
-- compliance tool would be actively dishonest and potentially legally
-- risky. Real data populates this table only via the real OFAC sync,
-- and now also the real UN Consolidated Sanctions List sync
-- (sync-un-sanctions-list) — see docs/migration_032. The EU list follow-up
-- (sync-eu-sanctions-list) is built and real, but needs a personal access
-- token only the deploying user can obtain — see that function's own
-- setup instructions.

create extension if not exists pg_trgm;

create table if not exists sanctions_watchlist (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'OFAC_SDN', -- OFAC_SDN | OFAC_CONSOLIDATED | UN | EU (UN/EU sync are documented follow-ups, not built yet)
  external_id text, -- OFAC's own ent_num, so re-syncing updates rather than duplicates
  name text not null,
  entity_type text, -- 'individual' | 'entity' | 'vessel' | 'aircraft'
  programs text, -- e.g. "SDGT, IRAN" — raw OFAC program tags, comma-separated
  remarks text,
  list_updated_at timestamptz, -- when OFAC itself last published this entry, not when we synced it
  synced_at timestamptz default now(),
  unique (source, external_id)
);

create index if not exists sanctions_watchlist_name_trgm_idx
  on sanctions_watchlist using gin (name gin_trgm_ops);

alter table sanctions_watchlist enable row level security;

create policy "Authenticated staff can view the sanctions watchlist" on sanctions_watchlist
  for select using (auth.role() = 'authenticated');

-- Deliberately no insert/update/delete policy for regular authenticated
-- users — only the service_role key (used exclusively by the
-- sync-sanctions-list Edge Function, never exposed to the browser) can
-- write to this table, so no staff member's session can plant or remove
-- a sanctions entry.

-- Real fuzzy-name screening using trigram similarity (pg_trgm) — a
-- genuine, standard technique for approximate name matching, not a fake
-- "AI" claim. Returns real candidate matches above a similarity threshold;
-- every result still needs human review, exactly like OFAC's own official
-- Sanctions List Search tool states for its fuzzy matches.
create or replace function screen_name_against_sanctions(query_name text, min_similarity float default 0.35)
returns table (
  id uuid,
  source text,
  name text,
  entity_type text,
  programs text,
  similarity_score float
) as $$
  select
    id,
    source,
    name,
    entity_type,
    programs,
    similarity(name, query_name) as similarity_score
  from sanctions_watchlist
  where similarity(name, query_name) >= min_similarity
  order by similarity_score desc
  limit 20;
$$ language sql stable;
