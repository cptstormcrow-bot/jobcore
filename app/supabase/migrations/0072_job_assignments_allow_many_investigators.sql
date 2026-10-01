-- 0072_job_assignments_allow_many_investigators.sql
--
-- Jobs may now have many techs assigned at once (Jeff decision 2026-09-30),
-- so the one-investigator-per-job partial unique index is dropped.

drop index if exists public.job_assignments_one_investigator_per_job;
