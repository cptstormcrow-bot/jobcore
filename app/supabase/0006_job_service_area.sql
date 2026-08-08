-- Jobcore P3 - job service area
-- Apply after 0005.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

-- Nullable: not every job is pre-assigned a service area at creation time.
-- on delete set null mirrors jobs.customer_id/jobs.service_id above - a
-- deleted service area must never cascade-delete a job.
alter table public.jobs
  add column service_area_id uuid references public.service_areas (id) on delete set null;

create index jobs_service_area_id_idx on public.jobs (service_area_id);
