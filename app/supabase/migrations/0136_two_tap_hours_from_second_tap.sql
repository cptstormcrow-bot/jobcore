-- Jobcore — migration 0136: hours run from the SECOND (confirming) tap.
-- 0135 re-stamped the first tapper's segment to their own tap time. Jeff
-- (2026-11-08): "second tap" — both techs' time runs from the confirming tap,
-- which is the job's real start/complete time the 0134 trigger already mirrors
-- to every tech. So the trigger now only clears the pending request.
-- NOT applied live yet; held until Jeff names this number.

begin;

create or replace function public.clear_job_step_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.in_progress_at is not null and old.in_progress_at is null then
    delete from public.job_step_requests where job_id = new.id and step = 'start';
  end if;
  if new.completed_at is not null and old.completed_at is null then
    delete from public.job_step_requests where job_id = new.id and step = 'complete';
  end if;
  return new;
end;
$$;

commit;
