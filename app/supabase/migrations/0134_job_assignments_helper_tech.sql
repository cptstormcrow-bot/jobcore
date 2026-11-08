-- Jobcore — migration 0134: a second Service Tech ("Helper Tech") on a job.
-- A helper is a job_assignments row with kind = 'helper'. The existing tech RLS
-- on jobs / job_investigations / photos / notes joins job_assignments with no
-- kind filter, so the helper sees and works the job exactly like the lead tech.
-- jobs.assigned_tech_id stays the single lead Service Tech.
--
-- Hours: the helper gets their OWN job_time_segments rows (so payroll prices
-- them at their own hourly rate, #0043), mirroring the job's Travel / Arrive /
-- Complete times. If the helper is added after the job already started, a
-- segment opens at that moment; if removed, it closes at that moment.
-- NOT applied live yet; held until Jeff names this number.

begin;

alter table public.job_assignments drop constraint if exists job_assignments_kind_check;
alter table public.job_assignments
  add constraint job_assignments_kind_check
  check (kind in ('installer', 'investigator', 'helper'));

create or replace function public.sync_job_time_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_helper uuid;
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
    for v_helper in
      select a.tech_id from public.job_assignments a
      where a.job_id = new.id and a.kind = 'helper'
    loop
      perform public.open_time_segment(v_helper, new.id, 'travel', new.en_route_at);
    end loop;
  end if;

  if old.in_progress_at is null and new.in_progress_at is not null then
    perform public.close_time_segment(
      new.assigned_tech_id, public.clamp_event_time(new.in_progress_at));
    perform public.open_time_segment(
      new.assigned_tech_id, new.id, 'job_labor', new.in_progress_at);
    for v_helper in
      select a.tech_id from public.job_assignments a
      where a.job_id = new.id and a.kind = 'helper'
    loop
      perform public.close_time_segment(v_helper, public.clamp_event_time(new.in_progress_at));
      perform public.open_time_segment(v_helper, new.id, 'job_labor', new.in_progress_at);
    end loop;
  end if;

  if new.completed_at is not null and new.completed_at is distinct from old.completed_at then
    perform public.close_time_segment(new.assigned_tech_id, new.completed_at);
    for v_helper in
      select a.tech_id from public.job_assignments a
      where a.job_id = new.id and a.kind = 'helper'
    loop
      perform public.close_time_segment(v_helper, new.completed_at);
    end loop;
  end if;

  return new;
end;
$$;

-- Helper added / removed after the job is under way.
create or replace function public.sync_helper_time_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.kind <> 'helper' then
      return new;
    end if;
    select * into v_job from public.jobs where id = new.job_id;
    if v_job.completed_at is not null then
      return new;
    end if;
    if v_job.in_progress_at is not null then
      perform public.open_time_segment(new.tech_id, new.job_id, 'job_labor', now());
    elsif v_job.en_route_at is not null then
      perform public.open_time_segment(new.tech_id, new.job_id, 'travel', now());
    end if;
    return new;
  end if;

  -- DELETE
  if old.kind = 'helper' then
    update public.job_time_segments
    set ended_at = greatest(now(), started_at)
    where tech_id = old.tech_id
      and job_id = old.job_id
      and ended_at is null;
  end if;
  return old;
end;
$$;

drop trigger if exists job_assignments_helper_segments on public.job_assignments;
create trigger job_assignments_helper_segments
  after insert or delete on public.job_assignments
  for each row execute function public.sync_helper_time_segments();

commit;
