-- Jobcore — Job Estimates (Wave 2)
-- DOCUMENTATION MIGRATION: job_estimates and job_estimate_line_items are
-- ALREADY LIVE on the hosted Supabase DB (created out-of-band, no prior
-- committed migration file). This file exists to document that already-live
-- schema in-repo, not to originate it. Every statement below is written
-- guarded/idempotent (`create table if not exists`, `add column if not
-- exists`, `drop policy if exists` before `create policy`) so it is a safe
-- no-op when run against the hosted DB, and still produces the correct
-- schema on a fresh/local DB.
--
-- Column/shape evidence sources (Rule 20 — no invented columns):
--   - app/supabase/functions/estimate-resolve/index.ts (public resolver —
--     reads job_estimates/job_estimate_line_items/jobs/organizations/
--     customers; never selects internal_notes)
--   - app/modules/admin-finance/src/data/ports.ts (JobEstimate,
--     JobEstimateInput, JobEstimateLineItem, JobEstimateLineItemDraft,
--     EstimateStatus, EstimateLineItemKind)
--   - app/apps/mobile/src/lib/admin-finance-repos.ts (toJobEstimate /
--     toJobEstimateLineItem row shapes, upsertForJob's onConflict: 'job_id'
--     — confirming job_estimates.job_id is the primary key, one estimate
--     row per job, not a separate uuid id)
--   - app/apps/mobile/src/lib/field-tech-repos.ts (tech-side read/submit
--     usage, same shapes)
--
-- Apply after 0004_scheduling (jobs), 0022 (RLS helper pattern reused
-- below).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One estimate per job — job_id is the primary key (confirmed by the
-- application's upsert onConflict: 'job_id'), not a separate uuid id column.
create table if not exists public.job_estimates (
  job_id           uuid primary key references public.jobs (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  status           text not null default 'draft',
  summary          text,
  materials_notes  text,
  labor_notes      text,
  materials_cost   numeric(10,2) not null default 0,
  labor_cost       numeric(10,2) not null default 0,
  other_cost       numeric(10,2) not null default 0,
  total_cost       numeric(10,2) not null default 0,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  payment_terms    text,
  deposit_amount   numeric(10,2),
  customer_notes   text,
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  constraint job_estimates_status_check
    check (status in ('draft', 'submitted', 'approved', 'rejected'))
);

create index if not exists job_estimates_organization_id_idx
  on public.job_estimates (organization_id);

-- Materials/labor/other line items making up an estimate. Ordered by kind
-- then created_at in application code (admin-finance-repos.ts listLineItems).
create table if not exists public.job_estimate_line_items (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.job_estimates (job_id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  kind             text not null,
  description      text not null,
  quantity         numeric not null,
  unit_cost        numeric(10,2) not null,
  line_total       numeric(10,2) not null,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  constraint job_estimate_line_items_kind_check
    check (kind in ('material', 'labor', 'other'))
);

create index if not exists job_estimate_line_items_job_id_idx
  on public.job_estimate_line_items (job_id);
create index if not exists job_estimate_line_items_organization_id_idx
  on public.job_estimate_line_items (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.job_estimates enable row level security;
alter table public.job_estimate_line_items enable row level security;

-- job_estimates / job_estimate_line_items: org-scoped, mirroring the
-- price_sheet_area_adjustments_admin_all template (0022) — full read/write
-- for any authenticated org member on their own organization's rows. Public/
-- anon access to an estimate happens exclusively through the
-- estimate-resolve Edge Function under the service role (bypasses RLS by
-- design), never through a client-side anon policy — same rationale as
-- handoff_tokens_admin_all in 0010_payment_review.sql.
drop policy if exists job_estimates_org_all on public.job_estimates;
create policy job_estimates_org_all
  on public.job_estimates for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists job_estimate_line_items_org_all on public.job_estimate_line_items;
create policy job_estimate_line_items_org_all
  on public.job_estimate_line_items for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
