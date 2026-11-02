-- Jobcore - migration 0117: close-out posts hourly and travel pay, and a closed job can be reopened (#0018)
--
-- What: job_payout_lines accepts basis 'hourly' (job hours x the employee's
-- hourly rate) and 'travel' (travel hours x the hourly rate, paid-travel
-- employees only), so a close-out posts that pay to payroll alongside prem
-- bonus and commission. reopen_closed_job moves a closed job back to paid,
-- voids its still-pending pay lines (lines already in a payroll run stay),
-- and logs the change on the calendar.
--
-- Not applied live until Jeff approves the push.
--
-- Idempotent: drop constraint if exists then add, create or replace function.

begin;

-- 1. job_payout_lines: hourly + travel basis ---------------------------------
alter table public.job_payout_lines drop constraint if exists job_payout_lines_basis_check;
alter table public.job_payout_lines
  add constraint job_payout_lines_basis_check
  check (basis in ('dev_flat', 'prem_bonus', 'commission', 'hourly', 'travel'));

-- 2. post_job_payout_lines: accept hourly and travel -------------------------
create or replace function public.post_job_payout_lines(
  p_job_id uuid,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job     public.jobs;
  v_line    jsonb;
  v_user    uuid;
  v_amount  integer;
  v_basis   text;
  v_count   integer := 0;
  v_rows    integer;
begin
  if not public.is_org_admin() then
    raise exception 'post_job_payout_lines: admin role required';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if not found then
    raise exception 'post_job_payout_lines: job not found (id=%)', p_job_id;
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'post_job_payout_lines: job % does not belong to current organization', p_job_id;
  end if;

  if v_job.status not in ('closed', 'paid') then
    raise exception 'post_job_payout_lines: job % is % (must be closed or paid)', p_job_id, v_job.status;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'post_job_payout_lines: p_lines must be a json array';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_user   := nullif(v_line->>'user_id', '')::uuid;
    v_amount := (v_line->>'amount_cents')::integer;
    v_basis  := v_line->>'basis';

    if v_user is null then
      raise exception 'post_job_payout_lines: line is missing user_id';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'post_job_payout_lines: amount_cents must be a positive integer (user %)', v_user;
    end if;
    if v_basis is null or v_basis not in ('dev_flat', 'prem_bonus', 'commission', 'hourly', 'travel') then
      raise exception 'post_job_payout_lines: basis must be dev_flat, prem_bonus, commission, hourly or travel (user %)', v_user;
    end if;
    if not exists (
      select 1 from public.profiles p
       where p.id = v_user and p.organization_id = v_job.organization_id
    ) then
      raise exception 'post_job_payout_lines: user % is not in the current organization', v_user;
    end if;

    insert into public.job_payout_lines (
      organization_id, job_id, user_id, amount_cents, basis, status, created_by
    )
    values (
      v_job.organization_id, v_job.id, v_user, v_amount, v_basis, 'pending', auth.uid()
    )
    on conflict (job_id, user_id, basis) where status <> 'void' do nothing;

    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.post_job_payout_lines(uuid, jsonb) from public, anon;
grant execute on function public.post_job_payout_lines(uuid, jsonb) to authenticated;

-- 3. reopen_closed_job: closed -> paid, pending pay lines voided -------------
create or replace function public.reopen_closed_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  if not public.is_org_admin() then
    raise exception 'reopen_closed_job: admin role required' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'reopen_closed_job: job not found (id=%)', p_job_id using errcode = 'P0002';
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'reopen_closed_job: job % does not belong to current organization', p_job_id using errcode = '42501';
  end if;

  if v_job.status <> 'closed' then
    raise exception 'job is not closed out' using errcode = '22023';
  end if;

  update public.jobs set status = 'paid' where id = p_job_id;

  update public.job_payout_lines
     set status = 'void'
   where job_id = p_job_id
     and status = 'pending';

  insert into public.calendar_events (organization_id, job_id, kind, event_time, created_by)
  values (v_job.organization_id, v_job.id, 'status_change', now(), auth.uid());
end;
$$;

revoke all on function public.reopen_closed_job(uuid) from public, anon;
grant execute on function public.reopen_closed_job(uuid) to authenticated;

commit;
