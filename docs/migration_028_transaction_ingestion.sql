-- Integration-ready transaction ingestion: the schema and pipeline a real
-- bank, mobile money provider, or trading venue could plug into. Nothing
-- here is connected to a real institution today — no such integration is
-- possible from this environment — but this is the real architecture a
-- production connection would use, not a placeholder. It reuses the
-- platform's existing, already-real API key system (api_keys table, built
-- for the API Gateway screen) rather than inventing a separate auth scheme.
create table if not exists transaction_ingestion_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id),
  api_key_id uuid references api_keys(id),
  external_transaction_id text, -- the sending institution's own reference
  sender_account text,
  sender_name text,
  sender_bank_bic text,
  receiver_account text,
  receiver_name text,
  receiver_bank_bic text,
  amount numeric not null,
  currency text not null default 'USD',
  transaction_type text, -- wire_transfer | mobile_money | card | cash_deposit | securities
  occurred_at timestamptz not null,
  raw_payload jsonb, -- the full original submitted payload, kept for audit/debugging
  received_at timestamptz default now(),
  flagged boolean not null default false,
  resulting_alert_id uuid references alerts(id)
);

alter table transaction_ingestion_log enable row level security;

create policy "Authenticated staff can view ingested transactions" on transaction_ingestion_log
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policy for regular sessions — only the
-- service_role key used exclusively by the ingest-transaction Edge
-- Function writes here, authenticated by a real institution API key, not
-- by a staff member's own login.

create index if not exists transaction_ingestion_log_institution_idx
  on transaction_ingestion_log (institution_id, occurred_at desc);
