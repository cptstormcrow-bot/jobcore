-- Jobcore — open_time_segment() null-tech_id guard
-- Apply after 0058.

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
    raise exception 'open_time_segment: tech_id is null, cannot open a time segment (job_id=%, reason_code=%)', p_job_id, p_reason_code;
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
