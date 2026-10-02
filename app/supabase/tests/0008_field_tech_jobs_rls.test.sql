-- Jobcore - RLS assertions for 0008_field_tech_jobs_rls.sql (P3b)
--
-- Hand-applied. Run this file in the SQL editor AFTER migrations/0001..0008 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- CROSS-SUITE COORDINATION (crib .crib/a3a-f-suite-split.md "Cross-suite
-- coordination flags"): `commissions` is also touched by suite 0005
-- (commissions_admin_all + the admin-only insert/update/delete surface, plus
-- the audit_log policy-count canary). This file covers ONLY 0008's own
-- addition, the `commissions_select_own` tech self-select policy. It does not
-- re-probe commissions_admin_all, trigger-denial, or the audit_log canary --
-- those stay 0005's scope.

begin;

-- ---------------------------------------------------------------------------
-- AC-8.1 - jobs_update_tech positive: an assigned tech updates the
-- whitelisted `status` column on their own job and the write succeeds.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  new_status public.job_status;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.jobs
     set status = 'scheduled'
   where id = '00000000-0000-4000-8000-000000000602';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-8.1 FAILED: tech@ updating status on own assigned job ...602 affected % rows, expected 1', affected;
  end if;

  select status into new_status from public.jobs where id = '00000000-0000-4000-8000-000000000602';

  if new_status <> 'scheduled' then
    raise exception 'AC-8.1 FAILED: job ...602 status is % after tech update, expected scheduled', new_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.2 - jobs_update_tech negative: the same tech attempts to update the
-- unassigned job ...603 (same org, no job_assignments row). RLS `using`
-- silently drops the row from the update target rather than raising.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.jobs
     set status = 'scheduled'
   where id = '00000000-0000-4000-8000-000000000603';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-8.2 FAILED: tech@ updated unassigned job ...603 - jobs_update_tech is not gating on job_assignments';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.3 - column-whitelist trigger negative: the same tech, updating their
-- OWN assigned job (...601), touches a non-whitelisted column (`address`).
-- The trigger must raise, not silently allow.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    update public.jobs
       set address = '999 Not Whitelisted Ave'
     where id = '00000000-0000-4000-8000-000000000601';

    raise exception 'AC-8.3 FAILED: tech@ updated non-whitelisted column `address` on own job ...601 without the trigger raising';
  exception
    when others then
      if sqlerrm not like 'jobs: tech update may only change status%' then
        raise exception 'AC-8.3 FAILED: expected the whitelist trigger message, got: %', sqlerrm;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.4 - tenant boundary: assignment does not widen across orgs. A second
-- org and job are planted under `reset role`, then "assigned" by inserting a
-- job_assignments row for the same tech id directly on the org B job (RLS
-- bypassed for the plant). The tech must still be unable to update it.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  reset role;

  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at)
  values (
    '00000000-0000-4000-8000-0000000007b2',
    '00000000-0000-4000-8000-0000000000b2',
    '00000000-0000-4000-8000-0000000006b2',
    '00000000-0000-4000-8000-000000000103',
    now()
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.jobs
     set status = 'scheduled'
   where id = '00000000-0000-4000-8000-0000000006b2';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-8.4 FAILED: tech@ updated org B job ...6b2 despite a job_assignments row - jobs_update_tech dropped its organization_id predicate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.5 - commissions_select_own positive: fixture plant under `reset role`
-- FIRST (falsifiability gate). Two commission rows on two different jobs (the
-- commissions_one_per_job_idx unique index forbids two active rows on the
-- same job): one earned by tech@, one earned by admin@. tech@ selects and
-- sees exactly their own row.
-- ---------------------------------------------------------------------------
do $$
declare
  ps_id uuid;
  cp_id uuid;
  visible_count integer;
  visible_id uuid;
begin
  reset role;

  insert into public.price_sheets (id, organization_id, version, status)
  values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', 9001, 'draft')
  on conflict (id) do nothing
  returning id into ps_id;

  if ps_id is null then
    select id into ps_id from public.price_sheets where id = '00000000-0000-4000-8000-000000000801';
  end if;

  insert into public.compensation_policies (id, organization_id, name, hourly_rate_cents)
  values ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000001', 'AC-8.5 fixture policy', 2500)
  on conflict (id) do nothing
  returning id into cp_id;

  if cp_id is null then
    select id into cp_id from public.compensation_policies where id = '00000000-0000-4000-8000-000000000802';
  end if;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values
    ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000103', ps_id, cp_id, 5000),
    ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000102', ps_id, cp_id, 6000)
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*), max(id) into visible_count, visible_id
  from public.commissions
  where id in ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000804');

  if visible_count <> 1 or visible_id <> '00000000-0000-4000-8000-000000000803' then
    raise exception 'AC-8.5 FAILED: tech@ sees % of the two fixture commission rows (id %), expected exactly their own row ...803', visible_count, visible_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.6 - commissions_select_own negative: tech@ cannot resolve admin@'s
-- commission row ...804 by a direct primary-key lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.commissions
  where id = '00000000-0000-4000-8000-000000000804';

  if leaked <> 0 then
    raise exception 'AC-8.6 FAILED: tech@ resolved admin@''s commission row ...804 by id - commissions_select_own is not scoping on user_id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-8.7 - tenant boundary on commissions_select_own: a cross-org commission
-- row earned by the same tech UUID (a hostile/misissued row planted under
-- `reset role` on org B) must still be invisible - the policy's
-- organization_id predicate must hold even when user_id matches.
-- ---------------------------------------------------------------------------
do $$
declare
  ps_id uuid;
  cp_id uuid;
  leaked_count integer;
  leaked_point integer;
begin
  reset role;

  insert into public.price_sheets (id, organization_id, version, status)
  values ('00000000-0000-4000-8000-0000000008b2', '00000000-0000-4000-8000-0000000000b2', 9001, 'draft')
  on conflict (id) do nothing
  returning id into ps_id;

  if ps_id is null then
    select id into ps_id from public.price_sheets where id = '00000000-0000-4000-8000-0000000008b2';
  end if;

  insert into public.compensation_policies (id, organization_id, name, hourly_rate_cents)
  values ('00000000-0000-4000-8000-0000000009b2', '00000000-0000-4000-8000-0000000000b2', 'AC-8.7 fixture policy (org B)', 2500)
  on conflict (id) do nothing
  returning id into cp_id;

  if cp_id is null then
    select id into cp_id from public.compensation_policies where id = '00000000-0000-4000-8000-0000000009b2';
  end if;

  insert into public.commissions (id, organization_id, job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents)
  values (
    '00000000-0000-4000-8000-0000000010b2', '00000000-0000-4000-8000-0000000000b2',
    '00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-000000000103', ps_id, cp_id, 7000
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked_count
  from public.commissions
  where organization_id = '00000000-0000-4000-8000-0000000000b2';

  select count(*) into leaked_point
  from public.commissions
  where id = '00000000-0000-4000-8000-0000000010b2';

  if leaked_count <> 0 or leaked_point <> 0 then
    raise exception 'AC-8.7 FAILED: tech@ sees a same-user-id commission row from org B (bulk=%, point=%) - commissions_select_own leaked across the tenant boundary', leaked_count, leaked_point;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
