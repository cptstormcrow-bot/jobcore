-- Jobcore - migration 0084: payout payroll fields + create_payout_batch repair
--
-- STATIC-REVIEW MIGRATION. Written without touching any database. A live
-- push needs Jeff's explicit go.
--
-- Why additive: payout_batches / payout_lines already exist (0005) and hold
-- live rows. This migration only adds columns (all with defaults or nullable),
-- keeps the 0005 CHECK total_amount = hours + commission + bonus +
-- reimbursement, keeps the admin-all policies, and creates no tables.
--
-- Payroll mapping: hours_amount = gross wages (cents), reimbursement_amount =
-- approved reimbursements (cents), commission_amount and bonus_amount stay 0.
--
-- create_payout_batch repair: 0021 inserted into columns that do not exist
-- (batch_id, amount_cents, payload) and ran with an empty search_path against
-- unqualified names. It is dropped (exact old signature) and rebuilt against
-- the real 0005 columns. Argument list and return type (payout_batches row)
-- are unchanged.
--
-- p_lines element contract (jsonb array of objects):
--   user_id               uuid, required, must be a profile in the caller's org
--   employee_name         text, optional
--   regular_minutes       integer >= 0, default 0
--   ot_minutes            integer >= 0, default 0
--   dt_minutes            integer >= 0, default 0
--   rate_segments         json array, default []
--   hours_amount          integer cents >= 0, default 0
--   reimbursement_amount  integer cents >= 0, default 0
--   reimbursement_ids     uuid array, optional. Each id must belong to that
--                         user and org, be 'approved', and the amount_cents
--                         must sum to reimbursement_amount. They are set to
--                         'paid' in the same transaction (same effect as
--                         mark_reimbursement_paid in 0082).

begin;

-- A) additive columns
alter table public.payout_lines add column if not exists employee_name text;
alter table public.payout_lines add column if not exists regular_minutes integer not null default 0;
alter table public.payout_lines add column if not exists ot_minutes integer not null default 0;
alter table public.payout_lines add column if not exists dt_minutes integer not null default 0;
alter table public.payout_lines add column if not exists rate_segments jsonb not null default '[]'::jsonb;
alter table public.payout_lines add column if not exists source_hash text;

alter table public.payout_lines drop constraint if exists payout_lines_regular_minutes_check;
alter table public.payout_lines add constraint payout_lines_regular_minutes_check check (regular_minutes >= 0);
alter table public.payout_lines drop constraint if exists payout_lines_ot_minutes_check;
alter table public.payout_lines add constraint payout_lines_ot_minutes_check check (ot_minutes >= 0);
alter table public.payout_lines drop constraint if exists payout_lines_dt_minutes_check;
alter table public.payout_lines add constraint payout_lines_dt_minutes_check check (dt_minutes >= 0);

-- B) repaired RPC
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
  v_ids     uuid[];
  v_found   integer;
  v_sum     bigint;
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
      v_hours, 0, 0, v_reimb,
      v_hours + v_reimb,
      md5(v_line::text)
    );
  end loop;

  return v_batch;
end;
$$;

-- C) RLS (idempotent) - keep the admin-all policies from 0005
alter table public.payout_batches enable row level security;
alter table public.payout_lines enable row level security;

-- payout_lines policy reads only its own row's columns, so it cannot recurse.
drop policy if exists payout_lines_select_own on public.payout_lines;
create policy payout_lines_select_own
  on public.payout_lines for select
  to authenticated
  using (user_id = auth.uid() and organization_id = public.current_org_id());

-- This one reads payout_lines; payout_lines policies never read
-- payout_batches, so there is no recursion.
drop policy if exists payout_batches_select_member on public.payout_batches;
create policy payout_batches_select_member
  on public.payout_batches for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.payout_lines pl
       where pl.payout_batch_id = payout_batches.id
         and pl.user_id = auth.uid()
    )
  );

-- D) grants (live DB showed anon with full table privileges)
revoke all on table public.payout_batches from anon, public;
revoke all on table public.payout_lines from anon, public;

revoke all on function public.create_payout_batch(date, date, jsonb) from public, anon;
grant execute on function public.create_payout_batch(date, date, jsonb) to authenticated;

-- NOTE: 0005's payout_lines_immutable_trg fires only on UPDATE/DELETE, so the
-- batch-create INSERT path and the new column defaults are not affected. The
-- reimbursements UPDATE touches a different table.

commit;
