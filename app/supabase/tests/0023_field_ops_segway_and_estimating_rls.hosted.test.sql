-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0023_field_ops_segway_and_estimating.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0023 and seed.hosted.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- Scope: job_assignments.kind check constraint (installer/investigator) and
-- the job_investigations table's admin_all / select_tech / insert_tech /
-- update_tech policies. tech_service_areas, job_punch_list_items,
-- job_material_costs, subcontractor_services, and estimate_documents are
-- straightforward admin_all / org_all / select_own shapes already covered by
-- this suite's sibling files' idiom and are not re-probed here.

begin;

-- ---------------------------------------------------------------------------
-- AC-23.1 - job_assignments.kind check constraint positive: 'investigator'
-- is an accepted value. Planted under `reset role` (service role) since this
-- is a constraint check, not an RLS probe. Reuses unassigned job ...603.
-- ---------------------------------------------------------------------------
do $$
declare
  planted_kind text;
begin
  reset role;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
  values (
    '00000000-0000-4000-8000-000000002301',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    now(),
    'investigator'
  )
  on conflict (id) do nothing;

  select kind into planted_kind
  from public.job_assignments
  where id = '00000000-0000-4000-8000-000000002301';

  if planted_kind <> 'investigator' then
    raise exception 'AC-23.1 FAILED: job_assignments ...2301 kind is %, expected investigator', planted_kind;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.2 - job_assignments.kind check constraint negative: an out-of-domain
-- value is rejected by the check constraint.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  begin
    insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
    values (
      '00000000-0000-4000-8000-000000002302',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000604',
      'd59e3bc7-691d-4ada-8959-e86f40c1e344',
      now(),
      'supervisor'
    );

    raise exception 'AC-23.2 FAILED: job_assignments accepted out-of-domain kind ''supervisor'' - the check constraint is not enforcing';
  exception
    when check_violation then
      null; -- expected
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.3 - job_investigations_admin_all: an org admin inserts, selects, and
-- updates a job_investigations row for their own organization's job.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  seen_state text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  insert into public.job_investigations (
    id, organization_id, job_id, tech_id, ingress_notes, state_assessment
  )
  values (
    '00000000-0000-4000-8000-000000002303',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'AC-23.3 admin-planted ingress note',
    'initial'
  )
  on conflict (id) do nothing;

  select state_assessment into seen_state
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000002303';

  if seen_state <> 'initial' then
    raise exception 'AC-23.3 FAILED: admin@ could not select the fixture job_investigations row ...2303';
  end if;

  update public.job_investigations
     set state_assessment = 'reviewed'
   where id = '00000000-0000-4000-8000-000000002303';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-23.3 FAILED: admin@ update of job_investigations ...2303 affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.4 - job_investigations_insert_tech / select_tech / update_tech
-- positive: tech@ is assigned to job ...603 with kind = 'investigator'
-- (planted in AC-23.1) and may insert, select, and update their own
-- job_investigations row for that job.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  seen_notes text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.job_investigations (
    id, organization_id, job_id, tech_id, ingress_notes
  )
  values (
    '00000000-0000-4000-8000-000000002304',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'tech@ initial ingress note'
  );

  update public.job_investigations
     set ingress_notes = 'tech@ revised ingress note'
   where id = '00000000-0000-4000-8000-000000002304';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-23.4 FAILED: tech@ update of own job_investigations ...2304 affected % rows, expected 1', affected;
  end if;

  select ingress_notes into seen_notes
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000002304';

  if seen_notes <> 'tech@ revised ingress note' then
    raise exception 'AC-23.4 FAILED: tech@ selected ingress_notes = %, expected the revised note', seen_notes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.5 - job_investigations_select_tech negative: a tech assigned to job
-- ...601 only as an 'installer' (seed default kind) cannot see the
-- investigator-gated job_investigations row on that job.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  reset role;

  insert into public.job_investigations (
    id, organization_id, job_id, tech_id, ingress_notes
  )
  values (
    '00000000-0000-4000-8000-000000002305',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'AC-23.5 fixture on installer-only job'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000002305';

  if visible <> 0 then
    raise exception 'AC-23.5 FAILED: tech@ (installer kind only on job ...601) saw the investigator-gated job_investigations row ...2305 - job_investigations_select_tech is not gating on ja.kind';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.6 - tenant boundary: a job_investigations row on org B, with a
-- matching investigator job_assignments row for the same tech UUID planted
-- directly (RLS bypassed for the plant), must still be invisible - the
-- policies' organization_id predicate must hold even when the assignment
-- exists-check would otherwise match.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b3', 'Org B - AC-23.6 isolation probe', 'org-b-2306-isolation-probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-000000002306', '00000000-0000-4000-8000-0000000000b3', 'new')
  on conflict (id) do nothing;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
  values (
    '00000000-0000-4000-8000-000000002307',
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-000000002306',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    now(),
    'investigator'
  )
  on conflict (id) do nothing;

  insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
  values (
    '00000000-0000-4000-8000-000000002308',
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-000000002306',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'AC-23.6 org B fixture'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible
  from public.job_investigations
  where organization_id = '00000000-0000-4000-8000-0000000000b3';

  if visible <> 0 then
    raise exception 'AC-23.6 FAILED: tech@ saw % org-B job_investigations row(s) despite a matching investigator assignment - job_investigations_select_tech dropped its organization_id predicate', visible;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
