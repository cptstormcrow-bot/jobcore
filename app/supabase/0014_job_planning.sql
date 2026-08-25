-- Jobcore — job planning details and reference photos
-- Apply after 0013_rls_fixes.sql.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One row per job holding free-text planning content (model numbers, parts
-- list, measurements, general instructions) an admin or tech records ahead
-- of / during a job. job_id is the primary key since a job has at most one
-- planning-details row; updated_at/updated_by track the last editor.
create table public.job_planning_details (
  job_id          uuid primary key references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  model_numbers   text,
  parts_list      text,
  measurements    text,
  instructions    text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null
);

create index job_planning_details_organization_id_idx on public.job_planning_details (organization_id);

-- A reference photo attached to a job's planning details (e.g. a site photo,
-- a model plate, or a measurement sketch). storage_path points into Supabase
-- Storage; the row never holds the image bytes.
create table public.job_planning_photos (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path    text not null,
  caption         text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null
);

create index job_planning_photos_organization_id_idx on public.job_planning_photos (organization_id);
create index job_planning_photos_job_id_idx on public.job_planning_photos (job_id);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.job_planning_details enable row level security;
alter table public.job_planning_photos enable row level security;

-- job_planning_details: org admins get full read/write within their own
-- organization. A tech may select/insert/update planning details only for
-- jobs they are assigned to, resolved through job_assignments, mirroring
-- the job_photos policies in 0007_field_tech_tables.sql / 0008.
create policy job_planning_details_admin_all
  on public.job_planning_details for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_planning_details_select_tech
  on public.job_planning_details for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_details.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_planning_details_insert_tech
  on public.job_planning_details for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_details.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_planning_details_update_tech
  on public.job_planning_details for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_details.job_id
        and ja.tech_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_details.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- job_planning_photos: org admins get full read/write within their own
-- organization. A tech may select/insert photos only for jobs they are
-- assigned to, resolved through job_assignments.
create policy job_planning_photos_admin_all
  on public.job_planning_photos for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_planning_photos_select_tech
  on public.job_planning_photos for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_photos.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_planning_photos_insert_tech
  on public.job_planning_photos for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_photos.job_id
        and ja.tech_id = auth.uid()
    )
  );
