-- Jobcore — open_time_segment() null tech_id guard
-- Apply after 0057.
--
-- job_time_segments.tech_id is uuid not null (0056). When a job has only an
-- investigator assigned (no installer tech), sync_job_time_segments_trg
-- (0057) can call open_time_segment() with a null p_tech_id, violating the
-- not-null constraint and crashing the live Arrive flow. Guard: no-op if
-- p_tech_id is null instead of attempting the insert.

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
  if p_tech_id is null then
    return;
  end if;

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
