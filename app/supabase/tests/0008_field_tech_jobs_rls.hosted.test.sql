-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0008_field_tech_jobs_rls.sql (P4 - jobs_update_tech,
-- commissions_select_own)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0008 and seed.hosted.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- Cross-suite note: `commissions` also carries policies from 0005 (admin_all).
-- This file covers ONLY 0008's `commissions_select_own` policy; it does not
-- duplicate 0005's admin-coverage assertions.

begin;

-- ---------------------------------------------------------------------------
-- SETUP - fixture rows for the commissions_select_own probes below, planted
-- under `reset role` (the falsifiability gate) before any impersonation.
-- One commission belongs to tech@ (job ...601, already assigned to tech@ per
-- seed.sql); one belongs to owner@ on an unassigned job (...605) so it has no
-- relationship to tech@ at all - a clean "other row" fixture.
-- ---------------------------------------------------------------------------
do $$
declare
  fixture_count integer;
begin
  reset role;

  insert into public.price_sheets (id, organization_id, version, status)
  values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 9901, 'draft')
  on conflict (id) do nothing;

  insert into public.compensation_policies (id, organization_id, name, commission_basis_percent)
  values ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'AC-8 fixture policy', 10)
  on conflict (id) do nothing;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    5000
  )
  on conflict (job_id) where voided_at is null do nothing;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000605',
    '09595a9b-12f3-46a7-845c-aae615f776c3',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000202',
    7500
  )
  on conflict (job_id) where voided_at is null do nothing;

  select count(*) into fixture_count
  from public.commissions
  where id in ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204');

  if fixture_count <> 2 then
    raise exception 'AC-8 SETUP FAILED: expected 2 fixture commission rows, found %', fixture_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.1 - jobs_update_tech positive: tech@ updates the `status` column
-- (whitelisted by jobs_tech_update_whitelist_trg) on a job they are assigned
-- to (...601). Both the RLS policy and the trigger must permit this.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  new_status public.job_status;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  update public.jobs
  set status = 'en_route'
  where id = '00000000-0000-4000-8000-000000000601';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-8.1 FAILED: tech@ status update on own assigned job affected % rows, expected 1', affected;
  end if;

  select status into new_status from public.jobs where id = '00000000-0000-4000-8000-000000000601';

  if new_status is distinct from 'en_route' then
    raise exception 'AC-8.1 FAILED: job ...601 status is % after the update, expected en_route', new_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.2 - jobs_update_tech negative: tech@ attempts to change a
-- non-whitelisted column (`description`) on the same assigned job. The RLS
-- policy permits the row (tech@ is assigned to ...601), but
-- jobs_tech_update_whitelist_trg must reject the column and raise.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    update public.jobs
    set description = 'tech-tampered description'
    where id = '00000000-0000-4000-8000-000000000601';
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-8.2 FAILED: tech@ updated a non-whitelisted column on job ...601 without the trigger raising';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.2b - the description column survived AC-8.2 unmodified, confirming
-- the trigger rolled the attempted change back rather than partially applying.
-- ---------------------------------------------------------------------------
do $$
declare
  tampered integer;
begin
  reset role;

  select count(*) into tampered
  from public.jobs
  where id = '00000000-0000-4000-8000-000000000601'
    and description = 'tech-tampered description';

  if tampered <> 0 then
    raise exception 'AC-8.2b FAILED: job ...601 description was mutated despite the whitelist trigger';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.3 - jobs_update_tech negative: tech@ attempts to update the
-- whitelisted `status` column on job ...603, which is in their own
-- organization but NOT assigned to them. The RLS USING clause must deny the
-- row entirely - 0 rows affected, no exception.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  update public.jobs
  set status = 'en_route'
  where id = '00000000-0000-4000-8000-000000000603';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-8.3 FAILED: tech@ status update on unassigned job ...603 affected % rows, expected 0', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.4 - commissions_select_own positive: tech@ sees their own commission
-- row (...203).
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.commissions
  where id = '00000000-0000-4000-8000-000000000203';

  if own_count <> 1 then
    raise exception 'AC-8.4 FAILED: tech@ sees % rows for their own commission ...203, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.5 - commissions_select_own negative: tech@ cannot see owner@'s
-- commission row (...204), neither in a bulk count nor by a direct PK lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.commissions
  where user_id = '09595a9b-12f3-46a7-845c-aae615f776c3';

  if leaked_count <> 0 then
    raise exception 'AC-8.5 FAILED: tech@ sees % of owner@''s commission rows via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.commissions
  where id = '00000000-0000-4000-8000-000000000204';

  if leaked_lookup <> 0 then
    raise exception 'AC-8.5 FAILED: tech@ resolved owner@''s commission ...204 by id - point lookups bypass commissions_select_own';
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe fixtures back out.
rollback;
