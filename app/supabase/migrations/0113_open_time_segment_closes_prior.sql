-- Jobcore — migration 0113: open_time_segment closes the tech's existing open
-- segment before inserting.
-- Fixes: duplicate key job_time_segments_one_open_per_tech when a job is
-- restarted/re-entered, or a tech starts a second job while a segment is
-- still open.
-- NOT applied live yet; held until Jeff says.

begin;

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

  -- A tech has at most one open segment (unique index
  -- job_time_segments_one_open_per_tech from 0056), so close any existing
  -- open one before inserting the new one.
  update public.job_time_segments
  set ended_at = greatest(now(), started_at)
  where tech_id = p_tech_id
    and ended_at is null;

  insert into public.job_time_segments (
    organization_id, job_id, tech_id, reason_code, started_at, source, created_by
  ) values (
    v_organization_id, p_job_id, p_tech_id, p_reason_code, now(), 'trigger', p_tech_id
  );
end;
$$;

commit;
