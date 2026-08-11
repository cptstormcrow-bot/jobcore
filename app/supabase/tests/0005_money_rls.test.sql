-- Jobcore - RLS assertions for 0005_money.sql (P3 - P3m.1..P3m.4)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0005 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.

begin;

-- ---------------------------------------------------------------------------
-- P3m.1a / P3m.1b - fixture plant under `reset role` FIRST (the falsifiability
-- gate), then owner-sees-N on all 7 money tables.
-- ---------------------------------------------------------------------------
do $$
declare
  n_price_sheets integer;
  n_price_sheet_rates integer;
  n_compensation_policies integer;
  n_commissions integer;
  n_reimbursements integer;
  n_payout_batches integer;
  n_payout_lines integer;
  v_price_sheet_id uuid := '00000000-0000-4000-8000-000000000701';
  v_policy_id uuid := '00000000-0000-4000-8000-000000000702';
  v_batch_id uuid := '00000000-0000-4000-8000-000000000703';
begin
  -- Setup runs as the definer/superuser context of this DO block, outside the
  -- authenticated session established below - this is the falsifiability gate.
  reset role;

  insert into public.price_sheets (id, organization_id, version, status)
  values (v_price_sheet_id, '00000000-0000-4000-8000-000000000001', 1, 'draft')
  on conflict (id) do nothing;

  insert into public.price_sheet_rates (id, price_sheet_id, service_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000711', v_price_sheet_id, '00000000-0000-4000-8000-000000000301', 5000)
  on conflict (id) do nothing;

  insert into public.compensation_policies (id, organization_id, name, hourly_rate_cents)
  values (v_policy_id, '00000000-0000-4000-8000-000000000001', 'Standard Tech', 2500)
  on conflict (id) do nothing;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000103',
          v_price_sheet_id, v_policy_id, 1000)
  on conflict (id) do nothing;

  insert into public.reimbursements (id, organization_id, user_id, job_id, amount_cents, description)
  values ('00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000601', 2000, 'Owner-planted fixture')
  on conflict (id) do nothing;

  insert into public.payout_batches (id, organization_id, period_start, period_end, status)
  values (v_batch_id, '00000000-0000-4000-8000-000000000001', '2026-07-01', '2026-07-15', 'draft')
  on conflict (id) do nothing;

  insert into public.payout_lines (id, organization_id, payout_batch_id, user_id, hours_amount, commission_amount, bonus_amount, reimbursement_amount, total_amount)
  values ('00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000001',
          v_batch_id, '00000000-0000-4000-8000-000000000103', 1000, 1000, 0, 2000, 4000)
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  select count(*) into n_price_sheets from public.price_sheets;
  select count(*) into n_price_sheet_rates from public.price_sheet_rates;
  select count(*) into n_compensation_policies from public.compensation_policies;
  select count(*) into n_commissions from public.commissions;
  select count(*) into n_reimbursements from public.reimbursements;
  select count(*) into n_payout_batches from public.payout_batches;
  select count(*) into n_payout_lines from public.payout_lines;

  if n_price_sheets <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % price_sheets rows, expected exactly 1', n_price_sheets;
  end if;
  if n_price_sheet_rates <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % price_sheet_rates rows, expected exactly 1', n_price_sheet_rates;
  end if;
  if n_compensation_policies <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % compensation_policies rows, expected exactly 1', n_compensation_policies;
  end if;
  if n_commissions <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % commissions rows, expected exactly 1', n_commissions;
  end if;
  if n_reimbursements <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % reimbursements rows, expected exactly 1', n_reimbursements;
  end if;
  if n_payout_batches <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % payout_batches rows, expected exactly 1', n_payout_batches;
  end if;
  if n_payout_lines <> 1 then
    raise exception 'P3m.1b FAILED: owner@ sees % payout_lines rows, expected exactly 1', n_payout_lines;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- P3m.2a - tech@ sees ZERO rows on every admin-only table: bulk count, plus a
-- point-lookup-by-PK variant (AC-10/verify-7 pattern) so a leaked row cannot
-- hide behind a coarse count.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n from public.price_sheets;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % price_sheets rows, expected 0', n;
  end if;
  select count(*) into n from public.price_sheets where id = '00000000-0000-4000-8000-000000000701';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved price_sheets row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.price_sheet_rates;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % price_sheet_rates rows, expected 0', n;
  end if;
  select count(*) into n from public.price_sheet_rates where id = '00000000-0000-4000-8000-000000000711';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved price_sheet_rates row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.compensation_policies;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % compensation_policies rows, expected 0', n;
  end if;
  select count(*) into n from public.compensation_policies where id = '00000000-0000-4000-8000-000000000702';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved compensation_policies row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.commissions;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % commissions rows, expected 0', n;
  end if;
  select count(*) into n from public.commissions where id = '00000000-0000-4000-8000-000000000721';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved commissions row by id - point lookup bypasses admin-only gating - not even the tech named on the row may see it';
  end if;

  select count(*) into n from public.payout_batches;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % payout_batches rows, expected 0', n;
  end if;
  select count(*) into n from public.payout_batches where id = '00000000-0000-4000-8000-000000000703';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved payout_batches row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.payout_lines;
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ sees % payout_lines rows, expected 0', n;
  end if;
  select count(*) into n from public.payout_lines where id = '00000000-0000-4000-8000-000000000741';
  if n <> 0 then
    raise exception 'P3m.2a FAILED: tech@ resolved payout_lines row by id - point lookup bypasses admin-only gating';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- P3m.2b - repeat the zero-row probe as sales@. Testing only tech@ under-covers
-- the AC; sales@ must be denied identically.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into n from public.price_sheets;
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ sees % price_sheets rows, expected 0', n;
  end if;
  select count(*) into n from public.price_sheets where id = '00000000-0000-4000-8000-000000000701';
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ resolved price_sheets row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.compensation_policies;
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ sees % compensation_policies rows, expected 0', n;
  end if;
  select count(*) into n from public.compensation_policies where id = '00000000-0000-4000-8000-000000000702';
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ resolved compensation_policies row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.commissions;
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ sees % commissions rows, expected 0', n;
  end if;
  select count(*) into n from public.commissions where id = '00000000-0000-4000-8000-000000000721';
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ resolved commissions row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.payout_batches;
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ sees % payout_batches rows, expected 0', n;
  end if;
  select count(*) into n from public.payout_batches where id = '00000000-0000-4000-8000-000000000703';
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ resolved payout_batches row by id - point lookup bypasses admin-only gating';
  end if;

  select count(*) into n from public.payout_lines;
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ sees % payout_lines rows, expected 0', n;
  end if;
  select count(*) into n from public.payout_lines where id = '00000000-0000-4000-8000-000000000741';
  if n <> 0 then
    raise exception 'P3m.2b FAILED: sales@ resolved payout_lines row by id - point lookup bypasses admin-only gating';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reimbursements_select_own - a non-admin sees their OWN reimbursement rows
-- (positive), planted above under tech@'s own user_id.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n
  from public.reimbursements
  where id = '00000000-0000-4000-8000-000000000731';

  if n <> 1 then
    raise exception 'reimbursements_select_own FAILED: tech@ sees % rows for their own reimbursement, expected exactly 1', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reimbursements_select_own (negative) - a DIFFERENT non-admin (sales@) does
-- NOT see the tech's reimbursement row: bulk count plus point-lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into n from public.reimbursements;
  if n <> 0 then
    raise exception 'reimbursements_select_own FAILED: sales@ sees % reimbursement rows, expected 0 (not their own)', n;
  end if;

  select count(*) into n
  from public.reimbursements
  where id = '00000000-0000-4000-8000-000000000731';
  if n <> 0 then
    raise exception 'reimbursements_select_own FAILED: sales@ resolved another user''s reimbursement by id - point lookup bypasses own-row gating';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reimbursements_insert_own - tech@ may insert a reimbursement row with their
-- own user_id (positive).
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  insert into public.reimbursements (id, organization_id, user_id, job_id, amount_cents, description)
  values ('00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000601', 500, 'Self-insert probe');

  select count(*) into n
  from public.reimbursements
  where id = '00000000-0000-4000-8000-000000000732';

  if n <> 1 then
    raise exception 'reimbursements_insert_own FAILED: tech@ self-insert did not land, expected 1 visible row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reimbursements_insert_own (negative) - tech@ may NOT insert a reimbursement
-- row attributed to another user's id.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.reimbursements (id, organization_id, user_id, job_id, amount_cents, description)
    values ('00000000-0000-4000-8000-000000000733', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000601', 500, 'Cross-attribution probe');

    raise exception 'reimbursements_insert_own FAILED: tech@ inserted a reimbursement attributed to another user - WITH CHECK did not force self-attribution';
  exception
    when insufficient_privilege then
      null; -- expected: WITH CHECK denies
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Trigger-denial probes under `reset role` (elevated context) - immutability
-- triggers apply regardless of RLS role, so they must also fire above RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  reset role;

  -- price_sheets: a published sheet cannot be arbitrarily modified.
  update public.price_sheets
  set version = 999
  where id = '00000000-0000-4000-8000-000000000701'
    and status = 'draft';
  -- draft rows ARE mutable; this update is expected to succeed and is reverted below.
  update public.price_sheets set version = 1 where id = '00000000-0000-4000-8000-000000000701';

  -- commissions: delete is never permitted, even under reset role / elevated context.
  begin
    delete from public.commissions where id = '00000000-0000-4000-8000-000000000721';
    raise exception 'trigger-denial FAILED: commissions row was deleted under reset role - commissions_immutable_trg did not fire';
  exception
    when raise_exception then
      null; -- expected: the trigger's own raise exception fired
  end;

  get diagnostics affected = row_count;
end $$;

-- ---------------------------------------------------------------------------
-- Trigger-denial probe as authenticated owner - is_org_admin() grants RLS
-- passage, but the immutability trigger still blocks the DELETE.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  begin
    delete from public.commissions where id = '00000000-0000-4000-8000-000000000721';
    raise exception 'trigger-denial FAILED: owner@ deleted a commissions row - commissions_immutable_trg did not fire for an RLS-admitted caller';
  exception
    when raise_exception then
      null; -- expected: the trigger's own raise exception fired
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Survival probes - cast amount to ::text (text, not numeric: 100.00 = 100.0
-- is TRUE and would hide scale drift) to confirm the planted fixtures still
-- carry the exact cent values inserted above, unperturbed by the probes.
-- ---------------------------------------------------------------------------
do $$
declare
  v_commission_amount text;
  v_reimbursement_amount text;
  v_payout_total text;
begin
  reset role;

  select amount_cents::text into v_commission_amount
  from public.commissions where id = '00000000-0000-4000-8000-000000000721';

  if v_commission_amount is distinct from '1000' then
    raise exception 'survival probe FAILED: commissions.amount_cents drifted to %, expected 1000', v_commission_amount;
  end if;

  select amount_cents::text into v_reimbursement_amount
  from public.reimbursements where id = '00000000-0000-4000-8000-000000000731';

  if v_reimbursement_amount is distinct from '2000' then
    raise exception 'survival probe FAILED: reimbursements.amount_cents drifted to %, expected 2000', v_reimbursement_amount;
  end if;

  select total_amount::text into v_payout_total
  from public.payout_lines where id = '00000000-0000-4000-8000-000000000741';

  if v_payout_total is distinct from '4000' then
    raise exception 'survival probe FAILED: payout_lines.total_amount drifted to %, expected 4000', v_payout_total;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- P3m.4a - audit_log policy-count canary: exactly 2 policies, zero
-- UPDATE/DELETE. audit_log is not a 0005 table, but its append-only shape is
-- the contract every money table's immutability trigger relies on staying
-- true, so it is guarded here alongside the rest of the money-suite canaries.
-- ---------------------------------------------------------------------------
do $$
declare
  n_policies integer;
  n_write_policies integer;
begin
  reset role;

  select count(*) into n_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'audit_log';

  if n_policies <> 2 then
    raise exception 'P3m.4a FAILED: audit_log has % policies, expected exactly 2', n_policies;
  end if;

  select count(*) into n_write_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'audit_log'
    and cmd in ('UPDATE', 'DELETE');

  if n_write_policies <> 0 then
    raise exception 'P3m.4a FAILED: audit_log has % UPDATE/DELETE policies, expected 0 - append-only contract violated', n_write_policies;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe fixtures back out.
rollback;
