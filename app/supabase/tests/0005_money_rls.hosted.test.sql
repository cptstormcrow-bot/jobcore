-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0005_money.sql (P3 - P3m group)
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
--
-- SCOPE NOTE (Rule 33 cross-suite coordination): `commissions` gets policies
-- from both 0005 (commissions_admin_all) and 0008 (commissions_select_own,
-- added later). This file exercises ONLY commissions_admin_all - the
-- admin/owner full-access path and the tech/sales zero-visibility path under
-- that single policy. The tech-owns-their-own-commission positive probe is
-- 0008's scope and is deliberately NOT duplicated here.

begin;

-- ---------------------------------------------------------------------------
-- AC-M1 - fixture plant, reset role FIRST (falsifiability gate). Plants one
-- row per table in org A (the seed org) plus a synthetic org B row per table
-- for the cross-org isolation probes below. Uses the existing seed job
-- ...000601 (org A, from 0004's fixture) and seed service ...000301.
-- ---------------------------------------------------------------------------
do $$
declare
  fixture_count integer;
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe', 'org-b-isolation-probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  -- Org A fixtures.
  insert into public.price_sheets (id, organization_id, version, status)
  values ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', 1, 'published')
  on conflict (id) do nothing;

  insert into public.price_sheet_rates (id, price_sheet_id, service_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000701',
          '00000000-0000-4000-8000-000000000301', 10000)
  on conflict (id) do nothing;

  insert into public.compensation_policies (id, organization_id, name, commission_basis_percent)
  values ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000001',
          'Standard commission', 10)
  on conflict (id) do nothing;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000901', 5000)
  on conflict (id) do nothing;

  -- Two reimbursements: one owned by tech@, one owned by admin@ - distinguishes
  -- reimbursements_select_own/insert_own from reimbursements_admin_all.
  insert into public.reimbursements (id, organization_id, user_id, amount_cents, description)
  values ('00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000001',
          'd59e3bc7-691d-4ada-8959-e86f40c1e344', 2500, 'tech-owned reimbursement')
  on conflict (id) do nothing;

  insert into public.reimbursements (id, organization_id, user_id, amount_cents, description)
  values ('00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000001',
          'a143fac2-4806-42ed-9283-b45275b6c53a', 3500, 'admin-owned reimbursement')
  on conflict (id) do nothing;

  -- Two payout batches: pb1 stays 'draft' (mutable lines), pb2 is 'approved'
  -- (immutable lines) so the trigger-denial probe has a non-draft parent.
  insert into public.payout_batches (id, organization_id, period_start, period_end, status)
  values ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000001',
          '2026-01-01', '2026-01-15', 'draft')
  on conflict (id) do nothing;

  insert into public.payout_batches (id, organization_id, period_start, period_end, status)
  values ('00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-000000000001',
          '2026-01-16', '2026-01-31', 'approved')
  on conflict (id) do nothing;

  insert into public.payout_lines (id, organization_id, payout_batch_id, user_id, hours_amount, total_amount)
  values ('00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c01', 'd59e3bc7-691d-4ada-8959-e86f40c1e344', 1000, 1000)
  on conflict (id) do nothing;

  insert into public.payout_lines (id, organization_id, payout_batch_id, user_id, hours_amount, total_amount)
  values ('00000000-0000-4000-8000-000000000d02', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c02', 'd59e3bc7-691d-4ada-8959-e86f40c1e344', 2000, 2000)
  on conflict (id) do nothing;

  -- Org B fixtures - one row per table, all owned by the org-A tech (the FK
  -- only requires an existing profile row; org membership is what RLS gates).
  insert into public.price_sheets (id, organization_id, version, status)
  values ('00000000-0000-4000-8000-0000000701b2', '00000000-0000-4000-8000-0000000000b2', 1, 'published')
  on conflict (id) do nothing;

  insert into public.compensation_policies (id, organization_id, name, commission_basis_percent)
  values ('00000000-0000-4000-8000-0000000901b2', '00000000-0000-4000-8000-0000000000b2',
          'Org B commission', 10)
  on conflict (id) do nothing;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values ('00000000-0000-4000-8000-0000000a01b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000006b2', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          '00000000-0000-4000-8000-0000000701b2', '00000000-0000-4000-8000-0000000901b2', 9999)
  on conflict (id) do nothing;

  insert into public.reimbursements (id, organization_id, user_id, amount_cents, description)
  values ('00000000-0000-4000-8000-0000000b01b2', '00000000-0000-4000-8000-0000000000b2',
          'd59e3bc7-691d-4ada-8959-e86f40c1e344', 4444, 'org B reimbursement')
  on conflict (id) do nothing;

  insert into public.payout_batches (id, organization_id, period_start, period_end, status)
  values ('00000000-0000-4000-8000-0000000c01b2', '00000000-0000-4000-8000-0000000000b2',
          '2026-01-01', '2026-01-15', 'draft')
  on conflict (id) do nothing;

  insert into public.payout_lines (id, organization_id, payout_batch_id, user_id, hours_amount, total_amount)
  values ('00000000-0000-4000-8000-0000000d01b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000c01b2', 'd59e3bc7-691d-4ada-8959-e86f40c1e344', 500, 500)
  on conflict (id) do nothing;

  select count(*) into fixture_count from public.commissions;
  if fixture_count < 2 then
    raise exception 'AC-M1 SETUP FAILED: expected at least 2 commission rows across both orgs, found %', fixture_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M2 - owner sees exactly the org-A row on each of the 7 admin-scoped
-- tables (P3m.1b). reimbursements is admin_all-scoped for an admin/owner, so
-- the owner sees BOTH org-A reimbursement rows (tech's and admin's), not one.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into n from public.price_sheets;
  if n <> 1 then raise exception 'AC-M2 FAILED: owner@ sees % price_sheets rows, expected 1', n; end if;

  select count(*) into n from public.price_sheet_rates;
  if n <> 1 then raise exception 'AC-M2 FAILED: owner@ sees % price_sheet_rates rows, expected 1', n; end if;

  select count(*) into n from public.compensation_policies;
  if n <> 1 then raise exception 'AC-M2 FAILED: owner@ sees % compensation_policies rows, expected 1', n; end if;

  select count(*) into n from public.commissions;
  if n <> 1 then raise exception 'AC-M2 FAILED: owner@ sees % commissions rows, expected 1', n; end if;

  select count(*) into n from public.reimbursements;
  if n <> 2 then raise exception 'AC-M2 FAILED: owner@ sees % reimbursements rows, expected 2 (admin_all scope)', n; end if;

  select count(*) into n from public.payout_batches;
  if n <> 2 then raise exception 'AC-M2 FAILED: owner@ sees % payout_batches rows, expected 2', n; end if;

  select count(*) into n from public.payout_lines;
  if n <> 2 then raise exception 'AC-M2 FAILED: owner@ sees % payout_lines rows, expected 2', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M3 - tech@ sees zero rows on the six admin-only tables, both by bulk
-- count and by direct primary-key lookup (P3m.2a). "Testing only tech
-- under-covers the AC" per the ledger quote - AC-M4 below repeats this for
-- sales@.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into n from public.price_sheets;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % price_sheets rows, expected 0', n; end if;
  select count(*) into n from public.price_sheets where id = '00000000-0000-4000-8000-000000000701';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved a price_sheets row by id'; end if;

  select count(*) into n from public.price_sheet_rates;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % price_sheet_rates rows, expected 0', n; end if;
  select count(*) into n from public.price_sheet_rates where id = '00000000-0000-4000-8000-000000000801';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved a price_sheet_rates row by id'; end if;

  select count(*) into n from public.compensation_policies;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % compensation_policies rows, expected 0', n; end if;
  select count(*) into n from public.compensation_policies where id = '00000000-0000-4000-8000-000000000901';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved a compensation_policies row by id'; end if;

  -- commissions_admin_all is the only 0005 policy on this table; the tech is
  -- also the earner of commission ...0a01, but commissions_select_own is
  -- 0008's policy, so a zero-row result here is expected in this suite.
  select count(*) into n from public.commissions;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % commissions rows under commissions_admin_all alone, expected 0', n; end if;
  select count(*) into n from public.commissions where id = '00000000-0000-4000-8000-000000000a01';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved their own commission by id under commissions_admin_all alone'; end if;

  select count(*) into n from public.payout_batches;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % payout_batches rows, expected 0', n; end if;
  select count(*) into n from public.payout_batches where id = '00000000-0000-4000-8000-000000000c01';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved a payout_batches row by id'; end if;

  select count(*) into n from public.payout_lines;
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ sees % payout_lines rows, expected 0', n; end if;
  select count(*) into n from public.payout_lines where id = '00000000-0000-4000-8000-000000000d01';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved a payout_lines row by id'; end if;

  -- reimbursements is the exception: tech@ sees exactly their own row, not
  -- admin@'s row, via reimbursements_select_own.
  select count(*) into n from public.reimbursements;
  if n <> 1 then raise exception 'AC-M3 FAILED: tech@ sees % reimbursements rows, expected exactly 1 (own row only)', n; end if;
  select count(*) into n from public.reimbursements where id = '00000000-0000-4000-8000-000000000b02';
  if n <> 0 then raise exception 'AC-M3 FAILED: tech@ resolved admin@''s reimbursement by id'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M4 - sales@ sees zero rows on all 7 tables, both by bulk count and by
-- direct primary-key lookup (P3m.2b). sales@ has no self-select policy on
-- reimbursements, unlike tech@.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into n from public.price_sheets;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % price_sheets rows, expected 0', n; end if;

  select count(*) into n from public.price_sheet_rates;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % price_sheet_rates rows, expected 0', n; end if;

  select count(*) into n from public.compensation_policies;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % compensation_policies rows, expected 0', n; end if;

  select count(*) into n from public.commissions;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % commissions rows, expected 0', n; end if;

  select count(*) into n from public.reimbursements;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % reimbursements rows, expected 0 - no self-select policy exists', n; end if;
  select count(*) into n from public.reimbursements where id = '00000000-0000-4000-8000-000000000b01';
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ resolved a reimbursements row by id'; end if;

  select count(*) into n from public.payout_batches;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % payout_batches rows, expected 0', n; end if;

  select count(*) into n from public.payout_lines;
  if n <> 0 then raise exception 'AC-M4 FAILED: sales@ sees % payout_lines rows, expected 0', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M5 - org isolation. owner@ (org A admin) never sees org B's rows on any
-- of the 7 tables, by bulk count within-org (already exact-1/2 above) and by
-- direct primary-key lookup of the org B row.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into n from public.price_sheets where id = '00000000-0000-4000-8000-0000000701b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s price_sheets row by id'; end if;

  select count(*) into n from public.compensation_policies where id = '00000000-0000-4000-8000-0000000901b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s compensation_policies row by id'; end if;

  select count(*) into n from public.commissions where id = '00000000-0000-4000-8000-0000000a01b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s commissions row by id'; end if;

  select count(*) into n from public.reimbursements where id = '00000000-0000-4000-8000-0000000b01b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s reimbursements row by id'; end if;

  select count(*) into n from public.payout_batches where id = '00000000-0000-4000-8000-0000000c01b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s payout_batches row by id'; end if;

  select count(*) into n from public.payout_lines where id = '00000000-0000-4000-8000-0000000d01b2';
  if n <> 0 then raise exception 'AC-M5 FAILED: owner@ resolved org B''s payout_lines row by id'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M6 - trigger-denial probes (P3m.3a). These are plain BEFORE UPDATE/DELETE
-- triggers, not RLS, so they fire for any role including reset-role/superuser
-- as well as an authenticated org admin; both are exercised here.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean;
begin
  -- Superuser/reset-role context: a published price sheet cannot be deleted.
  reset role;
  caught := false;
  begin
    delete from public.price_sheets where id = '00000000-0000-4000-8000-000000000701';
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'AC-M6 FAILED: deleting a published price_sheets row did not raise, even under reset role';
  end if;

  -- Authenticated org admin context: same denial, plus the sibling tables.
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  caught := false;
  begin
    update public.price_sheet_rates set amount_cents = 1 where id = '00000000-0000-4000-8000-000000000801';
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'AC-M6 FAILED: owner@ updated a rate on a published price sheet without a raise';
  end if;

  caught := false;
  begin
    delete from public.commissions where id = '00000000-0000-4000-8000-000000000a01';
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'AC-M6 FAILED: owner@ deleted a commissions row without a raise - void is the only correction path';
  end if;

  caught := false;
  begin
    update public.payout_lines set hours_amount = 1 where id = '00000000-0000-4000-8000-000000000d02';
  exception when others then
    caught := true;
  end;
  if not caught then
    raise exception 'AC-M6 FAILED: owner@ updated a payout_lines row on a non-draft batch without a raise';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M7 - survival probe (P3m.3b). The commission and payout_line targeted by
-- the failed writes above still hold their original amounts. Compared as
-- ::text, not numeric, so a scale drift such as 5000 -> 5000.0 does not hide
-- behind numeric equality.
-- ---------------------------------------------------------------------------
do $$
declare
  v_commission_amount text;
  v_line_total text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select amount_cents::text into v_commission_amount
  from public.commissions where id = '00000000-0000-4000-8000-000000000a01';

  if v_commission_amount is distinct from '5000' then
    raise exception 'AC-M7 FAILED: commission amount_cents is % after a rejected delete, expected 5000', v_commission_amount;
  end if;

  select total_amount::text into v_line_total
  from public.payout_lines where id = '00000000-0000-4000-8000-000000000d02';

  if v_line_total is distinct from '2000' then
    raise exception 'AC-M7 FAILED: payout_lines total_amount is % after a rejected update, expected 2000', v_line_total;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-M8 - audit_log policy-count canary (P3m.4a). Guards against a future
-- migration accidentally adding an UPDATE or DELETE policy to the append-only
-- audit_log table introduced in 0001.
-- ---------------------------------------------------------------------------
do $$
declare
  total_policies integer;
  mutating_policies integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into total_policies from pg_policies where tablename = 'audit_log';
  if total_policies <> 2 then
    raise exception 'AC-M8 FAILED: audit_log has % policies, expected exactly 2 (select + insert)', total_policies;
  end if;

  select count(*) into mutating_policies
  from pg_policies
  where tablename = 'audit_log' and cmd in ('UPDATE', 'DELETE');
  if mutating_policies <> 0 then
    raise exception 'AC-M8 FAILED: audit_log has % UPDATE/DELETE policies, expected 0 - append-only guarantee broken', mutating_policies;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
