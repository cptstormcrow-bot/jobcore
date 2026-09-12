-- Jobcore — Employee Screen Edits2, Slice B: profile detail fields + tech
-- skills. Apply after 0030.

-- ---------------------------------------------------------------------------
-- 1. Employee profile detail fields
-- ---------------------------------------------------------------------------

-- Nullable, zero behavior change until populated. Status columns are
-- constrained to a fixed enum, same check-constraint idiom as
-- job_assignments.kind in 0023.
alter table public.profiles
  add column address text,
  add column drivers_license_number text,
  add column vehicle_status text
    check (vehicle_status in ('assigned', 'unassigned', 'in_maintenance')),
  add column tool_status text
    check (tool_status in ('issued', 'not_issued', 'needs_replacement'));

-- ---------------------------------------------------------------------------
-- 2. Tech skills
-- ---------------------------------------------------------------------------

-- Many-to-many: which skills a tech has. Mirrors tech_service_areas (0023)
-- as closely as possible — tech_id (not profile_id) references auth.users(id),
-- matching that table's naming convention exactly.
create table public.tech_skills (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  tech_id          uuid not null references auth.users (id) on delete cascade,
  skill            text not null
    check (skill in ('installation', 'service_repair', 'electrical', 'segway_investigation', 'estimating', 'customer_service')),
  created_at       timestamptz not null default now(),
  constraint tech_skills_tech_id_skill_key
    unique (tech_id, skill)
);

create index tech_skills_organization_id_idx on public.tech_skills (organization_id);
create index tech_skills_tech_id_idx on public.tech_skills (tech_id);

alter table public.tech_skills enable row level security;

-- Org admins get full read/write. A tech may only select their own skill
-- rows, scoped directly by tech_id — same shape as
-- tech_service_areas_admin_all / tech_service_areas_select_own in 0023.
create policy tech_skills_admin_all
  on public.tech_skills for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy tech_skills_select_own
  on public.tech_skills for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());
