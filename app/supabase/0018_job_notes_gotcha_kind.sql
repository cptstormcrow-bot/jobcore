-- Jobcore Workstream I-2 — add 'gotcha' to job_notes.kind allowed values.
-- Apply after 0017. Widens job_notes_kind_check (0007_field_tech_tables.sql)
-- to accept a new note kind, 'gotcha', alongside the existing
-- decline_reason / quality_notes / dispute / admin_correction values.

alter table public.job_notes
  drop constraint job_notes_kind_check;

alter table public.job_notes
  add constraint job_notes_kind_check
    check (kind in ('decline_reason', 'quality_notes', 'dispute', 'admin_correction', 'gotcha'));
