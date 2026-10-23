-- Jobcore - migration 0098: materials-onsite backfill
-- UNAPPLIED. Written only; Jeff applies it via the live-push playbook.
--
-- The Prelim screen's "Materials arrived" (job_investigations.materials_arrived)
-- is retired in favour of job_estimates.materials_onsite. This one-time update
-- copies existing true answers across. Update-only (no inserts); idempotent:
-- re-running is a no-op. The job_investigations.materials_arrived column is
-- intentionally retained.

update public.job_estimates e
set materials_onsite = true
from public.job_investigations i
where i.job_id = e.job_id
  and i.materials_arrived is true
  and e.materials_onsite = false;
