-- Jobcore — close_out_job_write supports paid -> closed.
-- Apply after 0104.

-- Why: jobs reach Close-Out already 'paid', because the payment screen
-- advances them. The RPC from 0026 only supported completed -> paid, so
-- "Close out job" failed for those jobs.
--
-- Now the destination status follows p_from_status:
--   completed -> paid   and   paid -> closed both write the job's one
--   commission row. Jobs that arrived at 'paid' via the payment screen get
--   theirs at close-out. The insert is idempotent (on conflict do nothing),
--   so a retry or an existing row is a no-op.
-- Any other p_from_status raises. The calendar-event insert and the
-- close-out-failure resolution are unchanged. Idempotent create or replace;
-- signature, security attributes and grants are identical to 0026.
create or replace function public.close_out_job_write(
  p_job_id uuid,
  p_from_status public.job_status,
  p_price_sheet_id uuid,
  p_compensation_policy_id uuid,
  p_commission_amount_cents integer,
  p_closed_by_user_id uuid
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_to_status public.job_status;
begin
  if not public.is_org_admin() then
    raise exception 'close_out_job_write: admin role required';
  end if;

  v_to_status := case p_from_status
    when 'completed' then 'paid'
    when 'paid' then 'closed'
  end;

  if v_to_status is null then
    raise exception 'close_out_job_write: unsupported from-status % (expected completed or paid, id=%)', p_from_status, p_job_id;
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'close_out_job_write: job not found (id=%)', p_job_id;
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'close_out_job_write: job % does not belong to current organization', p_job_id;
  end if;

  if v_job.status <> p_from_status then
    raise exception 'close_out_job_write: cannot close out a % job (expected %, id=%)', v_job.status, p_from_status, p_job_id;
  end if;

  update public.jobs set status = v_to_status where id = p_job_id
  returning * into v_job;

  insert into public.calendar_events (organization_id, job_id, kind, event_time, created_by)
  values (v_job.organization_id, v_job.id, 'status_change', now(), p_closed_by_user_id);

  insert into public.commissions (organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values (v_job.organization_id, v_job.id, p_closed_by_user_id, p_price_sheet_id, p_compensation_policy_id, p_commission_amount_cents)
  on conflict (job_id) where voided_at is null do nothing;

  update public.close_out_failures
  set status = 'resolved_retry',
      resolved_by = p_closed_by_user_id,
      resolved_at = now(),
      updated_at = now()
  where job_id = p_job_id
    and status in ('open', 'retrying');

  return v_job;
end;
$$;

revoke all on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) from public;
grant execute on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) to authenticated;

-- verification (one row): true once the live function handles 'closed'
select pg_get_functiondef('public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid)'::regprocedure) like '%closed%' as close_out_supports_closed;
