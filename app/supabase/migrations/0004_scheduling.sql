-- Jobcore P2 — scheduling core
-- Apply after 0003.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

-- Mirrors Master Spec §10's job lifecycle. An enum (not a text CHECK) so
-- adding a status later is a deliberate ALTER TYPE migration rather than a
-- silently-edited constraint.
create type public.job_status as enum (
  'new',
  'qualified',
  'scheduled',
  'assigned',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'paid',
  'closed',
  'declined',
  'needs_reschedule',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  address         text,
  created_at      timestamptz not null default now()
);

create index customers_organization_id_idx on public.customers (organization_id);

create table public.services (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);

create index services_organization_id_idx on public.services (organization_id);

create table public.service_areas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);

create index service_areas_organization_id_idx on public.service_areas (organization_id);

-- Mirrors the website's nine intake columns exactly (source_form, name, phone,
-- email, service, preferred_date, preferred_time, address, project_details)
-- so the future intake adapter is a straight copy with no lossy translation.
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  source_form      text,
  name             text not null,
  phone            text,
  email            text,
  service          text,
  preferred_date   date,
  preferred_time   text,
  address          text,
  project_details  text,
  source           text,
  payer            text,
  attach_timing    text,
  qualified_at     timestamptz,
  converted_job_id uuid,
  created_at       timestamptz not null default now()
);

create index leads_organization_id_idx on public.leads (organization_id);

-- requested_window (what the customer asked for) stays separate from
-- scheduled_start/scheduled_end (the business commitment). Collapsing them
-- destroys slot-hit reporting. Master Spec §6.3.
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  status           public.job_status not null default 'new',
  customer_id      uuid references public.customers (id) on delete set null,
  service_id       uuid references public.services (id) on delete set null,
  source           text,
  payer            text,
  attach_timing    text,
  requested_window text,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  address          text,
  description      text,
  assigned_tech_id uuid references auth.users (id) on delete set null,
  en_route_at      timestamptz,
  in_progress_at   timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index jobs_organization_id_idx on public.jobs (organization_id);
create index jobs_assigned_tech_id_idx on public.jobs (assigned_tech_id);
create index jobs_scheduled_start_idx on public.jobs (scheduled_start);
create index jobs_customer_id_idx on public.jobs (customer_id);

-- Added post-jobs so leads can point at the job it converted into; jobs did
-- not exist yet when the leads table above was created.
alter table public.leads
  add constraint leads_converted_job_id_fkey
  foreign key (converted_job_id) references public.jobs (id) on delete set null;

create table public.job_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  tech_id         uuid not null references auth.users (id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index job_assignments_organization_id_idx on public.job_assignments (organization_id);
create index job_assignments_job_id_idx on public.job_assignments (job_id);
create index job_assignments_tech_id_idx on public.job_assignments (tech_id);

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.service_areas enable row level security;
alter table public.leads enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;

-- customers: org staff have full read/write within their own organization.
create policy customers_select_org on public.customers
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy customers_insert_org on public.customers
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy customers_update_org on public.customers
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy customers_delete_org on public.customers
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- services: org staff have full read/write within their own organization.
create policy services_select_org on public.services
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy services_insert_org on public.services
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy services_update_org on public.services
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy services_delete_org on public.services
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- service_areas: org staff have full read/write within their own organization.
create policy service_areas_select_org on public.service_areas
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy service_areas_insert_org on public.service_areas
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy service_areas_update_org on public.service_areas
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy service_areas_delete_org on public.service_areas
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- leads: org staff have full read/write within their own organization. Techs
-- have no policy on leads at all (no select/insert/update/delete) — the
-- absence of any tech-scoped policy IS the deny: a tech session sees zero
-- rows and cannot write any.
create policy leads_select_org on public.leads
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy leads_insert_org on public.leads
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy leads_update_org on public.leads
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy leads_delete_org on public.leads
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- jobs: org admin/office staff (owner, admin, sales) have full read within
-- their own organization. Deliberately excludes tech — a tech's read
-- visibility is scoped through jobs_select_tech below (assigned jobs only);
-- if this predicate is loosened to include tech, jobs_select_tech becomes a
-- no-op, since Postgres OR's together multiple permissive policies on the
-- same table/command/role. Expressed as an inline role check rather than
-- public.is_org_sales_or_above() because that helper isn't defined until
-- 0012_marketing.sql, later than this file — see 0013_rls_fixes.sql for the
-- helper-based production patch.
create policy jobs_select_org on public.jobs
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'admin', 'sales')
    )
  );

-- jobs: a tech sees only jobs they are assigned to, resolved through
-- job_assignments, still bounded to their own organization.
create policy jobs_select_tech on public.jobs
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = jobs.id
        and ja.tech_id = auth.uid()
    )
  );

create policy jobs_insert_org on public.jobs
  for insert to authenticated
  with check (organization_id = public.current_org_id());

-- jobs: admin-only update within the org. Deliberately narrower than
-- jobs_select_org — sales may view all org jobs but has no legitimate
-- write path here; tech writes go exclusively through jobs_update_tech
-- (0008), which is column-whitelisted by jobs_tech_update_whitelist_trg.
-- Was previously unrestricted to any authenticated org member, which let a
-- tech's UPDATE on an unassigned job reach the whitelist trigger instead of
-- being excluded by RLS (AC-8.2). Inline role check for the same
-- forward-reference reason as jobs_select_org above.
create policy jobs_update_org on public.jobs
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'admin')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- jobs: techs have no insert/update/delete policy — the absence denies all
-- writes; a tech's status transitions (en_route/in_progress/completed) go
-- through an org-staff-facing update or a security-definer function, not a
-- direct tech-owned update policy, so no column-level revoke is needed here.
-- If a future slice needs to restrict which columns org staff may touch on a
-- given update, that belongs in a `before update` trigger, not a column
-- revoke, since every client authenticates as the same `authenticated` role.

create policy jobs_delete_org on public.jobs
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- job_assignments: org staff have full read/write within their own
-- organization. Techs have no policy here either — absence denies techs any
-- direct visibility into the assignment table; their job access is granted
-- solely via jobs_select_tech above.
create policy job_assignments_select_org on public.job_assignments
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy job_assignments_insert_org on public.job_assignments
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy job_assignments_update_org on public.job_assignments
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy job_assignments_delete_org on public.job_assignments
  for delete to authenticated
  using (organization_id = public.current_org_id());
