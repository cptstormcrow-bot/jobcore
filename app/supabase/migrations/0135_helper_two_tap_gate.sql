-- Jobcore — migration 0135: two-tap Start / Complete when a job has a Helper Tech.
-- On a job with a helper (job_assignments.kind = 'helper'), the first tech to tap
-- Start (or Complete) only records a request; the OTHER tech's tap on their own
-- device concurs and lets the real lifecycle write happen (Jeff 2026-11-08).
-- Jobs with no helper stay single-tap. The gate is advisory UI plumbing: the
-- lifecycle write itself is still the existing tech-whitelisted jobs update, so
-- the job's start/complete time is the second tap and both techs' segments
-- (0134 trigger) follow it.
-- An admin counts as one of the two taps (pairs with the lead or helper tech);
-- p_override lets an admin start/finish alone. Each tech's hours run from their
-- OWN tap: the first tapper's segment is re-stamped to their request time.
-- NOT applied live yet; held until Jeff names this number.

begin;

create table if not exists public.job_step_requests (
  job_id uuid not null references public.jobs(id) on delete cascade,
  step text not null check (step in ('start', 'complete')),
  tech_id uuid not null,
  requested_at timestamptz not null default now(),
  primary key (job_id, step)
);

alter table public.job_step_requests enable row level security;
-- No direct policies: all access is through the security-definer functions below.

-- 'proceed' (do the real write now) or 'waiting' (your request is recorded).
drop function if exists public.job_step_gate(uuid, text);
create or replace function public.job_step_gate(p_job_id uuid, p_step text, p_override boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_uid uuid := auth.uid();
  v_has_helper boolean;
  v_req public.job_step_requests%rowtype;
begin
  if p_step not in ('start', 'complete') then
    raise exception 'job_step_gate: unknown step %', p_step;
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if not found or v_job.organization_id <> public.current_org_id() then
    raise exception 'job_step_gate: job not found';
  end if;
  if not public.is_org_admin() and not (v_job.assigned_tech_id = v_uid or exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id and a.tech_id = v_uid and a.kind = 'helper')) then
    raise exception 'job_step_gate: not a tech on this job';
  end if;

  select exists (select 1 from public.job_assignments a
    where a.job_id = p_job_id and a.kind = 'helper') into v_has_helper;
  if not v_has_helper then
    return 'proceed';
  end if;
  if p_step = 'start' and v_job.in_progress_at is not null then
    return 'proceed';
  end if;
  if p_override and public.is_org_admin() then
    delete from public.job_step_requests where job_id = p_job_id and step = p_step;
    return 'proceed';
  end if;

  select * into v_req from public.job_step_requests
    where job_id = p_job_id and step = p_step;
  if found and v_req.tech_id <> v_uid then
    delete from public.job_step_requests where job_id = p_job_id and step = p_step;
    return 'proceed';
  end if;
  if not found then
    insert into public.job_step_requests (job_id, step, tech_id)
    values (p_job_id, p_step, v_uid);
  end if;
  return 'waiting';
end;
$$;

-- Pending requests on a job, for the partner's "Confirm ..." button.
create or replace function public.job_step_pending(p_job_id uuid)
returns table (step text, tech_id uuid, requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.step, r.tech_id, r.requested_at
  from public.job_step_requests r
  join public.jobs j on j.id = r.job_id
  where r.job_id = p_job_id
    and j.organization_id = public.current_org_id();
$$;

-- A pending request dies when its step actually lands (or the job is reset).
create or replace function public.clear_job_step_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.job_step_requests%rowtype;
begin
  if new.in_progress_at is not null and old.in_progress_at is null then
    select * into v_req from public.job_step_requests where job_id = new.id and step = 'start';
    if found then
      update public.job_time_segments
      set ended_at = greatest(started_at, v_req.requested_at)
      where job_id = new.id and tech_id = v_req.tech_id
        and reason_code = 'travel' and ended_at > v_req.requested_at;
      update public.job_time_segments
      set started_at = v_req.requested_at
      where job_id = new.id and tech_id = v_req.tech_id
        and reason_code = 'job_labor' and started_at > v_req.requested_at;
    end if;
    delete from public.job_step_requests where job_id = new.id and step = 'start';
  end if;
  if new.completed_at is not null and old.completed_at is null then
    select * into v_req from public.job_step_requests where job_id = new.id and step = 'complete';
    if found then
      update public.job_time_segments
      set ended_at = greatest(started_at, v_req.requested_at)
      where job_id = new.id and tech_id = v_req.tech_id
        and reason_code = 'job_labor' and ended_at > v_req.requested_at;
    end if;
    delete from public.job_step_requests where job_id = new.id and step = 'complete';
  end if;
  return new;
end;
$$;

-- Named to sort AFTER sync_job_time_segments_trg so the segments exist when we re-stamp them.
drop trigger if exists jobs_clear_step_requests on public.jobs;
drop trigger if exists zjobs_clear_step_requests on public.jobs;
create trigger zjobs_clear_step_requests
  after update on public.jobs
  for each row execute function public.clear_job_step_requests();

grant execute on function public.job_step_gate(uuid, text, boolean) to authenticated;
grant execute on function public.job_step_pending(uuid) to authenticated;

commit;
