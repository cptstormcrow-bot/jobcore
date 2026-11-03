-- Jobcore - migration 0119: reset a job's time to 0 so a return or a test can start fresh
--
-- What: reset_job_labor_time voids every time segment on the job (voided
-- segments never count toward total_labor_seconds), zeroes the job's total,
-- and, when the job is still running, restarts the clock from the reset
-- moment (a fresh job_labor or travel segment, and in_progress_at /
-- en_route_at moved to that moment so the on-screen timer starts at 0).
-- Status, tech and schedule are left alone; the admin "Reset job" is the
-- full wipe back to New. Logged on the calendar.
--
-- Who: an org admin or owner, or the job's assigned tech. Closed and
-- archived jobs are refused (their pay may already be posted).
--
-- Not applied live until Jeff approves the push.
--
-- Idempotent: create or replace function.

begin;

create or replace function public.reset_job_labor_time(
  p_job_id uuid,
  p_reset_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_at  timestamptz;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'reset_job_labor_time: job not found (id=%)', p_job_id
      using errcode = 'P0002';
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'reset_job_labor_time: job % does not belong to current organization', p_job_id
      using errcode = '42501';
  end if;

  if not public.is_org_admin()
     and (v_job.assigned_tech_id is null or v_job.assigned_tech_id <> auth.uid()) then
    raise exception 'reset_job_labor_time: only an admin or the assigned tech can reset this job''s time'
      using errcode = '42501';
  end if;

  if v_job.status in ('closed', 'archived') then
    raise exception 'reset_job_labor_time: job % is %, reopen it first', p_job_id, v_job.status
      using errcode = '22023';
  end if;

  v_at := public.clamp_event_time(p_reset_at);

  -- Void (and close) every live segment on this job. The accumulate trigger
  -- skips voided rows, so closing them here adds nothing to the total.
  update public.job_time_segments
  set voided_at = now(),
      ended_at = coalesce(ended_at, greatest(v_at, started_at))
  where job_id = p_job_id
    and voided_at is null;

  -- open_time_segment never starts before the tech's latest segment start;
  -- match it so the job's start stamp and the new segment agree.
  if v_job.assigned_tech_id is not null then
    v_at := greatest(
      v_at,
      coalesce(
        (select max(s.started_at) from public.job_time_segments s where s.tech_id = v_job.assigned_tech_id),
        '-infinity'::timestamptz
      )
    );
  end if;

  update public.jobs set total_labor_seconds = 0 where id = p_job_id;

  -- A running clock restarts from the reset moment. in_progress_at /
  -- en_route_at are already set, so sync_job_time_segments does nothing here.
  if v_job.status = 'in_progress' and v_job.assigned_tech_id is not null then
    update public.jobs set in_progress_at = v_at where id = p_job_id;
    perform public.open_time_segment(v_job.assigned_tech_id, p_job_id, 'job_labor', v_at);
  elsif v_job.status = 'en_route' and v_job.assigned_tech_id is not null then
    update public.jobs set en_route_at = v_at where id = p_job_id;
    perform public.open_time_segment(v_job.assigned_tech_id, p_job_id, 'travel', v_at);
  end if;

  insert into public.calendar_events (organization_id, job_id, kind, event_time, created_by)
  values (v_job.organization_id, v_job.id, 'status_change', now(), auth.uid());
end;
$$;

revoke all on function public.reset_job_labor_time(uuid, timestamptz) from public, anon;
grant execute on function public.reset_job_labor_time(uuid, timestamptz) to authenticated;

commit;
