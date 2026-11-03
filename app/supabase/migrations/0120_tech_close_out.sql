-- Jobcore - migration 0120: the assigned tech can close out a job
--
-- What: close_out_job_write now lets the job's assigned tech move it
-- completed -> paid -> closed, not only an org admin. A tech's close-out is
-- a status change only: the commission row is written only when the caller
-- is an admin, and a tech's close is always logged as the tech themself.
-- Pay (job_payout_lines, contractor payouts) stays admin-only; an admin
-- posts it later by reopening the job and closing it out (Jeff 2026-11-03,
-- Option A). Pay policy, price sheets and other techs' pay stay hidden.
--
-- Who: an org admin or owner, or the job's assigned tech.
--
-- Not applied live until Jeff approves the push.
--
-- Idempotent: create or replace function. Body is 0106's with the role
-- check moved after the job select.

begin;

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
  v_is_admin boolean := public.is_org_admin();
  v_closed_by uuid := p_closed_by_user_id;
begin
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

  if not v_is_admin
     and (v_job.assigned_tech_id is null or v_job.assigned_tech_id <> auth.uid()) then
    raise exception 'close_out_job_write: only an admin or the assigned tech can close out this job'
      using errcode = '42501';
  end if;

  if not v_is_admin then
    v_closed_by := auth.uid();
  end if;

  if v_job.status <> p_from_status then
    raise exception 'close_out_job_write: cannot close out a % job (expected %, id=%)', v_job.status, p_from_status, p_job_id;
  end if;

  update public.jobs set status = v_to_status where id = p_job_id
  returning * into v_job;

  insert into public.calendar_events (organization_id, job_id, kind, event_time, created_by)
  values (v_job.organization_id, v_job.id, 'status_change', now(), v_closed_by);

  if v_is_admin
     and p_price_sheet_id is not null
     and p_compensation_policy_id is not null
     and p_commission_amount_cents is not null then
    insert into public.commissions (organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
    values (v_job.organization_id, v_job.id, v_closed_by, p_price_sheet_id, p_compensation_policy_id, p_commission_amount_cents)
    on conflict (job_id) where voided_at is null do nothing;
  end if;

  update public.close_out_failures
  set status = 'resolved_retry',
      resolved_by = v_closed_by,
      resolved_at = now(),
      updated_at = now()
  where job_id = p_job_id
    and status in ('open', 'retrying');

  return v_job;
end;
$$;

revoke all on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) from public;
grant execute on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) to authenticated;

commit;
