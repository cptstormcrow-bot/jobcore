-- Jobcore — Screen #0024 Complete Job writes one job_notes row of kind
-- 'completion_checklist' per completion, and the field-tech app's JobNoteKind
-- union gained the same value. Widen the job_notes.kind CHECK constraint to
-- allow it alongside all six existing values (0051 is the latest definition)
-- so no value is lost. Idempotent: drops the constraint if present, then
-- re-adds it.
--
-- APPLIED to the live project 2026-10-23 via supabase db push (Jeff's go; pushed together with 0100_company_info.sql, a different piece of work, and with 0102).

alter table public.job_notes drop constraint if exists job_notes_kind_check;
alter table public.job_notes add constraint job_notes_kind_check
  check (kind in ('decline_reason', 'quality_notes', 'dispute', 'admin_correction', 're_estimate_flag', 'gotcha', 'completion_checklist'));

notify pgrst, 'reload schema';
