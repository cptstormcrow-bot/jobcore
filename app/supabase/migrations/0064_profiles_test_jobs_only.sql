-- Jobcore — "Assign only to Test Jobs" per-employee flag (Assignment Board s10-5).
-- Apply after 0063. Additive; profiles RLS unchanged.
alter table public.profiles
  add column if not exists test_jobs_only boolean not null default false;

comment on column public.profiles.test_jobs_only is
  'Admin-set: true = this employee may only be offered on beta/test jobs (jobs.is_beta or source = ''job-simulator''); real jobs never list them. Default false.';
