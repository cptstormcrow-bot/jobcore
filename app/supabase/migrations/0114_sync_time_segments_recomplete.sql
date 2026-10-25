-- Jobcore — migration 0114: sync_job_time_segments re-closes the segment when a
-- restarted job is completed again.
-- Fixes: a job restarted after completion keeps its old completed_at, so
-- re-completing wrote a new timestamp but old.completed_at was not null and the
-- segment never closed (job 603, 2026-10-24). The close now fires whenever
-- completed_at is set to a new value. completed_at history is preserved
-- (sales-marketing reads it). The trigger itself is untouched.
-- NOT applied live yet; held until Jeff says.

begin;

create or replace function public.sync_job_time_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Tech reassignment mid-job: force-close the old tech's open segment on this job and
  -- flag it for admin review, before evaluating the timestamp transitions below.
  if new.assigned_tech_id is distinct from old.assigned_tech_id
     and old.assigned_tech_id is not null
  then
    perform public.close_time_segment(old.assigned_tech_id, now());

    insert into public.job_time_segment_corrections (
      organization_id, segment_id, tech_id, note, requested_by
    )
    select
      s.organization_id, s.id, s.tech_id,
      'Auto-flagged: tech reassigned mid-job',
      old.assigned_tech_id
    from public.job_time_segments s
    where s.job_id = new.id
      and s.tech_id = old.assigned_tech_id
      and s.ended_at = now();
  end if;

  if old.en_route_at is null and new.en_route_at is not null then
    perform public.open_time_segment(new.assigned_tech_id, new.id, 'travel');
  end if;

  if old.in_progress_at is null and new.in_progress_at is not null then
    perform public.close_time_segment(new.assigned_tech_id, new.in_progress_at);
    perform public.open_time_segment(new.assigned_tech_id, new.id, 'job_labor');
  end if;

  if new.completed_at is not null and new.completed_at is distinct from old.completed_at then
    perform public.close_time_segment(new.assigned_tech_id, new.completed_at);
  end if;

  return new;
end;
$$;

commit;
