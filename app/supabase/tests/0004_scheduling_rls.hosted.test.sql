-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0004_scheduling.sql (P2 - AC-3, AC-7)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0004 and seed.sql.
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
-- AC-3.1 - the tenancy helper resolves for an authenticated owner.
-- ---------------------------------------------------------------------------
do $$
declare
  resolved uuid;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select public.current_org_id() into resolved;

  if resolved is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'AC-3.1 FAILED: current_org_id() returned % for owner@, expected the seed org', resolved;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-3.5 - the real isolation test. A second organization and a job inside it
-- are created with RLS bypassed, then the owner of org A re-reads `jobs`.
-- Org B must be invisible: the owner still sees exactly the 5 seeded jobs.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_jobs integer;
  total_jobs integer;
begin
  -- Setup runs as the definer/superuser context of this DO block, outside the
  -- authenticated session established below.
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe', 'org-b-isolation-probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  select count(*) into total_jobs from public.jobs;

  if total_jobs < 6 then
    raise exception 'AC-3.5 SETUP FAILED: expected at least 6 job rows across both orgs, found %', total_jobs;
  end if;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into visible_jobs from public.jobs;

  if visible_jobs <> 5 then
    raise exception 'AC-3.5 FAILED: owner@ sees % job rows, expected exactly 5 - org B leaked across the tenant boundary', visible_jobs;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-3.5b - the owner of org A cannot read the org B job by its primary key.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where id = '00000000-0000-4000-8000-0000000006b2';

  if leaked <> 0 then
    raise exception 'AC-3.5b FAILED: owner@ resolved the org B job by id - point lookups bypass the tenant boundary';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-7 - a tech querying `jobs` directly sees ONLY their own assigned jobs.
-- The seed assigns tech@ to jobs ...601, ...602 and ...604. Jobs ...603 and
-- ...605 are in the same organization but unassigned, so they must not appear:
-- this is what distinguishes the `jobs_select_tech` policy from plain tenancy.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_jobs integer;
  visible_ids uuid[];
  expected_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000601'::uuid,
    '00000000-0000-4000-8000-000000000602'::uuid,
    '00000000-0000-4000-8000-000000000604'::uuid
  ];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*), array_agg(id order by id)
  into visible_jobs, visible_ids
  from public.jobs;

  if visible_jobs <> 3 then
    raise exception 'AC-7 FAILED: tech@ sees % job rows, expected exactly 3 assigned jobs', visible_jobs;
  end if;

  if visible_ids is distinct from expected_ids then
    raise exception 'AC-7 FAILED: tech@ sees jobs %, expected % - the job_assignments join is not gating the read', visible_ids, expected_ids;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-7b - an unassigned job in the tech's own organization stays invisible
-- even on a direct primary-key lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where id = '00000000-0000-4000-8000-000000000603';

  if leaked <> 0 then
    raise exception 'AC-7b FAILED: tech@ resolved unassigned job ...603 by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-7c - assignment does not widen the tenant boundary. The org B job is
-- invisible to the tech regardless of assignment state.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where organization_id = '00000000-0000-4000-8000-0000000000b2';

  if leaked <> 0 then
    raise exception 'AC-7c FAILED: tech@ sees org B rows - the assignment policy dropped its organization_id predicate';
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org back out.
rollback;
