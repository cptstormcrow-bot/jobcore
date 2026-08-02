-- 0001_foundation_rls.test.sql
--
-- Assertions for the foundation layer: audit_log immutability (README AC-5.3 /
-- AC-5.4) and the profiles recursion canary (README "Recursion smoke test").
--
-- Run this as an AUTHENTICATED session, not the service role. The service role
-- bypasses RLS entirely and would make every assertion below pass vacuously.
--
-- Impersonation contract: each block sets
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<profile uuid>","role":"authenticated"}';
-- and returns to the privileged session with "reset role" where seed data must
-- be planted with RLS bypassed.
--
-- Seed identifiers used here (see seed.sql):
--   org      00000000-0000-4000-8000-000000000001
--   owner    00000000-0000-4000-8000-000000000101
--   tech     00000000-0000-4000-8000-000000000103

begin;

-- ---------------------------------------------------------------------------
-- Fixture: plant one audit_log row with RLS bypassed. Without this row the
-- update/delete assertions below would report 0 rows against an empty table
-- and pass vacuously.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'test.fixture',
    'job',
    '00000000-0000-4000-8000-000000000601',
    '{}'::jsonb
  );

  if (select count(*) from public.audit_log where action = 'test.fixture') <> 1 then
    raise exception 'FIXTURE FAILED: expected exactly 1 test.fixture audit row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-5.3 -- audit_log has no UPDATE policy, so an authenticated update affects
-- zero rows. Under RLS the absence of a policy is a denial.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  update public.audit_log
     set action = 'tampered'
   where action = 'test.fixture';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-5.3 FAILED: update affected % audit_log row(s), expected 0 -- an UPDATE policy exists where none should', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-5.4 -- audit_log has no DELETE policy, so an authenticated delete affects
-- zero rows, for the same reason.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  delete from public.audit_log
   where action = 'test.fixture';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-5.4 FAILED: delete affected % audit_log row(s), expected 0 -- a DELETE policy exists where none should', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-5.3b -- the fixture row is still intact and unmodified after both probes.
-- This distinguishes "denied" from "silently succeeded but reported 0".
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  if (select count(*) from public.audit_log where action = 'test.fixture') <> 1 then
    raise exception 'AC-5.3b FAILED: the fixture audit row did not survive the update/delete probes';
  end if;

  if exists (select 1 from public.audit_log where action = 'tampered') then
    raise exception 'AC-5.3b FAILED: an audit row was mutated to action=tampered';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-5.2 -- an authenticated user can still INSERT into audit_log (append-only
-- means append IS allowed). Guards against "fixed" immutability by revoking
-- everything.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'test.append',
    'job',
    '00000000-0000-4000-8000-000000000601',
    '{}'::jsonb
  );

  if (select count(*) from public.audit_log where action = 'test.append') <> 1 then
    raise exception 'AC-5.2 FAILED: an authenticated INSERT into audit_log did not land -- append-only must still permit append';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Recursion canary -- a select against public.profiles as an authenticated
-- seed user must complete. If a profiles SELECT policy is ever rewritten to
-- read public.profiles inline instead of going through the security-definer
-- helper public.current_org_id(), this raises
--   infinite recursion detected in policy for relation "profiles"
-- and that error is the canary.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  select count(*) into seen from public.profiles;

  if seen < 1 then
    raise exception 'RECURSION CANARY FAILED: owner sees % profile(s), expected at least 1 -- the SELECT resolved but returned nothing', seen;
  end if;
exception
  when others then
    raise exception 'RECURSION CANARY FAILED: select on public.profiles raised: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Recursion canary (tech) -- the same path from a non-admin role, since the
-- admin-only policies read public.profiles inline via exists(). A plain SELECT
-- must not invoke them.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into seen from public.profiles;

  if seen < 1 then
    raise exception 'RECURSION CANARY (tech) FAILED: tech sees % profile(s), expected at least 1', seen;
  end if;
exception
  when others then
    raise exception 'RECURSION CANARY (tech) FAILED: select on public.profiles raised: %', sqlerrm;
end $$;

rollback;
