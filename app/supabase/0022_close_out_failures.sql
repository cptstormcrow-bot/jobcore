-- Jobcore - close-out failure tracking
-- Apply after 0021.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

-- Stage of the close-out pipeline at which a job's close-out attempt failed.
-- An enum (not a text CHECK) so adding a stage later is a deliberate ALTER
-- TYPE migration rather than a silently-edited constraint.
create type public.close_out_failure_stage as enum (
  'not_ready',
  'blocked',
  'no_price_sheet',
  'commission_calc',
  'write'
);

-- Lifecycle of a close-out failure record. An enum (not a text CHECK) so
-- adding a status later is a deliberate ALTER TYPE migration rather than a
-- silently-edited constraint.
create type public.close_out_failure_status as enum (
  'open',
  'retrying',
  'resolved_retry',
  'resolved_manual',
  'ignored'
);

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- One row per close-out attempt failure for a job. A job may accumulate a
-- history of failure rows over time, but the partial unique index below
-- allows at most one open/retrying row per job at any moment, so retries
-- update the existing open record instead of piling up duplicates.
create table public.close_out_failures (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  job_id            uuid not null references public.jobs (id) on delete cascade,
  stage             public.close_out_failure_stage not null,
  reason            text not null,
  status            public.close_out_failure_status not null default 'open',
  attempts          integer not null default 0,
  last_attempted_at timestamptz,
  resolved_by       uuid references public.profiles (id),
  resolved_at       timestamptz,
  resolution_note   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index close_out_failures_organization_id_idx on public.close_out_failures (organization_id);
create index close_out_failures_job_id_idx on public.close_out_failures (job_id);
create index close_out_failures_status_idx on public.close_out_failures (status);

-- Only one open/retrying failure per job at a time.
create unique index close_out_failures_one_open_per_job_idx
  on public.close_out_failures (job_id)
  where status in ('open', 'retrying');

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.close_out_failures enable row level security;

-- select/insert are org-scoped, mirroring the calendar_events pattern: any
-- authenticated member of the organization may see and create rows.
create policy close_out_failures_select_org
  on public.close_out_failures for select
  to authenticated
  using (organization_id = public.current_org_id());

create policy close_out_failures_insert_org
  on public.close_out_failures for insert
  to authenticated
  with check (organization_id = public.current_org_id());

-- update is admin-only, matching the is_org_admin() gate used elsewhere
-- (e.g. reimbursements approval columns): resolving or retrying a failure
-- is an admin action.
create policy close_out_failures_update_admin
  on public.close_out_failures for update
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
