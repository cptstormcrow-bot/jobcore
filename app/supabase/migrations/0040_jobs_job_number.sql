-- 0040: sequential job number on jobs. Numbering is GLOBAL across organizations (not per-org), by design (plan decision S1, 2026-09-03).

create sequence if not exists public.jobs_job_number_seq;

alter table public.jobs add column if not exists job_number integer;

-- Backfill runs as the migration role, which is not an org admin, so the
-- jobs_tech_update_whitelist_trg trigger (public.jobs_tech_update_whitelist)
-- would reject it. Disable it around the backfill only.
alter table public.jobs disable trigger jobs_tech_update_whitelist_trg;

with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.jobs
  where job_number is null
)
update public.jobs j
set job_number = o.rn + coalesce((select max(job_number) from public.jobs), 0)
from ordered o
where j.id = o.id;

alter table public.jobs enable trigger jobs_tech_update_whitelist_trg;

select setval('public.jobs_job_number_seq', coalesce((select max(job_number) from public.jobs), 0) + 1, false);

alter table public.jobs alter column job_number set default nextval('public.jobs_job_number_seq');

alter table public.jobs alter column job_number set not null;

alter sequence public.jobs_job_number_seq owned by public.jobs.job_number;

create unique index if not exists jobs_job_number_key on public.jobs (job_number);
