-- Jobcore - migration 0098: materials-onsite backfill
-- APPLIED to the live DB on 2026-10-22 via the live-push playbook (post-apply check: 10 arrived=true jobs, 0 without an onsite estimate).
--
-- The Prelim screen's "Materials arrived" (job_investigations.materials_arrived)
-- is retired in favour of job_estimates.materials_onsite. This one-time backfill
-- copies existing true answers across: it updates existing estimate rows, and
-- creates an estimate row (organization_id taken from jobs) for any job that
-- answered true but has none. Idempotent: re-running is a no-op.
-- The job_investigations.materials_arrived column is intentionally
-- retained.

update public.job_estimates e
set materials_onsite = true
from public.job_investigations i
where i.job_id = e.job_id
  and i.materials_arrived is true
  and e.materials_onsite = false;

-- Jobs that answered true but have no estimate row yet: create one, already ticked.
insert into public.job_estimates (job_id, organization_id, materials_onsite)
select i.job_id, j.organization_id, true
from public.job_investigations i
join public.jobs j on j.id = i.job_id
where i.materials_arrived is true
on conflict (job_id) do nothing;
