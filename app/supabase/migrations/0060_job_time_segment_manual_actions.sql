-- Jobcore — job_time_segments manual actions (voiding, labor accumulation, tech RPCs)
-- Apply after 0059 (open_time_segment tech_id guard).

-- ---------------------------------------------------------------------------
-- 1. job_time_segments.voided_at
-- ---------------------------------------------------------------------------

alter table public.job_time_segments add column voided_at timestamptz null;

-- ---------------------------------------------------------------------------
-- 2. jobs.total_labor_seconds
-- ---------------------------------------------------------------------------

alter table public.jobs add column total_labor_seconds numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 3. accumulate_job_time_segment() — AFTER INSERT OR UPDATE ON job_time_segments
-- ---------------------------------------------------------------------------

-- Adds a closed segment's duration onto the owning job's total_labor_seconds,
-- for reason_code in ('job_labor', 'travel') only, and only when the segment
-- is not voided. Guards against double-counting on UPDATE by only firing when
-- ended_at transitions from null to non-null (OLD.ended_at is null and
-- NEW.ended_at is not null); on INSERT there is no OLD row, so an
-- already-closed inserted row is counted once, unconditionally on NEW.ended_at
-- being non-null. This is a separate trigger on job_time_segments itself —
-- distinct from sync_job_time_segments_trg (0057), which fires on jobs and
-- drives segment creation, not accumulation.
create or replace function public.accumulate_job_time_segment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta_seconds numeric;
begin
  if new.reason_code not in ('job_labor', 'travel') then
    return new;
  end if;

  if new.voided_at is not null then
    return new;
  end if;

  if new.job_id is null then
    return new;
  end if;

  if new.ended_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.ended_at is not null then
    -- Already counted on a prior transition; not a null->non-null flip.
    return new;
  end if;

  v_delta_seconds := extract(epoch from (new.ended_at - new.started_at));

  update public.jobs
  set total_labor_seconds = total_labor_seconds + v_delta_seconds
  where id = new.job_id;

  return new;
end;
$$;

create trigger accumulate_job_time_segment_trg
  after insert or update of ended_at on public.job_time_segments
  for each row execute function public.accumulate_job_time_segment();

-- ---------------------------------------------------------------------------
-- 4. tech_open_time_segment(p_job_id, p_reason_code)
-- ---------------------------------------------------------------------------

-- Tech-scoped wrapper over open_time_segment(), resolved from auth.uid().
-- Rejects 'job_labor' and 'travel' — those stay trigger/resume-RPC-exclusive
-- (see sync_job_time_segments()/resume_job_labor_segment() below).
create or replace function public.tech_open_time_segment(
  p_job_id uuid,
  p_reason_code public.time_segment_reason
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason_code in ('job_labor', 'travel') then
    raise exception 'tech_open_time_segment: reason_code % is trigger/resume-exclusive, cannot be opened manually', p_reason_code;
  end if;

  perform public.open_time_segment(auth.uid(), p_job_id, p_reason_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. tech_close_time_segment(p_job_id)
-- ---------------------------------------------------------------------------

-- Mirrors close_time_segment()'s existing signature/behavior (0057),
-- scoped to the calling tech via auth.uid(). close_time_segment() closes
-- the tech's currently-open segment regardless of job_id (mirroring the
-- one-open-segment-per-tech invariant from 0056), so p_job_id is accepted
-- for call-site symmetry but not required to select the row.
create or replace function public.tech_close_time_segment(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.close_time_segment(auth.uid(), now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. resume_job_labor_segment(p_job_id)
-- ---------------------------------------------------------------------------

-- Lets a tech resume job_labor time on a job that was previously completed
-- (or is still in_progress), reopening the job if needed. Guards:
--   - caller must be the job's assigned_tech_id
--   - job.status must be 'in_progress' or 'completed'
--   - no non-voided open segment may already exist for (tech, job)
-- On resume from 'completed', flips status back to 'in_progress' and clears
-- completed_at, then opens a fresh 'job_labor' segment via open_time_segment().
create or replace function public.resume_job_labor_segment(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assigned_tech_id uuid;
  v_status text;
  v_open_exists boolean;
begin
  select assigned_tech_id, status
  into v_assigned_tech_id, v_status
  from public.jobs
  where id = p_job_id;

  if v_assigned_tech_id is null or v_assigned_tech_id is distinct from auth.uid() then
    raise exception 'resume_job_labor_segment: caller is not the assigned tech for job %', p_job_id;
  end if;

  if v_status not in ('in_progress', 'completed') then
    raise exception 'resume_job_labor_segment: job % status % is not resumable', p_job_id, v_status;
  end if;

  select exists (
    select 1
    from public.job_time_segments
    where job_id = p_job_id
      and tech_id = auth.uid()
      and ended_at is null
      and voided_at is null
  ) into v_open_exists;

  if v_open_exists then
    raise exception 'resume_job_labor_segment: an open segment already exists for job % / tech %', p_job_id, auth.uid();
  end if;

  if v_status = 'completed' then
    update public.jobs
    set status = 'in_progress',
        completed_at = null
    where id = p_job_id;
  end if;

  perform public.open_time_segment(auth.uid(), p_job_id, 'job_labor');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. reset_job_time_segments(p_job_id)
-- ---------------------------------------------------------------------------

-- Admin-only: voids every non-voided segment for the job and zeroes the
-- job's accumulated total_labor_seconds, in the same statement per segment
-- table plus a jobs update. Uses profiles.role = 'admin' exactly as
-- confirmed (public.user_role enum: owner, admin, tech, sales) — not the
-- broader is_org_admin() owner-or-admin check, per spec.
create or replace function public.reset_job_time_segments(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is distinct from 'admin' then
    raise exception 'reset_job_time_segments: caller is not an admin';
  end if;

  update public.job_time_segments
  set voided_at = now()
  where job_id = p_job_id
    and voided_at is null;

  update public.jobs
  set total_labor_seconds = 0
  where id = p_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

grant execute on function public.tech_open_time_segment(uuid, public.time_segment_reason) to authenticated;
grant execute on function public.tech_close_time_segment(uuid) to authenticated;
grant execute on function public.resume_job_labor_segment(uuid) to authenticated;
grant execute on function public.reset_job_time_segments(uuid) to authenticated;
