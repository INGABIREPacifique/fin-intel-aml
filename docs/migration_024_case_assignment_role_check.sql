-- The existing "Authenticated staff can update cases" RLS policy allows any
-- logged-in staff member to update any column on a case, including
-- assigned_to — meaning until now, an investigator could reassign a case
-- (to themselves or anyone) directly via the API, bypassing the UI, which
-- only exposes that action to compliance_officer/admin. RLS policies alone
-- can't restrict a single column's changes (USING/WITH CHECK can't compare
-- OLD vs NEW), so this uses a trigger instead — the correct tool for
-- column-level write restrictions in Postgres.
create or replace function enforce_case_assignment_role()
returns trigger as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    if not exists (
      select 1 from profiles
      where id = auth.uid() and role in ('compliance_officer', 'admin')
    ) then
      raise exception 'Only a compliance officer or admin can assign or reassign a case.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists case_assignment_role_check on cases;
create trigger case_assignment_role_check
  before update on cases
  for each row
  execute function enforce_case_assignment_role();
