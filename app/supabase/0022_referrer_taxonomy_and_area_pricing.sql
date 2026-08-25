-- Jobcore - referrer taxonomy widen + service-area price adjustments
-- Apply after 0020_job_detail_extensions_read_access.

-- ---------------------------------------------------------------------------
-- 1. Referrer taxonomy - widen leads/jobs source CHECK constraints
-- ---------------------------------------------------------------------------

-- leads.source and jobs.source were left as free-form text with no CHECK
-- constraint through 0018. Costco, Ikea, and OWM are new referrer channels
-- the business now tracks explicitly, so a named CHECK constraint is added
-- here (not merely documented) to catch typos at write time going forward.
-- 'website' is grandfathered as the existing value seeded by seed.sql/
-- seed.hosted.sql and produced by the live intake adapter; drop-if-exists
-- keeps this migration idempotent whether or not a same-named constraint
-- from an earlier, undocumented pass already exists.
alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check
  check (source is null or source in ('website', 'costco', 'ikea', 'owm'));

alter table public.jobs
  drop constraint if exists jobs_source_check;

alter table public.jobs
  add constraint jobs_source_check
  check (source is null or source in ('website', 'costco', 'ikea', 'owm'));

-- ---------------------------------------------------------------------------
-- 2. Service-area price adjustments
-- ---------------------------------------------------------------------------

-- Per-(price_sheet, service_area) adjustment applied on top of the base
-- price_sheet_rates amount at estimate-computation time. Kept as its own
-- table rather than a column on price_sheet_rates because the adjustment is
-- keyed by service area, not by service - one row here can apply across
-- every rate on the sheet for that area. adjustment_type mirrors the
-- percent-vs-flat idiom used for rate_basis elsewhere in this codebase
-- (subcontractor_services.rate_basis, per the same plan) rather than
-- inventing a third representation.
create table public.price_sheet_area_adjustments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  price_sheet_id   uuid not null references public.price_sheets (id) on delete cascade,
  service_area_id  uuid not null references public.service_areas (id) on delete cascade,
  adjustment_type  text not null,
  adjustment_value numeric not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint price_sheet_area_adjustments_type_check
    check (adjustment_type in ('percent', 'flat')),
  constraint price_sheet_area_adjustments_sheet_area_key
    unique (price_sheet_id, service_area_id)
);

create index price_sheet_area_adjustments_organization_id_idx
  on public.price_sheet_area_adjustments (organization_id);
create index price_sheet_area_adjustments_price_sheet_id_idx
  on public.price_sheet_area_adjustments (price_sheet_id);
create index price_sheet_area_adjustments_service_area_id_idx
  on public.price_sheet_area_adjustments (service_area_id);

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.price_sheet_area_adjustments enable row level security;

-- price_sheet_area_adjustments - admin-only in every direction, mirroring
-- price_sheet_rates_admin_all (0005_money.sql): pricing configuration is
-- never tech-visible. Unlike price_sheet_rates this table does carry its
-- own organization_id, so the policy checks it directly rather than joining
-- up to price_sheets.
create policy price_sheet_area_adjustments_admin_all
  on public.price_sheet_area_adjustments for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
