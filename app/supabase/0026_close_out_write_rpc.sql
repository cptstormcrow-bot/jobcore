-- Jobcore — close-out write RPC (collapses the completed -> paid transition,
-- its calendar-event log, its commission write, and its close-out-failure
-- resolution into one atomic statement).
-- Apply after 0025.

-- Advances a job from p_from_status to 'paid', logs the transition as a
-- calendar event, writes the job's one commission row, and resolves any
-- open/retrying close_out_failures row for the job — all inside a single
-- security definer transaction, so a partial failure between these four
-- writes (previously four sequential non-transactional calls from
-- modules/admin-finance/src/flows/close-out-job.ts) can no longer happen.
--
-- p_from_status is passed rather than hardcoded so the status guard reflects
-- the caller's actual precondition (mirrors the "cannot approve a %
-- reimbursement" pattern in 0009_reimbursement_review_rpcs.sql) instead of
-- silently assuming 'completed'.
--
-- security definer, stable search_path, row lock via `for update`, and full
-- schema-qualification follow the same rationale as public.is_org_admin()
-- and public.publish_price_sheet() in 0005_money.sql.
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
begin
  if not public.is_org_admin() then
    raise exception 'close_out_job_write: admin role required';
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

  update public.jobs set status = 'paid' where id = p_job_id
  returning * into v_job;

  insert into public.calendar_events (organization_id, job_id, kind, event_time, created_by)
  values (v_job.organization_id, v_job.id, 'status_change', now(), p_closed_by_user_id);

  insert into public.commissions (organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values (v_job.organization_id, v_job.id, p_closed_by_user_id, p_price_sheet_id, p_compensation_policy_id, p_commission_amount_cents);

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
