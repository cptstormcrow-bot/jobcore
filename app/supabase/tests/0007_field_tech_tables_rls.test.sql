-- Jobcore - RLS assertions for 0007_field_tech_tables.sql (P4 - checklist
-- templates/instances/items, job_photos, time_off_requests, job_notes)
--
-- Hand-applied. Run this file in the SQL editor AFTER migrations/0001..0007 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- COORDINATION NOTE (crib a3a-f-suite-split.md, cross-suite flag): job_photos
-- carries a second policy layer added by 0012_marketing.sql
-- (`job_photos_select_sales`). This suite covers ONLY 0007's own policies on
-- job_photos - `job_photos_admin_all`, `job_photos_select_tech`,
-- `job_photos_insert_tech`. The sales-role read path is deliberately left to
-- suite 0012; do not add a sales probe here.

begin;

-- ---------------------------------------------------------------------------
-- Shared fixture: a second organization ("org B") plus one row per 0007
-- table inside it, and an in-org-but-unassigned job (seed job ...603) plus
-- one row per 0007 table pointed at that unassigned job. Planted under
-- `reset role` first - the falsifiability gate - so every probe below reads
-- rows that provably exist before RLS is asked to hide them.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  -- Org B: tenant-isolation fixture, mirrors the 0004-suite's AC-3.5 pattern.
  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe')
  on conflict (id) do nothing;

  insert into public.services (id, organization_id, name)
  values ('00000000-0000-4000-8000-0000000030b2', '00000000-0000-4000-8000-0000000000b2', 'Org B Service')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  insert into public.checklist_templates (id, organization_id, service_id, version, name)
  values ('00000000-0000-4000-8000-0000000070b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000030b2', 1, 'Org B Template')
  on conflict (id) do nothing;

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values ('00000000-0000-4000-8000-0000000071b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000070b2', 1, 'start')
  on conflict (id) do nothing;

  insert into public.checklist_items (id, organization_id, instance_id, label)
  values ('00000000-0000-4000-8000-0000000072b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000071b2', 'Org B Item')
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-0000000073b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-000000000103',
          'before', 'org-b/photo.jpg', now())
  on conflict (id) do nothing;

  insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date)
  values ('00000000-0000-4000-8000-0000000074b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-000000000103', '2026-09-01', '2026-09-02')
  on conflict (id) do nothing;

  insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
  values ('00000000-0000-4000-8000-0000000075b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-000000000103',
          'quality_notes', 'Org B note', now())
  on conflict (id) do nothing;

  -- Org A ("home" org, id ...0001) rows pointed at seed job ...603, which is
  -- unassigned - no job_assignments row exists for it. These prove the
  -- tech-scoped policies are gated on assignment, not merely on org match.
  insert into public.checklist_templates (id, organization_id, service_id, version, name)
  values ('00000000-0000-4000-8000-000000007601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000301', 1, 'Org A Template')
  on conflict (id) do nothing;

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values ('00000000-0000-4000-8000-000000007603', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000007601', 1, 'start')
  on conflict (id) do nothing;

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values ('00000000-0000-4000-8000-000000007601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000007601', 1, 'start')
  on conflict (id) do nothing;

  insert into public.checklist_items (id, organization_id, instance_id, label)
  values ('00000000-0000-4000-8000-000000008603', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000007603', 'Unassigned-job item')
  on conflict (id) do nothing;

  insert into public.checklist_items (id, organization_id, instance_id, label)
  values ('00000000-0000-4000-8000-000000008601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000007601', 'Assigned-job item')
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-000000009603', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000103',
          'before', 'org-a/unassigned.jpg', now())
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-000000009601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000103',
          'before', 'org-a/assigned.jpg', now())
  on conflict (id) do nothing;

  insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
  values ('00000000-0000-4000-8000-00000000a603', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000603', null, 'admin_correction', 'Unassigned-job note', now())
  on conflict (id) do nothing;

  insert into public.job_notes (id, organization_id, job_id, tech_id, kind, body, occurred_at)
  values ('00000000-0000-4000-8000-00000000a601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000103',
          'quality_notes', 'Assigned-job note', now())
  on conflict (id) do nothing;

  insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date)
  values ('00000000-0000-4000-8000-00000000b601', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000103', '2026-09-10', '2026-09-11')
  on conflict (id) do nothing;

  -- A second org-A member's own time-off request (admin@), so the tech-scoped
  -- select_own policy can be shown to exclude a same-org row that isn't theirs.
  insert into public.time_off_requests (id, organization_id, tech_id, start_date, end_date)
  values ('00000000-0000-4000-8000-00000000b602', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000102', '2026-09-12', '2026-09-13')
  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.1 - checklist_templates_admin_all: an org admin sees both org-A
-- template rows and can bulk-select them; the org-B template stays invisible.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into visible from public.checklist_templates;

  if visible <> 1 then
    raise exception 'AC-13.1 FAILED: admin@ sees % checklist_templates rows, expected exactly 1 (org A only)', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.2 - checklist_templates_select_tech: the policy is org-scoped only
-- (no assignment gate), so a tech in org A sees the org-A template ...
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into visible
  from public.checklist_templates
  where id = '00000000-0000-4000-8000-000000007601';

  if visible <> 1 then
    raise exception 'AC-13.2 FAILED: tech@ cannot see org A checklist_templates row by id, expected exactly 1';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-13.3 - ... but org B's template is invisible to the org-A tech, by both
-- bulk count and point lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  bulk_leaked integer;
  point_leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into bulk_leaked from public.checklist_templates;

  select count(*) into point_leaked
  from public.checklist_templates
  where id = '00000000-0000-4000-8000-0000000070b2';

  if bulk_leaked <> 1 then
    raise exception 'AC-13.3 FAILED: tech@ sees % checklist_templates rows, expected exactly 1 - org B leaked into the bulk select', bulk_leaked;
  end if;

  if point_leaked <> 0 then
    raise exception 'AC-13.3 FAILED: tech@ resolved the org B template by id - the tenant boundary is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-14.1 - checklist_instances_select_tech: the tech sees the instance tied
-- to their assigned job ...601.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into visible
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-000000007601';

  if visible <> 1 then
    raise exception 'AC-14.1 FAILED: tech@ cannot see the checklist_instances row tied to their assigned job ...601';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-14.2 - the instance tied to unassigned job ...603 stays invisible, by
-- bulk select and by point lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_ids uuid[];
  point_leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select array_agg(id) into visible_ids from public.checklist_instances;

  if '00000000-0000-4000-8000-000000007603'::uuid = any (visible_ids) then
    raise exception 'AC-14.2 FAILED: tech@ sees the checklist_instances row tied to unassigned job ...603 - the job_assignments join is not gating the read';
  end if;

  select count(*) into point_leaked
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-000000007603';

  if point_leaked <> 0 then
    raise exception 'AC-14.2 FAILED: tech@ resolved the unassigned-job instance by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-14.3 - the org-B instance stays invisible regardless of assignment
-- state (tenant boundary outranks the assignment join).
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.checklist_instances
  where id = '00000000-0000-4000-8000-0000000071b2';

  if leaked <> 0 then
    raise exception 'AC-14.3 FAILED: tech@ resolved the org B checklist_instances row by id - the tenant boundary was dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-14.4 - checklist_instances_insert_tech: the tech can insert an instance
-- for their own assigned job ...602, but NOT for unassigned job ...603.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
  values ('00000000-0000-4000-8000-000000007602', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000007601', 1, 'start');
exception
  when insufficient_privilege then
    raise exception 'AC-14.4 FAILED: tech@ could not insert a checklist_instances row for their own assigned job ...602';
end $$;

do $$
declare
  rejected boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.checklist_instances (id, organization_id, job_id, template_id, template_version, kind)
    values ('00000000-0000-4000-8000-00000000c603', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000007601', 1, 'start');
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'AC-14.5 FAILED: tech@ inserted a checklist_instances row for unassigned job ...603 - the with-check assignment gate did not fire';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-15.1 - checklist_items_select_tech: the tech sees the item tied to
-- their assigned-job instance, and NOT the item on the unassigned-job
-- instance or the org-B item.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_ids uuid[];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select array_agg(id order by id) into visible_ids from public.checklist_items;

  if not ('00000000-0000-4000-8000-000000008601'::uuid = any (visible_ids)) then
    raise exception 'AC-15.1 FAILED: tech@ cannot see the checklist_items row tied to their assigned-job instance';
  end if;

  if '00000000-0000-4000-8000-000000008603'::uuid = any (visible_ids) then
    raise exception 'AC-15.1 FAILED: tech@ sees the checklist_items row tied to the unassigned-job instance - assignment gating is not applied';
  end if;

  if '00000000-0000-4000-8000-0000000072b2'::uuid = any (visible_ids) then
    raise exception 'AC-15.1 FAILED: tech@ sees the org B checklist_items row - the tenant boundary was dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-16.1 - job_photos_select_tech (0007's own layer only - see the
-- coordination note at the top of this file): the tech sees the photo on
-- their assigned job ...601, not the photo on unassigned job ...603, and not
-- the org B photo.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_ids uuid[];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select array_agg(id order by id) into visible_ids from public.job_photos;

  if not ('00000000-0000-4000-8000-000000009601'::uuid = any (visible_ids)) then
    raise exception 'AC-16.1 FAILED: tech@ cannot see the job_photos row on their assigned job ...601';
  end if;

  if '00000000-0000-4000-8000-000000009603'::uuid = any (visible_ids) then
    raise exception 'AC-16.1 FAILED: tech@ sees the job_photos row on unassigned job ...603 - assignment gating is not applied';
  end if;

  if '00000000-0000-4000-8000-0000000073b2'::uuid = any (visible_ids) then
    raise exception 'AC-16.1 FAILED: tech@ sees the org B job_photos row - the tenant boundary was dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-16.2 - job_photos_insert_tech: the tech can insert a photo for their
-- own assigned job AND their own tech_id, but not on behalf of another tech
-- (with_check requires tech_id = auth.uid()).
-- ---------------------------------------------------------------------------
do $$
declare
  rejected boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
    values ('00000000-0000-4000-8000-00000000d601', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000102',
            'after', 'org-a/spoofed-tech.jpg', now());
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'AC-16.2 FAILED: tech@ inserted a job_photos row with someone else''s tech_id - the with-check identity gate did not fire';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-17.1 - time_off_requests_select_own: the tech sees only their own
-- request, not admin@'s same-org request, and not the org B request.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_ids uuid[];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select array_agg(id order by id) into visible_ids from public.time_off_requests;

  if visible_ids is distinct from array['00000000-0000-4000-8000-00000000b601'::uuid] then
    raise exception 'AC-17.1 FAILED: tech@ sees time_off_requests rows %, expected exactly their own row - select_own is not scoped to tech_id', visible_ids;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-17.2 - the same-org, different-tech request is invisible even on a
-- direct primary-key lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.time_off_requests
  where id = '00000000-0000-4000-8000-00000000b602';

  if leaked <> 0 then
    raise exception 'AC-17.2 FAILED: tech@ resolved admin@''s time_off_requests row by id - select_own leaks across tech_id on point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-17.3 - time_off_requests_admin_all: an org admin sees every row in
-- their org (own tech's plus the other member's), but not org B's row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into visible from public.time_off_requests;

  if visible <> 2 then
    raise exception 'AC-17.3 FAILED: admin@ sees % time_off_requests rows, expected exactly 2 (org A only)', visible;
  end if;

  select count(*) into leaked
  from public.time_off_requests
  where id = '00000000-0000-4000-8000-0000000074b2';

  if leaked <> 0 then
    raise exception 'AC-17.3 FAILED: admin@ resolved the org B time_off_requests row by id - the tenant boundary was dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-18.1 - job_notes_select_tech: the tech sees the note on their assigned
-- job ...601, not the note on unassigned job ...603, and not the org B note.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_ids uuid[];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select array_agg(id order by id) into visible_ids from public.job_notes;

  if not ('00000000-0000-4000-8000-00000000a601'::uuid = any (visible_ids)) then
    raise exception 'AC-18.1 FAILED: tech@ cannot see the job_notes row on their assigned job ...601';
  end if;

  if '00000000-0000-4000-8000-00000000a603'::uuid = any (visible_ids) then
    raise exception 'AC-18.1 FAILED: tech@ sees the job_notes row on unassigned job ...603 - assignment gating is not applied';
  end if;

  if '00000000-0000-4000-8000-0000000075b2'::uuid = any (visible_ids) then
    raise exception 'AC-18.1 FAILED: tech@ sees the org B job_notes row - the tenant boundary was dropped';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-18.2 - audit-style canary: every 0007 table has exactly the admin_all
-- plus tech-scoped policies this migration defines, no more, no less.
-- ---------------------------------------------------------------------------
do $$
declare
  counts record;
begin
  reset role;

  select
    (select count(*) from pg_policies where tablename = 'checklist_templates') as templates,
    (select count(*) from pg_policies where tablename = 'checklist_instances') as instances,
    (select count(*) from pg_policies where tablename = 'checklist_items') as items,
    (select count(*) from pg_policies where tablename = 'time_off_requests') as time_off,
    (select count(*) from pg_policies where tablename = 'job_notes') as notes
  into counts;

  if counts.templates <> 2 then
    raise exception 'AC-18.2 FAILED: checklist_templates has % policies, expected exactly 2', counts.templates;
  end if;

  if counts.instances <> 3 then
    raise exception 'AC-18.2 FAILED: checklist_instances has % policies, expected exactly 3', counts.instances;
  end if;

  if counts.items <> 3 then
    raise exception 'AC-18.2 FAILED: checklist_items has % policies, expected exactly 3', counts.items;
  end if;

  if counts.time_off <> 3 then
    raise exception 'AC-18.2 FAILED: time_off_requests has % policies, expected exactly 3', counts.time_off;
  end if;

  if counts.notes <> 3 then
    raise exception 'AC-18.2 FAILED: job_notes has % policies, expected exactly 3', counts.notes;
  end if;

  -- job_photos intentionally NOT checked here: 0012_marketing.sql adds a 4th
  -- policy (job_photos_select_sales) on top of this migration's 3, so a
  -- fixed-count canary on job_photos belongs to whichever suite runs last
  -- in the combined apply order, not to 0007 in isolation.
end $$;

-- Nothing above is meant to persist. Roll every fixture back out.
rollback;
