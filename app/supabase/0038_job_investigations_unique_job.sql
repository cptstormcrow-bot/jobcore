-- 0038_job_investigations_unique_job.sql
-- Adds a unique constraint on job_investigations.job_id so upsertForJob-style writes can
-- use onConflict: 'job_id' (matching EstimateRepository/JobPlanningRepository's existing idiom).

alter table public.job_investigations
  add constraint job_investigations_job_id_key unique (job_id);
