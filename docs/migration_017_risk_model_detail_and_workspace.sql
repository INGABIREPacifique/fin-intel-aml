-- Run in Supabase SQL Editor (New query)

-- ===== 1. Risk Model Detail: real tunable parameters =====
alter table risk_models add column if not exists max_window_hours int default 72;
alter table risk_models add column if not exists min_node_count int default 3;
alter table risk_models add column if not exists loop_retention_ratio int default 85;
alter table risk_models add column if not exists currency_normalization boolean default true;

-- ===== 2. Multi-Agency Case Workspace =====

-- Task force membership per case (real, tied to real cases + profiles)
create table if not exists case_task_force (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  member_id uuid references profiles(id),
  agency_label text not null,  -- e.g. "FinCEN (US)", "Interpol (EU)"
  role_label text not null,    -- e.g. "Lead Analyst", "Liaison Officer"
  created_at timestamptz default now()
);

-- Threaded evidence & comm log per case
create table if not exists case_evidence_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  attachment_label text,
  pinned boolean not null default false,
  created_at timestamptz default now()
);

-- Key milestones timeline per case
create table if not exists case_milestones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'pending', -- done | pending
  occurred_on date,
  sort_order int not null default 0
);

-- Action items checklist per case
create table if not exists case_action_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  title text not null,
  assigned_to uuid references profiles(id),
  due_label text,
  done boolean not null default false,
  created_at timestamptz default now()
);

alter table case_task_force enable row level security;
alter table case_evidence_log enable row level security;
alter table case_milestones enable row level security;
alter table case_action_items enable row level security;

create policy "Authenticated staff can view case_task_force" on case_task_force for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can manage case_task_force" on case_task_force for all using (auth.role() = 'authenticated');

create policy "Authenticated staff can view case_evidence_log" on case_evidence_log for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can insert case_evidence_log" on case_evidence_log for insert with check (auth.uid() = author_id);
create policy "Authenticated staff can update case_evidence_log" on case_evidence_log for update using (auth.role() = 'authenticated');

create policy "Authenticated staff can view case_milestones" on case_milestones for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can manage case_milestones" on case_milestones for all using (auth.role() = 'authenticated');

create policy "Authenticated staff can view case_action_items" on case_action_items for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can manage case_action_items" on case_action_items for all using (auth.role() = 'authenticated');

-- Seed a real workspace for the Apex Global case (CASE-2023-8942) so the
-- screen has something real to show immediately.
insert into case_milestones (case_id, title, detail, status, occurred_on, sort_order)
select id, 'Initial SAR Filed', 'Global Bank Corp', 'done', '2023-10-12'::date, 1 from cases where case_code = 'CASE-2023-8942'
union all
select id, 'Task Force Formed', 'FinCEN / Interpol', 'done', '2023-11-05'::date, 2 from cases where case_code = 'CASE-2023-8942'
union all
select id, 'Asset Freeze Execution', 'Awaiting Court Order', 'pending', null::date, 3 from cases where case_code = 'CASE-2023-8942';

insert into case_action_items (case_id, title, due_label)
select id, 'Verify beneficial ownership of Cyprus entities.', 'DUE TODAY' from cases where case_code = 'CASE-2023-8942'
union all
select id, 'Compile cross-border wire history (2021-2023).', 'DUE TOMORROW' from cases where case_code = 'CASE-2023-8942';
