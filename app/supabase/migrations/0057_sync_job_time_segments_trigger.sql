-- Jobcore — sync_job_time_segments() trigger (unified time tracking)
-- Apply after 0056.
--
-- Bulk-backfill gotcha (memory jobcore-supabase-db-query-quirks.md): just like
-- jobs_tech_update_whitelist_trg (0008) must be disabled/re-enabled around historical
-- `jobs` backfills, this trigger will also fire on any bulk `UPDATE ... jobs` touching
-- en_route_at/in_progress_at/completed_at. Disable it before any such backfill:
--   alter table public.jobs disable trigger sync_job_time_segments_trg;
-- and re-enable after:
--   alter table public.jobs enable trigger sync_job_time_segments_trg;

-- ---------------------------------------------------------------------------
-- 1. open_time_segment(tech_id, job_id, reason_code)
-- ---------------------------------------------------------------------------

-- Inserts a new job_time_segments row with source = 'trigger' explicitly set
-- (never 'manual' — that boundary is enforced by job_time_segments_insert_own
-- in 0056). security definer so it can write regardless of the calling
-- session's RLS context, mirroring the security-definer RPC pattern used
-- elsewhere in this schema (e.g. approve_reimbursement in 0025).
create or replace function public.open_time_segment(
  p_tech_id uuid,
  p_job_id uuid,
  p_reason_code public.time_segment_reason
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id
  from public.jobs
  where id = p_job_id;

  insert into public.job_time_segments (
    organization_id, job_id, tech_id, reason_code, started_at, source, created_by
  ) values (
    v_organization_id, p_job_id, p_tech_id, p_reason_code, now(), 'trigger', p_tech_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. close_time_segment(tech_id, ended_at)
-- ---------------------------------------------------------------------------

-- Closes the tech's currently-open segment, if any. Idempotent no-op if
-- already closed (relies on job_time_segments_one_open_per_tech from 0056 —
-- at most one open row per tech).
create or replace function public.close_time_segment(
  p_tech_id uuid,
  p_ended_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_time_segments
  set ended_at = p_ended_at
  where tech_id = p_tech_id
    and ended_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. sync_job_time_segments() — AFTER UPDATE ON jobs
-- ---------------------------------------------------------------------------

-- Per plan section "Migration 0057_job_time_segment_sync_trigger.sql":
--   - en_route_at newly set      -> open_time_segment(assigned_tech, job_id, 'travel')
--   - in_progress_at newly set   -> close_time_segment(assigned_tech, in_progress_at)
--                                    (closes travel) then open_time_segment(..., 'job_labor')
--   - completed_at newly set     -> close_time_segment(assigned_tech, completed_at)
--   - Tech reassignment mid-job: if assigned_tech_id changes while a segment for the old
--     tech is open, force-close the old tech's segment at the reassignment timestamp and
--     insert a flagged job_time_segment_corrections row (status 'pending', note auto-filled)
--     so an admin reviews the truncated segment rather than it silently vanishing.
--   - Idempotent replay-safe: only fires on old.<col> is null and new.<col> is not null
--     transitions, not just presence.
--
-- AFTER UPDATE (not BEFORE): the existing jobs_tech_update_whitelist_trg (0008) is a
-- BEFORE UPDATE trigger — different timing bucket, no conflict (plan's "Trigger ordering"
-- note).
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

  if old.completed_at is null and new.completed_at is not null then
    perform public.close_time_segment(new.assigned_tech_id, new.completed_at);
  end if;

  return new;
end;
$$;

create trigger sync_job_time_segments_trg
  after update on public.jobs
  for each row execute function public.sync_job_time_segments();
