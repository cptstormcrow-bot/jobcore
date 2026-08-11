-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0007_field_tech_tables.sql (P4 - checklist_templates,
-- checklist_instances, checklist_items, job_photos, time_off_requests, job_notes)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0007 and seed.hosted.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- Cross-suite note: `job_photos` also carries a policy from 0012
-- (`job_photos_select_sales`). This file covers ONLY 0007's tech-facing policies
-- (`job_photos_select_tech`, `job_photos_insert_tech`, `job_photos_admin_all`); it
-- does not duplicate 0012's sales-facing assertions.
--
-- "Different tech" negative probes use sales@ (a same-org authenticated user with
-- no job_assignments row) rather than minting a second synthetic tech user, since
-- every 0007 policy gates on job_assignments/tech_id, not on profiles.role.

begin;

-- ---------------------------------------------------------------------------
-- SETUP - fixture rows for every AC below, planted under `reset role` (the
-- falsifiability gate) before any impersonation. Org B and a job inside it are
-- created for the cross-org probes; a checklist template/instance/item, a job
-- photo, a time-off request, and a job note are planted in org A, tied to
-- job ...601 (already assigned to tech@ per seed.sql), plus their org-B twins.
-- ---------------------------------------------------------------------------
do $$
declare
  fixture_count integer;
begin
  reset role;

  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b7', 'Org B - isolation probe (0007)')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000090b7', '00000000-0000-4000-8000-0000000000b7', 'new')
  on conflict (id) do nothing;

  insert into public.checklist_templates (id, organization_id, service_id, version, name)
  values
    ('00000000-0000-4000-8000-000000000900', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000301', 9900, 'AC-9 fixture template - org A'),
    ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-0000000000b7',
     '00000000-0000-4000-8000-000000000301', 9901, 'AC-9 fixture template - org B')
  on conflict (id) do nothing;

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values
    ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000900', 9900, 'start'),
    ('00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-0000000000b7',
     '00000000-0000-4000-8000-0000000090b7', '00000000-0000-4000-8000-000000000901', 9901, 'start')
  on conflict (id) do nothing;

  insert into public.checklist_items (id, organization_id, instance_id, label, is_checked)
  values ('00000000-0000-4000-8000-000000000905', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000902', 'AC-9 fixture item', false)
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values
    ('00000000-0000-4000-8000-000000000906', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
     'before', 'ac9/fixture-photo-a.jpg', now()),
    ('00000000-0000-4000-8000-000000000907', '00000000-0000-4000-8000-0000000000b7',
     '00000000-0000-4000-8000-0000000090b7', '09595a9b-12f3-46a7-845c-aae615f776c3',
     'before', 'ac9/fixture-photo-b.jpg', now())
  on conflict (id) do nothing;

  insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date, reason)
  values
    ('00000000-0000-4000-8000-000000000908', '00000000-0000-4000-8000-000000000001',
     'd59e3bc7-691d-4ada-8959-e86f40c1e344', '2026-09-01', '2026-09-03', 'AC-9 fixture - own'),
    ('00000000-0000-4000-8000-000000000909', '00000000-0000-4000-8000-000000000001',
     'a143fac2-4806-42ed-9283-b45275b6c53a', '2026-09-05', '2026-09-06', 'AC-9 fixture - other')
  on conflict (id) do nothing;

  insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
  values
    ('00000000-0000-4000-8000-000000000910', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
     'quality_notes', 'AC-9 fixture note - org A', now()),
    ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-0000000000b7',
     '00000000-0000-4000-8000-0000000090b7', '09595a9b-12f3-46a7-845c-aae615f776c3',
     'quality_notes', 'AC-9 fixture note - org B', now())
  on conflict (id) do nothing;

  select count(*) into fixture_count
  from public.checklist_templates
  where id in ('00000000-0000-4000-8000-000000000900', '00000000-0000-4000-8000-000000000901');

  if fixture_count <> 2 then
    raise exception 'AC-9 SETUP FAILED: expected 2 fixture checklist_templates rows, found %', fixture_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.1 - checklist_templates_select_tech positive: tech@ sees the org A
-- fixture template.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.checklist_templates
  where id = '00000000-0000-4000-8000-000000000900';

  if own_count <> 1 then
    raise exception 'AC-9.1 FAILED: tech@ sees % rows for org A template ...900, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.2 - checklist_templates_select_tech negative: tech@ cannot see the org
-- B fixture template, neither in bulk count nor by PK lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.checklist_templates
  where id = '00000000-0000-4000-8000-000000000901';

  if leaked_count <> 0 then
    raise exception 'AC-9.2 FAILED: tech@ resolved org B template ...901 by id - tenancy boundary leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.3 - checklist_instances_select_tech positive: tech@ sees the instance
-- tied to their own assigned job ...601.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-000000000902';

  if own_count <> 1 then
    raise exception 'AC-9.3 FAILED: tech@ sees % rows for own-job instance ...902, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.4 - checklist_instances_select_tech negative: sales@ (same org, no
-- job_assignments row for ...601) cannot see instance ...902, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked_count
  from public.checklist_instances
  where job_id = '00000000-0000-4000-8000-000000000601';

  if leaked_count <> 0 then
    raise exception 'AC-9.4 FAILED: sales@ sees % instance rows for job ...601 via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-000000000902';

  if leaked_lookup <> 0 then
    raise exception 'AC-9.4 FAILED: sales@ resolved instance ...902 by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.5 - checklist_instances_select_tech negative: tech@ cannot see the org
-- B instance ...904, bulk or by PK - assignment does not widen the tenant
-- boundary.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-000000000904';

  if leaked_count <> 0 then
    raise exception 'AC-9.5 FAILED: tech@ resolved org B instance ...904 by id - tenancy boundary leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.6 - checklist_instances_insert_tech positive: tech@ inserts a new
-- instance for their own assigned job ...601.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000900', 9900, 'completion');

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-9.6 FAILED: tech@ insert on own-job instance affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.7 - checklist_instances_insert_tech negative: tech@ attempts to insert
-- an instance for job ...603, which is in their own org but NOT assigned to
-- them. The WITH CHECK clause must reject the row.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
    values ('00000000-0000-4000-8000-000000000913', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000900', 9900, 'start');
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.7 FAILED: tech@ inserted an instance for unassigned job ...603 without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.8 - checklist_items_select_tech positive: tech@ sees the instance-side
-- item on their own assigned job's instance.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.checklist_items
  where id = '00000000-0000-4000-8000-000000000905';

  if own_count <> 1 then
    raise exception 'AC-9.8 FAILED: tech@ sees % rows for own-job item ...905, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.9 - checklist_items_select_tech negative: sales@ (not assigned to job
-- ...601) cannot see item ...905, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked_count
  from public.checklist_items
  where instance_id = '00000000-0000-4000-8000-000000000902';

  if leaked_count <> 0 then
    raise exception 'AC-9.9 FAILED: sales@ sees % item rows for instance ...902 via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.checklist_items
  where id = '00000000-0000-4000-8000-000000000905';

  if leaked_lookup <> 0 then
    raise exception 'AC-9.9 FAILED: sales@ resolved item ...905 by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.10 - checklist_items_insert_tech positive: tech@ inserts a new
-- instance-side item on their own assigned job's instance.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.checklist_items (id, organization_id, instance_id, label, is_checked)
  values ('00000000-0000-4000-8000-000000000913', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000902', 'AC-9.10 fixture item', true);

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-9.10 FAILED: tech@ insert on own-job item affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.11 - checklist_items_insert_tech negative: tech@ attempts to insert an
-- item on the org B instance ...904. The WITH CHECK clause must reject it.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.checklist_items (id, organization_id, instance_id, label, is_checked)
    values ('00000000-0000-4000-8000-000000000914', '00000000-0000-4000-8000-0000000000b7',
            '00000000-0000-4000-8000-000000000904', 'AC-9.11 fixture item', true);
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.11 FAILED: tech@ inserted an item on org B instance ...904 without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.12 - job_photos_select_tech positive: tech@ sees their own assigned
-- job's photo ...906.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.job_photos
  where id = '00000000-0000-4000-8000-000000000906';

  if own_count <> 1 then
    raise exception 'AC-9.12 FAILED: tech@ sees % rows for own-job photo ...906, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.13 - job_photos_select_tech negative: sales@ (not assigned to job
-- ...601) cannot see photo ...906, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked_count
  from public.job_photos
  where job_id = '00000000-0000-4000-8000-000000000601';

  if leaked_count <> 0 then
    raise exception 'AC-9.13 FAILED: sales@ sees % photo rows for job ...601 via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.job_photos
  where id = '00000000-0000-4000-8000-000000000906';

  if leaked_lookup <> 0 then
    raise exception 'AC-9.13 FAILED: sales@ resolved photo ...906 by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.14 - job_photos_select_tech negative: tech@ cannot see the org B
-- photo ...907, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.job_photos
  where id = '00000000-0000-4000-8000-000000000907';

  if leaked_count <> 0 then
    raise exception 'AC-9.14 FAILED: tech@ resolved org B photo ...907 by id - tenancy boundary leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.15 - job_photos_insert_tech positive: tech@ inserts a photo for their
-- own assigned job ...601, tagged with their own tech_id.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-000000000915', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          'after', 'ac9/insert-photo.jpg', now());

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-9.15 FAILED: tech@ insert on own-job photo affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.16 - job_photos_insert_tech negative: tech@ attempts to insert a photo
-- for job ...603, which is in their own org but NOT assigned to them. The
-- WITH CHECK clause must reject the row.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
    values ('00000000-0000-4000-8000-000000000916', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000603', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
            'before', 'ac9/rejected-photo.jpg', now());
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.16 FAILED: tech@ inserted a photo for unassigned job ...603 without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.17 - job_photos_insert_tech negative: tech@ attempts to insert a photo
-- for their own assigned job ...601 but tagged with a different tech_id
-- (impersonation). The `tech_id = auth.uid()` WITH CHECK clause must reject it.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
    values ('00000000-0000-4000-8000-000000000917', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000601', 'cff3db85-9535-45c7-ac36-3a78ac161a4b',
            'before', 'ac9/impersonated-photo.jpg', now());
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.17 FAILED: tech@ inserted a photo tagged with another user''s tech_id without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.18 - time_off_requests_select_own positive: tech@ sees their own
-- request ...908.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.time_off_requests
  where id = '00000000-0000-4000-8000-000000000908';

  if own_count <> 1 then
    raise exception 'AC-9.18 FAILED: tech@ sees % rows for own request ...908, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.19 - time_off_requests_select_own negative: tech@ cannot see admin@'s
-- request ...909, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.time_off_requests
  where tech_id = 'a143fac2-4806-42ed-9283-b45275b6c53a';

  if leaked_count <> 0 then
    raise exception 'AC-9.19 FAILED: tech@ sees % of admin@''s time-off rows via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.time_off_requests
  where id = '00000000-0000-4000-8000-000000000909';

  if leaked_lookup <> 0 then
    raise exception 'AC-9.19 FAILED: tech@ resolved admin@''s request ...909 by id - own-row gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.20 - time_off_requests_insert_own positive: tech@ inserts their own
-- request.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date, reason)
  values ('00000000-0000-4000-8000-000000000918', '00000000-0000-4000-8000-000000000001',
          'd59e3bc7-691d-4ada-8959-e86f40c1e344', '2026-10-01', '2026-10-02', 'AC-9.20 fixture');

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-9.20 FAILED: tech@ insert on own time-off request affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.21 - time_off_requests_insert_own negative: tech@ attempts to insert a
-- request tagged with admin@'s tech_id (impersonation). The WITH CHECK clause
-- must reject it.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date, reason)
    values ('00000000-0000-4000-8000-000000000919', '00000000-0000-4000-8000-000000000001',
            'a143fac2-4806-42ed-9283-b45275b6c53a', '2026-10-03', '2026-10-04', 'AC-9.21 rejected');
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.21 FAILED: tech@ inserted a time-off request tagged with admin@''s tech_id without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.22 - job_notes_select_tech positive: tech@ sees the note on their own
-- assigned job ...601.
-- ---------------------------------------------------------------------------
do $$
declare
  own_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into own_count
  from public.job_notes
  where id = '00000000-0000-4000-8000-000000000910';

  if own_count <> 1 then
    raise exception 'AC-9.22 FAILED: tech@ sees % rows for own-job note ...910, expected 1', own_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.23 - job_notes_select_tech negative: sales@ (not assigned to job
-- ...601) cannot see note ...910, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
  leaked_lookup integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked_count
  from public.job_notes
  where job_id = '00000000-0000-4000-8000-000000000601';

  if leaked_count <> 0 then
    raise exception 'AC-9.23 FAILED: sales@ sees % note rows for job ...601 via bulk select, expected 0', leaked_count;
  end if;

  select count(*) into leaked_lookup
  from public.job_notes
  where id = '00000000-0000-4000-8000-000000000910';

  if leaked_lookup <> 0 then
    raise exception 'AC-9.23 FAILED: sales@ resolved note ...910 by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.24 - job_notes_select_tech negative: tech@ cannot see the org B note
-- ...911, bulk or by PK.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked_count
  from public.job_notes
  where id = '00000000-0000-4000-8000-000000000911';

  if leaked_count <> 0 then
    raise exception 'AC-9.24 FAILED: tech@ resolved org B note ...911 by id - tenancy boundary leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.25 - job_notes_insert_tech positive: tech@ inserts a note for their
-- own assigned job ...601, tagged with their own tech_id.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
  values ('00000000-0000-4000-8000-000000000920', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          'quality_notes', 'AC-9.25 fixture note', now());

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-9.25 FAILED: tech@ insert on own-job note affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.26 - job_notes_insert_tech negative: tech@ attempts to insert a note
-- for job ...603, which is in their own org but NOT assigned to them. The
-- WITH CHECK clause must reject the row.
-- ---------------------------------------------------------------------------
do $$
declare
  caught boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
    values ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000603', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
            'quality_notes', 'AC-9.26 rejected note', now());
  exception
    when others then
      caught := true;
  end;

  if not caught then
    raise exception 'AC-9.26 FAILED: tech@ inserted a note for unassigned job ...603 without the policy rejecting it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-9.27 - admin_all canary: owner@ (org admin) reads across all six 0007
-- tables without any assignment relationship, confirming *_admin_all grants
-- full org-scoped visibility independent of job_assignments/tech_id.
-- ---------------------------------------------------------------------------
do $$
declare
  templates_seen integer;
  instances_seen integer;
  items_seen integer;
  photos_seen integer;
  timeoff_seen integer;
  notes_seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into templates_seen from public.checklist_templates where id = '00000000-0000-4000-8000-000000000900';
  select count(*) into instances_seen from public.checklist_instances where id = '00000000-0000-4000-8000-000000000902';
  select count(*) into items_seen from public.checklist_items where id = '00000000-0000-4000-8000-000000000905';
  select count(*) into photos_seen from public.job_photos where id = '00000000-0000-4000-8000-000000000906';
  select count(*) into timeoff_seen from public.time_off_requests where id = '00000000-0000-4000-8000-000000000909';
  select count(*) into notes_seen from public.job_notes where id = '00000000-0000-4000-8000-000000000910';

  if templates_seen <> 1 or instances_seen <> 1 or items_seen <> 1
     or photos_seen <> 1 or timeoff_seen <> 1 or notes_seen <> 1 then
    raise exception 'AC-9.27 FAILED: owner@ admin_all visibility incomplete - templates=% instances=% items=% photos=% timeoff=% notes=%',
      templates_seen, instances_seen, items_seen, photos_seen, timeoff_seen, notes_seen;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe fixtures back out.
rollback;
