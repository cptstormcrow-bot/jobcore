-- Jobcore — job intake detail columns.
-- Apply after 0029.

-- Adds nullable intake-detail fields captured during job creation/scheduling.
-- No defaults, no RLS policy changes: existing jobs_select_org/insert
-- policies on public.jobs already cover these new columns.
alter table public.jobs
  add column if not exists permit_status text,
  add column if not exists parking_available text,
  add column if not exists rooms text[],
  add column if not exists panel_info text,
  add column if not exists considerations text;
