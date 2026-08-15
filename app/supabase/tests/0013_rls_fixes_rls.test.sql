-- Jobcore - RLS assertions for 0013_rls_fixes.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0013 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` (or `anon`
-- for the public review-submission probe) and sets `request.jwt.claims` so that
-- `auth.uid()` resolves to the named seed profile. `set local` scopes both to
-- the enclosing transaction.
--
-- CROSS-SUITE COORDINATION (per .crib/a3a-f-suite-split.md): 0013_rls_fixes.sql
-- patches three policies that already had probes elsewhere. This suite covers
-- ONLY the post-fix behavior of those three policies and DELIBERATELY
-- supersedes:
--   - AC-7 / AC-7b / AC-7c in 0004_scheduling_rls.test.sql (jobs_select_org).
--     Those blocks probed the pre-fix, assignment-based read policy; the fix
--     replaced that gate with is_org_sales_or_above(), so the old assertions
--     no longer describe the deployed policy and are not duplicated here.
--   - AC-RV-2 / AC-RV-2b / AC-RV-2c in 0010_payment_review_rls.test.sql
--     (reviews_insert_anon). Those blocks probed the pre-fix anon-insert
--     policy; the fix routes the WITH CHECK through the new SECURITY DEFINER
--     helper job_exists_in_org(), so this suite re-probes that helper's
--     positive/negative behavior directly.
--
-- This suite also adds NET-NEW coverage for jobs_update_org (admin-only
-- org-wide update): no prior local suite exercised this policy at all.
-- 0013_rls_fixes.sql's own header attributes this fix to "0008 AC-8.2", but
-- 0008_field_tech_jobs_rls.test.sql's actual AC-8.2 is a jobs_update_tech
-- negative-case test (tech attempting to update an unassigned job) - an
-- unrelated policy from jobs_update_org. That header wording is a
-- pre-existing documentation inaccuracy, flagged here rather than silently
-- carried forward or corrected upstream.

begin;

-- ---------------------------------------------------------------------------
-- Fixture plant - all under `reset role` first (the falsifiability gate).
-- Org B (a synthetic second organization + one job row, mirroring the
-- 0004-suite AC-3.5 pattern) exercises the jobs_update_org tenant-boundary
-- probe.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.1 - jobs_select_org: sales-or-above (sales@) can read org jobs
-- directly, gated by is_org_sales_or_above() rather than assignment.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into visible from public.jobs where organization_id = '00000000-0000-4000-8000-000000000001';

  if visible <> 5 then
    raise exception 'AC-13.1 FAILED: sales@ sees % org jobs, expected exactly 5 - is_org_sales_or_above() is not gating jobs_select_org', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.1b - jobs_select_org: a tech (below sales) is denied by this policy.
-- The tech still sees their 3 assigned jobs via jobs_select_tech, but the
-- unassigned same-org jobs (...603, ...605) must stay invisible, proving
-- jobs_select_org itself is not granting tech-level access.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where id in ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000605');

  if leaked <> 0 then
    raise exception 'AC-13.1b FAILED: tech@ sees % unassigned same-org jobs - jobs_select_org is granting tech-level read access', leaked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.2 - jobs_update_org (net-new coverage): an org admin can update any
-- job in their organization, including one not assigned to them.
-- ---------------------------------------------------------------------------
do $$
declare
  new_status text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  update public.jobs set status = 'in_progress' where id = '00000000-0000-4000-8000-000000000603';

  select status into new_status from public.jobs where id = '00000000-0000-4000-8000-000000000603';

  if new_status <> 'in_progress' then
    raise exception 'AC-13.2 FAILED: admin@ org-wide update did not apply, status = %', new_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.2b - jobs_update_org: a tech is denied - zero rows affected, RLS
-- filters the row before any update logic runs.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.jobs set status = 'cancelled' where id = '00000000-0000-4000-8000-000000000605';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-13.2b FAILED: tech@ updated a job via jobs_update_org - % rows affected, expected 0', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.2c - jobs_update_org: sales is denied - zero rows affected.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  update public.jobs set status = 'cancelled' where id = '00000000-0000-4000-8000-000000000605';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-13.2c FAILED: sales@ updated a job via jobs_update_org - % rows affected, expected 0', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.2d - jobs_update_org: tenant boundary. The Org A admin cannot update
-- the Org B job, even though they pass the is_org_admin() check.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  update public.jobs set status = 'cancelled' where id = '00000000-0000-4000-8000-0000000006b2';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-13.2d FAILED: admin@ updated the org B job via jobs_update_org - tenant boundary breached, % rows affected', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.3 - reviews_insert_anon: an anon-role caller can insert a review when
-- job_exists_in_org(job_id, organization_id) holds - the job row's real
-- organization_id matches the submitted organization_id.
-- ---------------------------------------------------------------------------
do $$
declare
  inserted integer;
begin
  set local role anon;

  insert into public.reviews (id, organization_id, job_id, rating, body, platform)
  values (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    5, 'Anon review via job_exists_in_org', 'internal'
  );

  select count(*) into inserted
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000901';

  reset role;

  if inserted <> 1 then
    raise exception 'AC-13.3 FAILED: anon insert into reviews did not persist under a matching job_exists_in_org() check';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.3b - reviews_insert_anon: the insert is rejected when job_id and
-- organization_id do not correspond to the same real job row - the
-- job_exists_in_org() join fails and the WITH CHECK denies the row.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role anon;

  begin
    insert into public.reviews (id, organization_id, job_id, rating, body, platform)
    values (
      '00000000-0000-4000-8000-000000000902',
      '00000000-0000-4000-8000-0000000000b2',
      '00000000-0000-4000-8000-000000000601',
      1, 'Mismatched org/job anon review', 'internal'
    );

    raise exception 'AC-13.3b FAILED: anon insert with mismatched organization_id/job_id succeeded - job_exists_in_org() is not enforcing the join';
  exception
    when others then
      if sqlerrm like 'AC-13.3b FAILED%' then
        raise;
      end if;
  end;

  reset role;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
