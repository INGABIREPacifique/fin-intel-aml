-- Stores the generated "why was this flagged" explanation per alert, along
-- with which method produced it — critical for honesty in the UI: an
-- analyst must always be able to tell a real LLM explanation apart from
-- the deterministic rule-based fallback, never presented as if it were AI
-- when it wasn't.
alter table alerts add column if not exists ai_explanation text;
alter table alerts add column if not exists ai_explanation_source text; -- 'anthropic' | 'rule_based'
alter table alerts add column if not exists ai_explanation_generated_at timestamptz;
