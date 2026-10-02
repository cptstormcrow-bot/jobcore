-- Jobcore - migration 0032: service task pricing
-- Apply after 0049_referrer_taxonomy_and_area_pricing.
--
-- Adds:
--   1. service_tasks - per-service task catalog rows used by the price sheet
--      task-level pricing UI (Slice D), org-scoped like
--      price_sheet_area_adjustments rather than joined up through a parent.
--   2. price_sheet_area_adjustments.adjustment_target - narrows an existing
--      area adjustment to apply to materials, labor, or the total, instead
--      of always applying to the full line total.
--
-- All DDL here is guarded/idempotent (IF NOT EXISTS / drop-then-add for
-- named constraints) since this migration may run against a live DB that
-- already has some of these objects.

-- ---------------------------------------------------------------------------
-- 1. service_tasks
-- ---------------------------------------------------------------------------

create table if not exists public.service_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  service_id       uuid not null,
  name             text not null,
  created_at       timestamptz not null default now()
);

create index if not exists service_tasks_organization_id_idx
  on public.service_tasks (organization_id);
create index if not exists service_tasks_service_id_idx
  on public.service_tasks (service_id);

alter table public.service_tasks enable row level security;

-- service_tasks - admin-only in every direction, mirroring
-- price_sheet_area_adjustments_admin_all (0022): pricing configuration is
-- never tech-visible. Carries its own organization_id, so the policy checks
-- it directly rather than joining up to a parent table.
drop policy if exists service_tasks_admin_all on public.service_tasks;

create policy service_tasks_admin_all
  on public.service_tasks for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- ---------------------------------------------------------------------------
-- 2. price_sheet_area_adjustments.adjustment_target
-- ---------------------------------------------------------------------------

-- Guarded: on a fresh db reset this table is created later by 0049, so the
-- ALTER is skipped here and re-applied by migration 0074 below.
DO $guard$ BEGIN
  IF to_regclass('public.price_sheet_area_adjustments') IS NOT NULL THEN
    alter table public.price_sheet_area_adjustments
      add column if not exists adjustment_target text not null default 'total';

    alter table public.price_sheet_area_adjustments
      drop constraint if exists price_sheet_area_adjustments_target_check;

    alter table public.price_sheet_area_adjustments
      add constraint price_sheet_area_adjustments_target_check
      check (adjustment_target in ('materials', 'labor', 'total'));
  END IF;
END $guard$;
