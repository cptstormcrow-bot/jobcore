-- 0061_job_simulator_source.sql
-- Widen jobs_source_check to allow 'job-simulator' as an explicit source value.
-- Strictly additive: all previously allowed values remain allowed.
alter table public.jobs
  drop constraint if exists jobs_source_check;

alter table public.jobs
  add constraint jobs_source_check
  check (source is null or source in ('website', 'costco', 'ikea', 'owm', 'beta-test', 'job-simulator'));
