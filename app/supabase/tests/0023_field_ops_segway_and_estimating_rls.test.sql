-- Jobcore - RLS assertions for 0050_field_ops_segway_and_estimating.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER migrations/0001..0023 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed
-- profile. `set local` scopes both to the enclosing transaction. Reuses the
-- same seed admin/tech ids as 0008_field_tech_jobs_rls.test.sql (org
-- 00000000-0000-4000-8000-000000000001, admin@ ...102, tech@ ...103).
--
-- Scope: this file covers ONLY 0023's own additions - the job_assignments.kind
-- check constraint, and the job_investigations table + its three RLS
-- policies (admin_all, select_tech, insert_tech, update_tech). It does not
-- re-probe tech_service_areas, job_punch_list_items, job_material_costs,
-- subcontractor_services, or estimate_documents, which 0023 also adds but
-- which follow the already-covered admin_all/org_all idioms exactly.

begin;

-- ---------------------------------------------------------------------------
-- AC-23.1 - job_assignments.kind check constraint: 'installer' and
-- 'investigator' are both accepted; any other value is rejected.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
  values (
    '00000000-0000-4000-8000-000000000c10',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000103',
    now(), 'investigator'
  )
  on conflict (id) do update set kind = excluded.kind;

  delete from public.job_assignments where id = '00000000-0000-4000-8000-000000000c10';

  begin
    insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
    values (
      '00000000-0000-4000-8000-000000000c11',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000603',
      '00000000-0000-4000-8000-000000000103',
      now(), 'supervisor'
    );

    raise exception 'AC-23.1 FAILED: job_assignments accepted kind = ''supervisor'' - the check constraint is not enforcing the installer/investigator enum';
  exception
    when check_violation then
      null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Fixture: plant an investigator-kind assignment for tech@ on unassigned job
-- ...603, under `reset role` (falsifiability gate for the tech-scoped checks
-- below).
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
  values (
    '00000000-0000-4000-8000-000000000c00',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000103',
    now(), 'investigator'
  )
  on conflict (id) do update set kind = excluded.kind;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.2 - job_investigations_admin_all: an org admin can insert, select,
-- update, and delete a job_investigations row regardless of any
-- job_assignments row.
-- ---------------------------------------------------------------------------
do $$
declare
  seen_notes text;
  remaining integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
  values (
    '00000000-0000-4000-8000-000000000c01',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000604',
    '00000000-0000-4000-8000-000000000103',
    'Narrow side gate, no vehicle access'
  );

  select ingress_notes into seen_notes
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000c01';

  if seen_notes is null then
    raise exception 'AC-23.2 FAILED: admin@ could not select the job_investigations row they just inserted - job_investigations_admin_all is not permitting org-admin select';
  end if;

  update public.job_investigations
     set ingress_notes = 'Narrow side gate, no vehicle access - confirmed'
   where id = '00000000-0000-4000-8000-000000000c01';

  select ingress_notes into seen_notes
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000c01';

  if seen_notes <> 'Narrow side gate, no vehicle access - confirmed' then
    raise exception 'AC-23.2 FAILED: admin@ update of job_investigations did not apply, ingress_notes = %', seen_notes;
  end if;

  delete from public.job_investigations where id = '00000000-0000-4000-8000-000000000c01';

  select count(*) into remaining from public.job_investigations where id = '00000000-0000-4000-8000-000000000c01';

  if remaining <> 0 then
    raise exception 'AC-23.2 FAILED: admin@ delete of job_investigations did not apply, % rows remain', remaining;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.3 - job_investigations_select_tech positive: tech@, assigned as
-- `investigator` on job ...603 (fixture above), can select their own
-- investigation row for that job.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  reset role;

  insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
  values (
    '00000000-0000-4000-8000-000000000c02',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000103',
    'Steep driveway, park on street'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into visible
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000c02';

  if visible <> 1 then
    raise exception 'AC-23.3 FAILED: tech@ (assigned as investigator on job ...603) could not read their own job_investigations row - job_investigations_select_tech is not resolving through job_assignments.kind = investigator';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.4 - job_investigations_select_tech negative: tech@ is assigned to
-- job ...601 as the default `installer` kind (seed row ...701), not
-- `investigator`. A job_investigations row planted for that job must stay
-- invisible to them.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  reset role;

  insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
  values (
    '00000000-0000-4000-8000-000000000c03',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000103',
    'Planted by an admin, tech is only an installer here'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000c03';

  if leaked <> 0 then
    raise exception 'AC-23.4 FAILED: tech@ (assigned as installer, not investigator, on job ...601) read a job_investigations row - job_investigations_select_tech is not gating on job_assignments.kind';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.5 - job_investigations_insert_tech negative: the same installer-only
-- tech@ cannot insert a job_investigations row for job ...601 themselves.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
    values (
      '00000000-0000-4000-8000-000000000c04',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000103',
      'Should be rejected - installer, not investigator'
    );

    raise exception 'AC-23.5 FAILED: tech@ inserted a job_investigations row for a job where they are only an installer - job_investigations_insert_tech is over-permitting';
  exception
    when others then
      if sqlerrm like 'AC-23.5 FAILED%' then
        raise;
      end if;
  end;

  select count(*) into affected from public.job_investigations where id = '00000000-0000-4000-8000-000000000c04';

  if affected <> 0 then
    raise exception 'AC-23.5 FAILED: tech@ insert into job_investigations for job ...601 persisted, % rows', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.6 - job_investigations_update_tech positive: tech@, assigned as
-- investigator on job ...603, updates their own evolving investigation row
-- ...c02 (planted in AC-23.3).
-- ---------------------------------------------------------------------------
do $$
declare
  new_notes text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.job_investigations
     set state_assessment = 'Engineered - foundation slope exceeds threshold'
   where id = '00000000-0000-4000-8000-000000000c02';

  select state_assessment into new_notes
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000c02';

  if new_notes <> 'Engineered - foundation slope exceeds threshold' then
    raise exception 'AC-23.6 FAILED: tech@ update of their own investigator-scoped job_investigations row ...c02 did not apply, state_assessment = %', new_notes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-23.7 - tenant boundary: a job_investigations row on a second org's job,
-- with the same tech UUID granted a matching `investigator` assignment on
-- that org B job (hostile/misissued fixture, planted under `reset role`),
-- must still be invisible to tech@ - the policies' organization_id
-- predicate must hold even when the tech_id/kind match.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_point integer;
begin
  reset role;

  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b3', 'Org B - 0023 isolation probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-000000000cb3', '00000000-0000-4000-8000-0000000000b3', 'new')
  on conflict (id) do nothing;

  insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, kind)
  values (
    '00000000-0000-4000-8000-000000000db3',
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-000000000cb3',
    '00000000-0000-4000-8000-000000000103',
    now(), 'investigator'
  )
  on conflict (id) do nothing;

  insert into public.job_investigations (id, organization_id, job_id, tech_id, ingress_notes)
  values (
    '00000000-0000-4000-8000-000000000eb3',
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-000000000cb3',
    '00000000-0000-4000-8000-000000000103',
    'Org B investigation row - must not leak'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked_count
  from public.job_investigations
  where organization_id = '00000000-0000-4000-8000-0000000000b3';

  select count(*) into leaked_point
  from public.job_investigations
  where id = '00000000-0000-4000-8000-000000000eb3';

  if leaked_count <> 0 or leaked_point <> 0 then
    raise exception 'AC-23.7 FAILED: tech@ sees a same-user-id, same-kind job_investigations row from org B (bulk=%, point=%) - job_investigations_select_tech leaked across the tenant boundary', leaked_count, leaked_point;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
