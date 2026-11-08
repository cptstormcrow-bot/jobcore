-- Jobcore — migration 0136: the lead tech alone starts and stops a job; each tech's
-- hours come from their own clock-in (Jeff 2026-11-08).
-- 1) Drops the two-tap gate from 0135 (requests table, gate/pending functions, trigger).
-- 2) Restores sync_job_time_segments to the lead tech only: the job's Start / Complete
--    taps no longer write hours rows for a Helper Tech.
-- 3) Drops the helper add/remove segment trigger from 0134 (a helper's hours are never
--    opened or closed by assignment).
-- The helper assignment itself (job_assignments.kind = 'helper', RLS access) stays.
-- NOT applied live yet; held until Jeff names this number.

begin;

drop trigger if exists zjobs_clear_step_requests on public.jobs;
drop function if exists public.clear_job_step_requests();
drop function if exists public.job_step_pending(uuid);
drop function if exists public.job_step_gate(uuid, text, boolean);
drop table if exists public.job_step_requests;

drop trigger if exists job_assignments_helper_segments on public.job_assignments;
drop function if exists public.sync_helper_time_segments();

create or replace function public.sync_job_time_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Tech reassignment mid-job (admin, online): close at now() and flag for review.
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
    perform public.open_time_segment(
      new.assigned_tech_id, new.id, 'travel', new.en_route_at);
  end if;

  if old.in_progress_at is null and new.in_progress_at is not null then
    perform public.close_time_segment(
      new.assigned_tech_id, public.clamp_event_time(new.in_progress_at));
    perform public.open_time_segment(
      new.assigned_tech_id, new.id, 'job_labor', new.in_progress_at);
  end if;

  if new.completed_at is not null and new.completed_at is distinct from old.completed_at then
    perform public.close_time_segment(new.assigned_tech_id, new.completed_at);
  end if;

  return new;
end;
$$;

commit;
