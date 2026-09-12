-- Jobcore — Field Ops: Segway investigation dispatch, progressive punch list,
-- material costs & subcontracting, customer-facing estimate documents.
-- Apply after 0022. See plans/jobcore-service-area.md §3-§8.

-- ---------------------------------------------------------------------------
-- 1. §3 Tech service-area coverage
-- ---------------------------------------------------------------------------

-- Many-to-many coverage: which service areas a tech is willing/able to work.
-- Read by segway-candidates.ts to filter/flag technician candidates when
-- dispatching a Segway investigation or a standard install.
create table public.tech_service_areas (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  tech_id          uuid not null references auth.users (id) on delete cascade,
  service_area_id  uuid not null references public.service_areas (id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint tech_service_areas_tech_id_service_area_id_key
    unique (tech_id, service_area_id)
);

create index tech_service_areas_organization_id_idx on public.tech_service_areas (organization_id);
create index tech_service_areas_tech_id_idx on public.tech_service_areas (tech_id);
create index tech_service_areas_service_area_id_idx on public.tech_service_areas (service_area_id);

alter table public.tech_service_areas enable row level security;

-- Org admins get full read/write. A tech may only select their own coverage
-- rows, scoped directly by tech_id (not through job_assignments — coverage
-- is not tied to any job).
create policy tech_service_areas_admin_all
  on public.tech_service_areas for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy tech_service_areas_select_own
  on public.tech_service_areas for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. §4 Segway investigation dispatch
-- ---------------------------------------------------------------------------

-- Distinguishes an investigation-only dispatch from a normal install dispatch
-- on the same job_assignments row, so the existing RLS surface (job_photos,
-- job_notes, checklist_instances) extends automatically through the existing
-- job_assignments exists-checks rather than needing a new dispatch table.
alter table public.job_assignments
  add column kind text not null default 'installer'
  check (kind in ('installer', 'investigator'));

-- Widen job_photos_kind_check to allow a Segway investigator to capture
-- investigation photos, same idiom as prior source-check widenings.
alter table public.job_photos drop constraint job_photos_kind_check;
alter table public.job_photos add constraint job_photos_kind_check
  check (kind in ('before', 'after', 'receipt', 'damage', 'investigation'));

-- One evolving row per job capturing a Segway investigator's guided-form
-- findings ahead of a complex install: Ingress/Logistics/Parking notes and a
-- State assessment. submitted_at stays null while the tech is still filling
-- it in and is set once they mark the investigation complete.
create table public.job_investigations (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  job_id             uuid not null references public.jobs (id) on delete cascade,
  tech_id            uuid not null references auth.users (id) on delete restrict,
  ingress_notes      text,
  logistics_notes    text,
  parking_notes      text,
  state_assessment   text,
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index job_investigations_organization_id_idx on public.job_investigations (organization_id);
create index job_investigations_job_id_idx on public.job_investigations (job_id);
create index job_investigations_tech_id_idx on public.job_investigations (tech_id);

alter table public.job_investigations enable row level security;

-- Org admins get full read/write within their own organization.
create policy job_investigations_admin_all
  on public.job_investigations for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- A tech may select/insert/update job_investigations rows only for jobs they
-- are assigned to as an investigator, resolved through job_assignments (same
-- exists-check idiom as job_photos_insert_tech in 0007). Unlike the
-- insert-only patterns elsewhere (checklist_instances, job_photos,
-- job_notes), this is one evolving row rather than an append-only log, so a
-- real _update_tech policy is required (deliberate deviation, per plan §4)
-- to let the tech keep refining the same row across the visit.
create policy job_investigations_select_tech
  on public.job_investigations for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
        and ja.kind = 'investigator'
    )
  );

create policy job_investigations_insert_tech
  on public.job_investigations for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
        and ja.kind = 'investigator'
    )
  );

create policy job_investigations_update_tech
  on public.job_investigations for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
        and ja.kind = 'investigator'
    )
  )
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
        and ja.kind = 'investigator'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. §5 Progressive punch list
-- ---------------------------------------------------------------------------

-- A shared working document a customer, a Segway investigator, or an admin
-- can add lines to over the life of a job — not tech-gated like other field
-- tables, since anyone on the job may need to append an item as the scope
-- firms up.
create table public.job_punch_list_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  source          text not null,
  description     text not null,
  created_at      timestamptz not null default now(),
  constraint job_punch_list_items_source_check
    check (source in ('customer', 'segway', 'admin_refinement'))
);

create index job_punch_list_items_organization_id_idx on public.job_punch_list_items (organization_id);
create index job_punch_list_items_job_id_idx on public.job_punch_list_items (job_id);

alter table public.job_punch_list_items enable row level security;

-- Any authenticated org member may read/write punch-list items for their own
-- organization's jobs — this is collaborative job-detail data (same shape as
-- job_materials_org_all in 0015), not a tech-gated or admin-only surface.
create policy job_punch_list_items_org_all
  on public.job_punch_list_items for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- Standard jobs skip Segway/punch list entirely; house_age_years is an
-- optional input to that classification path. Nullable, zero behavior
-- change until populated.
alter table public.jobs add column house_age_years integer;

-- ---------------------------------------------------------------------------
-- 4. §6 Standard vs. Engineered job classification — re-estimate flag
-- ---------------------------------------------------------------------------

-- Standard/Engineered/Unclassified classification itself is derived (not
-- persisted) at query time from price_sheet_rates, so no schema change is
-- needed for the classification. A re-estimate flag is raised as a new
-- job_notes.kind value instead of a new column.
alter table public.job_notes drop constraint job_notes_kind_check;
alter table public.job_notes add constraint job_notes_kind_check
  check (kind in ('decline_reason', 'quality_notes', 'dispute', 'admin_correction', 're_estimate_flag'));

-- ---------------------------------------------------------------------------
-- 5. §7 Material costs & subcontracting schedule
-- ---------------------------------------------------------------------------

-- Admin-only 1:1 sibling to the permissive job_materials (0015): tracks the
-- actual cost of each material line, kept separate so techs (who can read/
-- write job_materials freely) never see or edit cost data.
create table public.job_material_costs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  job_material_id uuid references public.job_materials (id) on delete set null,
  unit_cost       numeric not null default 0,
  quantity        numeric not null default 1,
  created_at      timestamptz not null default now()
);

create index job_material_costs_organization_id_idx on public.job_material_costs (organization_id);
create index job_material_costs_job_id_idx on public.job_material_costs (job_id);
create index job_material_costs_job_material_id_idx on public.job_material_costs (job_material_id);

alter table public.job_material_costs enable row level security;

create policy job_material_costs_admin_all
  on public.job_material_costs for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- Catalog of per-service subcontractor rates. Per-job subcontractor
-- assignment is explicitly out of scope for this change (plan §7); this is
-- rate-schedule data only.
create table public.subcontractor_services (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  rate_basis      text not null,
  rate            numeric not null,
  created_at      timestamptz not null default now(),
  constraint subcontractor_services_rate_basis_check
    check (rate_basis in ('per_job', 'per_hour', 'flat')),
  constraint subcontractor_services_organization_id_service_id_key
    unique (organization_id, service_id)
);

create index subcontractor_services_organization_id_idx on public.subcontractor_services (organization_id);
create index subcontractor_services_service_id_idx on public.subcontractor_services (service_id);

alter table public.subcontractor_services enable row level security;

create policy subcontractor_services_admin_all
  on public.subcontractor_services for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- ---------------------------------------------------------------------------
-- 6. §8 Customer-facing estimate document
-- ---------------------------------------------------------------------------

-- History of generated estimate documents. Generation is client-side
-- (expo-print / expo-sharing, no server pipeline), so this is a record of
-- each generation event rather than a stored file; storage_path stays
-- nullable for a future server-persisted copy, mirroring job_photos'
-- storage_path pattern without requiring one today.
create table public.estimate_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  generated_at    timestamptz not null default now(),
  storage_path    text,
  created_at      timestamptz not null default now()
);

create index estimate_documents_organization_id_idx on public.estimate_documents (organization_id);
create index estimate_documents_job_id_idx on public.estimate_documents (job_id);

alter table public.estimate_documents enable row level security;

create policy estimate_documents_admin_all
  on public.estimate_documents for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
