-- Jobcore - archive / unarchive a job (admin-only, any status -> archived and back).
-- Apply after 0094.

-- Remembers the status a job had before it was archived so Unarchive can restore it.
alter table public.jobs add column if not exists archived_from_status public.job_status null;

comment on column public.jobs.archived_from_status is
  'Status the job had before it was archived; used by unarchive_job to restore it. Null when not archived.';

-- Archives a job from any status. No-op when already archived. Writes only
-- archived_from_status and status.
create or replace function public.archive_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  if not public.is_org_admin() then
    raise exception 'archive_job: admin role required' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'archive_job: job not found (id=%)', p_job_id using errcode = 'P0002';
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'archive_job: job % does not belong to current organization', p_job_id using errcode = '42501';
  end if;

  if v_job.status = 'archived' then
    return;
  end if;

  update public.jobs
  set archived_from_status = v_job.status,
      status = 'archived'
  where id = p_job_id;
end;
$$;

-- Restores an archived job to the status it had before (closed if unknown).
-- The one-open-job-per-customer trigger exception (customer_has_open_job,
-- P0001) is deliberately not caught and propagates to the caller.
create or replace function public.unarchive_job(p_job_id uuid)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_status public.job_status;
begin
  if not public.is_org_admin() then
    raise exception 'unarchive_job: admin role required' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'unarchive_job: job not found (id=%)', p_job_id using errcode = 'P0002';
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'unarchive_job: job % does not belong to current organization', p_job_id using errcode = '42501';
  end if;

  if v_job.status <> 'archived' then
    raise exception 'job is not archived' using errcode = '22023';
  end if;

  update public.jobs
  set status = coalesce(v_job.archived_from_status, 'closed'),
      archived_from_status = null
  where id = p_job_id
  returning status into v_status;

  return v_status;
end;
$$;

revoke all on function public.archive_job(uuid) from public;
grant execute on function public.archive_job(uuid) to authenticated;
revoke all on function public.unarchive_job(uuid) from public;
grant execute on function public.unarchive_job(uuid) to authenticated;
