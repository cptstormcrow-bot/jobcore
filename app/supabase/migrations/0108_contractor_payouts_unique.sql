-- Jobcore - 0108 contractor_payouts unique (job_id, tech_id).
-- Apply after 0107.

-- Why: the app repository inserts a contractor payout with a check-then-insert.
-- A retry or a race could slip a second row in for the same job and technician.
-- A unique key on (job_id, tech_id) makes the database refuse the second row.
--
-- Idempotent: the constraint is added only if contractor_payouts_job_tech_uniq
-- does not already exist. Fails loudly: if any (job_id, tech_id) pair already
-- has more than one row, the block raises and nothing is changed; resolve the
-- duplicates first, then re-run. Nothing is backfilled.
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes
  from (
    select job_id, tech_id
    from public.contractor_payouts
    group by job_id, tech_id
    having count(*) > 1
  ) d;

  if v_dupes > 0 then
    raise exception '0108: % duplicate (job_id, tech_id) group(s) in public.contractor_payouts; resolve duplicates first, then re-run', v_dupes;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contractor_payouts'::regclass
      and conname = 'contractor_payouts_job_tech_uniq'
  ) then
    alter table public.contractor_payouts
      add constraint contractor_payouts_job_tech_uniq unique (job_id, tech_id);
  end if;
end
$$;

-- verification: contractor_payouts_job_tech_uniq listed as UNIQUE (job_id, tech_id)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.contractor_payouts'::regclass
  and contype = 'u';
