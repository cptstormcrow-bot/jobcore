-- Jobcore P4 — field tech tables (checklists, photos, time off, job notes)
-- Apply after 0005.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- A versioned checklist definition for a service. Editing a template creates
-- a new version row rather than mutating an existing one, so checklist_items
-- rows that reference a template version stay stable; checklist_instances
-- below snapshot version at creation time for the same reason.
create table public.checklist_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  version         integer not null,
  name            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint checklist_templates_service_id_version_key unique (service_id, version)
);

create index checklist_templates_organization_id_idx on public.checklist_templates (organization_id);
create index checklist_templates_service_id_idx on public.checklist_templates (service_id);

-- A snapshot of a checklist template for one job. template_version is copied
-- from checklist_templates.version AT INSERT TIME (not re-derived from
-- template_id later), so a later edit to the template never rewrites a
-- finished job's checklist. kind distinguishes the start-of-job checklist
-- from the completion checklist, since a job may carry both.
create table public.checklist_instances (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete cascade,
  template_id      uuid not null references public.checklist_templates (id) on delete restrict,
  template_version integer not null,
  kind             text not null,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  constraint checklist_instances_kind_check
    check (kind in ('start', 'completion'))
);

create index checklist_instances_organization_id_idx on public.checklist_instances (organization_id);
create index checklist_instances_job_id_idx on public.checklist_instances (job_id);
create index checklist_instances_template_id_idx on public.checklist_instances (template_id);

-- A single checklist line, belonging to EITHER a template (the definition,
-- what a tech should see) OR an instance (a tech's actual checked/filled
-- answer on one job), never both. is_checked/value/occurred_at are only
-- meaningful on an instance row; they stay null on a template-definition
-- row. The XOR constraint below is what a CHECK can enforce; which FK is
-- populated determines whether this is a template item or an instance item.
create table public.checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id     uuid references public.checklist_templates (id) on delete cascade,
  instance_id     uuid references public.checklist_instances (id) on delete cascade,
  label           text not null,
  is_checked      boolean,
  value           text,
  occurred_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint checklist_items_template_xor_instance_check
    check (
      (template_id is not null and instance_id is null)
      or (template_id is null and instance_id is not null)
    )
);

create index checklist_items_organization_id_idx on public.checklist_items (organization_id);
create index checklist_items_template_id_idx on public.checklist_items (template_id);
create index checklist_items_instance_id_idx on public.checklist_items (instance_id);

-- A photo captured by a tech against a job: before/after condition, a
-- receipt, or documented damage. storage_path points into Supabase Storage;
-- the row never holds the image bytes. lat/lng are optional device
-- geolocation captured at the same moment as occurred_at.
create table public.job_photos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  tech_id         uuid not null references auth.users (id) on delete restrict,
  kind            text not null,
  storage_path    text not null,
  occurred_at     timestamptz not null,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now(),
  constraint job_photos_kind_check
    check (kind in ('before', 'after', 'receipt', 'damage'))
);

create index job_photos_organization_id_idx on public.job_photos (organization_id);
create index job_photos_job_id_idx on public.job_photos (job_id);
create index job_photos_tech_id_idx on public.job_photos (tech_id);

-- A tech's request for time off. status starts 'pending' and only an org
-- admin moves it to 'approved'/'denied' (enforced by the RLS update policy
-- below, not this constraint).
create table public.time_off_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tech_id         uuid not null references auth.users (id) on delete cascade,
  start_date      date not null,
  end_date        date not null,
  reason          text,
  status          text not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint time_off_requests_status_check
    check (status in ('pending', 'approved', 'denied')),
  constraint time_off_requests_date_range_check
    check (end_date >= start_date)
);

create index time_off_requests_organization_id_idx on public.time_off_requests (organization_id);
create index time_off_requests_tech_id_idx on public.time_off_requests (tech_id);

-- A free-text note attached to a job: a tech's decline reason, quality
-- notes, a customer dispute, or an admin correction to the record.
create table public.job_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  tech_id         uuid references auth.users (id) on delete set null,
  kind            text not null,
  body            text not null,
  occurred_at     timestamptz not null,
  created_at      timestamptz not null default now(),
  constraint job_notes_kind_check
    check (kind in ('decline_reason', 'quality_notes', 'dispute', 'admin_correction'))
);

create index job_notes_organization_id_idx on public.job_notes (organization_id);
create index job_notes_job_id_idx on public.job_notes (job_id);
create index job_notes_tech_id_idx on public.job_notes (tech_id);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.checklist_templates enable row level security;
alter table public.checklist_instances enable row level security;
alter table public.checklist_items enable row level security;
alter table public.job_photos enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.job_notes enable row level security;

-- checklist_templates: definitions are admin-authored; org admins get full
-- read/write, techs get read-only visibility into their own org's templates
-- so the mobile app can render what a checklist should contain.
create policy checklist_templates_admin_all
  on public.checklist_templates for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy checklist_templates_select_tech
  on public.checklist_templates for select
  to authenticated
  using (organization_id = public.current_org_id());

-- checklist_instances: org admins get full read/write within their own
-- organization. A tech may select/insert instances only for jobs they are
-- assigned to, resolved through job_assignments, mirroring jobs_select_tech
-- in 0004_scheduling.sql.
create policy checklist_instances_admin_all
  on public.checklist_instances for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy checklist_instances_select_tech
  on public.checklist_instances for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = checklist_instances.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy checklist_instances_insert_tech
  on public.checklist_instances for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = checklist_instances.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- checklist_items: org admins get full read/write within their own
-- organization. A tech may select/insert only instance-side items (never
-- template-side items), and only for an instance tied to one of their own
-- assigned jobs.
create policy checklist_items_admin_all
  on public.checklist_items for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy checklist_items_select_tech
  on public.checklist_items for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and checklist_items.instance_id is not null
    and exists (
      select 1
      from public.checklist_instances ci
      join public.job_assignments ja on ja.job_id = ci.job_id
      where ci.id = checklist_items.instance_id
        and ja.tech_id = auth.uid()
    )
  );

create policy checklist_items_insert_tech
  on public.checklist_items for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and checklist_items.instance_id is not null
    and exists (
      select 1
      from public.checklist_instances ci
      join public.job_assignments ja on ja.job_id = ci.job_id
      where ci.id = checklist_items.instance_id
        and ja.tech_id = auth.uid()
    )
  );

-- job_photos: org admins get full read/write within their own organization.
-- A tech may select/insert photos only for jobs they are assigned to,
-- resolved through job_assignments.
create policy job_photos_admin_all
  on public.job_photos for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_photos_select_tech
  on public.job_photos for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_photos.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_photos_insert_tech
  on public.job_photos for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_photos.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- time_off_requests: org admins get full read/write (approve/deny) within
-- their own organization. A tech may select/insert only their own requests,
-- scoped directly by tech_id rather than through job_assignments since a
-- time-off request is not tied to any job.
create policy time_off_requests_admin_all
  on public.time_off_requests for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy time_off_requests_select_own
  on public.time_off_requests for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());

create policy time_off_requests_insert_own
  on public.time_off_requests for insert
  to authenticated
  with check (organization_id = public.current_org_id() and tech_id = auth.uid());

-- job_notes: org admins get full read/write within their own organization.
-- A tech may select/insert notes only for jobs they are assigned to,
-- resolved through job_assignments.
create policy job_notes_admin_all
  on public.job_notes for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_notes_select_tech
  on public.job_notes for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_notes.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_notes_insert_tech
  on public.job_notes for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_notes.job_id
        and ja.tech_id = auth.uid()
    )
  );
