-- Adds a separate field for reviewer amendments, kept distinct from the
-- auto-generated narrative so the SAR Filing screen can show both (matches
-- the Figma "Generated Narrative" + "Reviewer Amendments (Optional)" split).
alter table sar_filings add column if not exists reviewer_amendments text;

-- "on_hold" is a real status alongside draft | pending_review | rejected | filed,
-- used by the new "Hold" action (distinct from Return/Reject) on the SAR Filing screen.
-- No CHECK constraint exists on sar_filings.status today, so no migration is
-- needed beyond documenting the new value here.
