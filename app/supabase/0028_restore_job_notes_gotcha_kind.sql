-- Jobcore — Fix regression: 0018_job_notes_gotcha_kind.sql added 'gotcha' as
-- a valid job_notes.kind value, but 0023_field_ops_segway_and_estimating.sql
-- later dropped and rebuilt the same CHECK constraint (to add
-- 're_estimate_flag') without preserving 'gotcha', silently dropping it from
-- the live constraint. Re-add it alongside all five existing values so no
-- value is lost. Apply after 0027.

alter table public.job_notes drop constraint job_notes_kind_check;
alter table public.job_notes add constraint job_notes_kind_check
  check (kind in ('decline_reason', 'quality_notes', 'dispute', 'admin_correction', 're_estimate_flag', 'gotcha'));
