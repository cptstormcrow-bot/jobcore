-- Jobcore — Workstream I: job detail extensions (materials + reference links).
-- Apply after 0014. Adds the two small targeted tables job_materials /
-- job_reference_links referenced as precedent by 0017_sales_callback_status.sql.
--
-- Same shape as public.sales_callback_status (0017): each row denormalizes
-- organization_id alongside job_id rather than joining through jobs.id at
-- query time, so RLS policies compare directly against
-- public.current_org_id() the same way jobs_select_org (0004/0013) does.

create table public.job_materials (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  description     text not null,
  quantity         numeric not null default 1,
  created_at      timestamptz not null default now()
);

create index job_materials_job_id_idx on public.job_materials (job_id);
create index job_materials_organization_id_idx on public.job_materials (organization_id);

alter table public.job_materials enable row level security;

-- Org admins get full read/write, matching sales_callback_status_admin_all.
create policy job_materials_admin_all
  on public.job_materials for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- Any authenticated org member may read/write job materials for their own
-- organization's jobs — this is collaborative job-detail data, not a
-- restricted sales/admin surface.
create policy job_materials_org_all
  on public.job_materials for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create table public.job_reference_links (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  url             text not null,
  label           text,
  created_at      timestamptz not null default now()
);

create index job_reference_links_job_id_idx on public.job_reference_links (job_id);
create index job_reference_links_organization_id_idx on public.job_reference_links (organization_id);

alter table public.job_reference_links enable row level security;

create policy job_reference_links_admin_all
  on public.job_reference_links for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_reference_links_org_all
  on public.job_reference_links for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
