-- Jobcore - migration 0104: job_payout_lines (employee Close-Out pay -> payroll)
--
-- NOT APPLIED LIVE - applying needs Jeff's explicit go. Static-review
-- migration, written without touching any database.
--
-- Purpose: FC1 of the pay-policy build. Close-Out computes per-tech pay, but
-- employee lines were display-only. This adds job_payout_lines (one row per
-- tech per job, Dev FLAT or Prem BONUS only; Dev hourly is paid from approved
-- timesheets and is never posted), an RPC to post them, and a create_payout_batch
-- that folds pending lines into payout_lines.bonus_amount and marks them
-- 'included'.
--
-- create_payout_batch: signature, security model (definer, search_path =
-- public), admin gate, org/period/array validation, per-user org check,
-- reimbursement validation and paid-flip, employee_name and
-- source_hash = md5(line text) are all kept from 0084. New: bonus_amount is
-- the sum of that user's pending job_payout_lines with created_at::date <=
-- p_period_end (was hardcoded 0); total_amount = hours + commission(0) +
-- bonus + reimbursement; consumed lines are stamped included + payout_batch_id
-- in the same function. A user with pending lines but no p_lines entry gets a
-- payout line with zero hours/reimbursement, employee_name = profiles.full_name.
-- Note: source_hash for a synthesized line is md5 of the synthesized jsonb text.

begin;

-- A) table
create table if not exists public.job_payout_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete restrict,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  amount_cents     integer not null check (amount_cents > 0),
  basis            text not null check (basis in ('dev_flat', 'prem_bonus')),
  status           text not null default 'pending' check (status in ('pending', 'included', 'void')),
  payout_batch_id  uuid references public.payout_batches (id) on delete restrict,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists job_payout_lines_job_user_live_uidx
  on public.job_payout_lines (job_id, user_id) where status <> 'void';
create index if not exists job_payout_lines_org_status_created_idx
  on public.job_payout_lines (organization_id, status, created_at);
create index if not exists job_payout_lines_user_id_idx
  on public.job_payout_lines (user_id);

-- B) immutability + updated_at (pattern of commissions_immutable, 0005)
create or replace function public.job_payout_lines_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payout_lines: cannot delete a line (id=%); void it instead', old.id;
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.job_id is distinct from old.job_id
     or new.user_id is distinct from old.user_id
     or new.amount_cents is distinct from old.amount_cents
     or new.basis is distinct from old.basis
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'job_payout_lines: amount, basis, job, user and organization are immutable (id=%)', old.id;
  end if;

  if new.status = old.status then
    if new.payout_batch_id is distinct from old.payout_batch_id then
      raise exception 'job_payout_lines: payout_batch_id can only be set with the pending -> included transition (id=%)', old.id;
    end if;
  elsif old.status = 'pending' and new.status = 'included' then
    if new.payout_batch_id is null then
      raise exception 'job_payout_lines: pending -> included requires payout_batch_id (id=%)', old.id;
    end if;
  elsif old.status = 'pending' and new.status = 'void' then
    if new.payout_batch_id is distinct from old.payout_batch_id then
      raise exception 'job_payout_lines: pending -> void must not change payout_batch_id (id=%)', old.id;
    end if;
  else
    raise exception 'job_payout_lines: status may only go pending -> included or pending -> void (id=%, % -> %)',
      old.id, old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_payout_lines_immutable_trg on public.job_payout_lines;
create trigger job_payout_lines_immutable_trg
  before update or delete on public.job_payout_lines
  for each row execute function public.job_payout_lines_immutable();

revoke all on function public.job_payout_lines_immutable() from public, anon;

-- C) RLS
alter table public.job_payout_lines enable row level security;

drop policy if exists job_payout_lines_admin_all on public.job_payout_lines;
create policy job_payout_lines_admin_all
  on public.job_payout_lines for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists job_payout_lines_select_own on public.job_payout_lines;
create policy job_payout_lines_select_own
  on public.job_payout_lines for select
  to authenticated
  using (user_id = auth.uid() and organization_id = public.current_org_id());

revoke all on table public.job_payout_lines from anon, public;

-- D) post_job_payout_lines
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
    if v_basis is null or v_basis not in ('dev_flat', 'prem_bonus') then
      raise exception 'post_job_payout_lines: basis must be dev_flat or prem_bonus (user %)', v_user;
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
    on conflict (job_id, user_id) where status <> 'void' do nothing;

    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.post_job_payout_lines(uuid, jsonb) from public, anon;
grant execute on function public.post_job_payout_lines(uuid, jsonb) to authenticated;

-- E) create_payout_batch: fold pending job_payout_lines into bonus_amount
drop function if exists public.create_payout_batch(date, date, jsonb);

create or replace function public.create_payout_batch(
  p_period_start date,
  p_period_end date,
  p_lines jsonb
)
returns public.payout_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_batch   public.payout_batches;
  v_line    jsonb;
  v_user    uuid;
  v_hours   integer;
  v_reimb   integer;
  v_bonus   integer;
  v_ids     uuid[];
  v_found   integer;
  v_sum     bigint;
  v_done    uuid[] := '{}';
begin
  if not public.is_org_admin() then
    raise exception 'create_payout_batch: admin role required';
  end if;

  v_org := public.current_org_id();
  if v_org is null then
    raise exception 'create_payout_batch: no current organization';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'create_payout_batch: p_period_end must be on or after p_period_start';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'create_payout_batch: p_lines must be a json array';
  end if;

  insert into public.payout_batches (organization_id, period_start, period_end, status)
  values (v_org, p_period_start, p_period_end, 'draft')
  returning * into v_batch;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_user  := nullif(v_line->>'user_id', '')::uuid;
    v_hours := coalesce((v_line->>'hours_amount')::integer, 0);
    v_reimb := coalesce((v_line->>'reimbursement_amount')::integer, 0);

    if v_user is null then
      raise exception 'create_payout_batch: line is missing user_id';
    end if;

    if not exists (
      select 1 from public.profiles p
       where p.id = v_user and p.organization_id = v_org
    ) then
      raise exception 'create_payout_batch: user % is not in the current organization', v_user;
    end if;

    -- reimbursements paid in the same transaction
    v_ids := null;
    if jsonb_typeof(v_line->'reimbursement_ids') = 'array'
       and jsonb_array_length(v_line->'reimbursement_ids') > 0 then
      select array_agg(distinct x::uuid)
        into v_ids
        from jsonb_array_elements_text(v_line->'reimbursement_ids') as t(x);

      select count(*), coalesce(sum(r.amount_cents), 0)
        into v_found, v_sum
        from public.reimbursements r
       where r.id = any (v_ids)
         and r.user_id = v_user
         and r.organization_id = v_org
         and r.status = 'approved';

      if v_found <> cardinality(v_ids) then
        raise exception 'create_payout_batch: reimbursement ids must all be approved and belong to user % in this organization', v_user;
      end if;

      if v_sum <> v_reimb then
        raise exception 'create_payout_batch: reimbursement_amount % does not equal the approved total % for user %', v_reimb, v_sum, v_user;
      end if;

      -- No updated_at trigger exists on this table, so stamp it here.
      update public.reimbursements
         set status = 'paid',
             updated_at = now()
       where id = any (v_ids)
         and user_id = v_user
         and organization_id = v_org
         and status = 'approved';
    end if;

    -- pending per-job pay for this user, up to the period end. A repeated
    -- user in p_lines gets 0 here because the first pass already flipped them.
    select coalesce(sum(j.amount_cents), 0)::integer
      into v_bonus
      from public.job_payout_lines j
     where j.organization_id = v_org
       and j.user_id = v_user
       and j.status = 'pending'
       and j.created_at::date <= p_period_end;

    insert into public.payout_lines (
      payout_batch_id, organization_id, user_id, employee_name,
      regular_minutes, ot_minutes, dt_minutes, rate_segments,
      hours_amount, commission_amount, bonus_amount, reimbursement_amount,
      total_amount, source_hash
    )
    values (
      v_batch.id, v_org, v_user, v_line->>'employee_name',
      coalesce((v_line->>'regular_minutes')::integer, 0),
      coalesce((v_line->>'ot_minutes')::integer, 0),
      coalesce((v_line->>'dt_minutes')::integer, 0),
      case when jsonb_typeof(v_line->'rate_segments') = 'array'
           then v_line->'rate_segments' else '[]'::jsonb end,
      v_hours, 0, v_bonus, v_reimb,
      v_hours + v_bonus + v_reimb,
      md5(v_line::text)
    );

    update public.job_payout_lines
       set status = 'included',
           payout_batch_id = v_batch.id
     where organization_id = v_org
       and user_id = v_user
       and status = 'pending'
       and created_at::date <= p_period_end;

    v_done := v_done || v_user;
  end loop;

  -- users with pending per-job pay but no p_lines entry
  for v_user in
    select distinct j.user_id
      from public.job_payout_lines j
     where j.organization_id = v_org
       and j.status = 'pending'
       and j.created_at::date <= p_period_end
       and not (j.user_id = any (v_done))
  loop
    select coalesce(sum(j.amount_cents), 0)::integer
      into v_bonus
      from public.job_payout_lines j
     where j.organization_id = v_org
       and j.user_id = v_user
       and j.status = 'pending'
       and j.created_at::date <= p_period_end;

    v_line := jsonb_build_object(
      'user_id', v_user,
      'employee_name', (select p.full_name from public.profiles p where p.id = v_user),
      'hours_amount', 0,
      'reimbursement_amount', 0
    );

    insert into public.payout_lines (
      payout_batch_id, organization_id, user_id, employee_name,
      regular_minutes, ot_minutes, dt_minutes, rate_segments,
      hours_amount, commission_amount, bonus_amount, reimbursement_amount,
      total_amount, source_hash
    )
    values (
      v_batch.id, v_org, v_user, v_line->>'employee_name',
      0, 0, 0, '[]'::jsonb,
      0, 0, v_bonus, 0,
      v_bonus,
      md5(v_line::text)
    );

    update public.job_payout_lines
       set status = 'included',
           payout_batch_id = v_batch.id
     where organization_id = v_org
       and user_id = v_user
       and status = 'pending'
       and created_at::date <= p_period_end;
  end loop;

  return v_batch;
end;
$$;

-- grants (same ACL as 0084:201-202; the function was dropped above so it must be re-granted)
revoke all on function public.create_payout_batch(date, date, jsonb) from public, anon;
grant execute on function public.create_payout_batch(date, date, jsonb) to authenticated;

commit;
