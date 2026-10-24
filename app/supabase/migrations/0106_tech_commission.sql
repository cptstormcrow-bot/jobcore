-- Jobcore - migration 0106: per-employee commission switch
--
-- What: each employee profile gets a commission switch (commission_enabled)
-- and a commission percent. Commission pay lines ride on top of normal pay:
-- job_payout_lines accepts basis 'commission', and a job may now carry one
-- live line per (job, user, basis) instead of one per (job, user).
-- Close-Out no longer requires a price-sheet commission: close_out_job_write
-- inserts into public.commissions only when the price sheet id, the
-- compensation policy id and the commission amount are all supplied.
--
-- Not applied live until Jeff approves the push.
--
-- Idempotent: add column if not exists, drop constraint if exists then add,
-- drop index if exists then create index if not exists, create or replace
-- function. Re-running changes nothing.

begin;

-- 1. profiles columns --------------------------------------------------------
alter table public.profiles
  add column if not exists commission_enabled boolean not null default false,
  add column if not exists commission_percent numeric(5,2);

alter table public.profiles drop constraint if exists profiles_commission_percent_chk;
alter table public.profiles
  add constraint profiles_commission_percent_chk
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100));

alter table public.profiles drop constraint if exists profiles_commission_enabled_chk;
alter table public.profiles
  add constraint profiles_commission_enabled_chk
  check (not commission_enabled or coalesce(commission_percent, 0) > 0);

-- 2. job_payout_lines: commission basis + per-basis uniqueness ---------------
alter table public.job_payout_lines drop constraint if exists job_payout_lines_basis_check;
alter table public.job_payout_lines
  add constraint job_payout_lines_basis_check
  check (basis in ('dev_flat', 'prem_bonus', 'commission'));

drop index if exists public.job_payout_lines_job_user_live_uidx;
create unique index if not exists job_payout_lines_job_user_basis_live_uidx
  on public.job_payout_lines (job_id, user_id, basis) where status <> 'void';

-- 3. post_job_payout_lines: accept commission, conflict target includes basis
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
    if v_basis is null or v_basis not in ('dev_flat', 'prem_bonus', 'commission') then
      raise exception 'post_job_payout_lines: basis must be dev_flat, prem_bonus or commission (user %)', v_user;
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

-- 4. close_out_job_write: commission insert only when all three args supplied
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

  if p_price_sheet_id is not null
     and p_compensation_policy_id is not null
     and p_commission_amount_cents is not null then
    insert into public.commissions (organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
    values (v_job.organization_id, v_job.id, p_closed_by_user_id, p_price_sheet_id, p_compensation_policy_id, p_commission_amount_cents)
    on conflict (job_id) where voided_at is null do nothing;
  end if;

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

-- 5. grants (same as 0105)
revoke all on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) from public;
grant execute on function public.close_out_job_write(uuid, public.job_status, uuid, uuid, integer, uuid) to authenticated;

commit;

-- verification (one row): all four true once 0106 is live
select
  (select count(*) = 2 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('commission_enabled', 'commission_percent')) as profiles_commission_columns,
  (select pg_get_constraintdef(c.oid) like '%commission%' from pg_constraint c
    where c.conrelid = 'public.job_payout_lines'::regclass
      and c.conname = 'job_payout_lines_basis_check') as basis_check_has_commission,
  exists (select 1 from pg_indexes where schemaname = 'public'
    and indexname = 'job_payout_lines_job_user_basis_live_uidx') as new_unique_index_present,
  not exists (select 1 from pg_indexes where schemaname = 'public'
    and indexname = 'job_payout_lines_job_user_live_uidx') as old_unique_index_gone;
