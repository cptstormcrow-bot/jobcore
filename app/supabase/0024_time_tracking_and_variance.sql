-- Jobcore — cost-accountability trail: estimated vs. actual time (§11a/§11b)
-- Apply after 0023.

-- ---------------------------------------------------------------------------
-- 1. §11a — estimated_minutes on price_sheet_rates
-- ---------------------------------------------------------------------------

-- Nullable, no default: adding this column is zero behavior change for every
-- existing rate row and every existing reader of price_sheet_rates. Only
-- newly-authored rates that opt in by setting a value feed the variance
-- calculation added in §11c/§11d (app-layer only, no schema change here).
alter table public.price_sheet_rates
  add column estimated_minutes integer;

-- ---------------------------------------------------------------------------
-- 2. §11b — job_time_entries (clock-in/clock-out event log)
-- ---------------------------------------------------------------------------

-- One row per clock-in. clock_out_at starts null (an "open" entry) and is
-- set once, on punch-out, by the same tech who opened it — see the
-- job_time_entries_update_own_open_entry policy below, which is the only
-- path a tech has to touch this row after insert. Actual worked minutes are
-- computed (non-persisted) from clock_in_at/clock_out_at at read time
-- (§11c, app layer), so this table never stores a derived duration that
-- could go stale.
create table public.job_time_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  tech_id         uuid not null references auth.users (id) on delete cascade,
  clock_in_at     timestamptz not null,
  clock_out_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index job_time_entries_organization_id_idx on public.job_time_entries (organization_id);
create index job_time_entries_job_id_idx on public.job_time_entries (job_id);
create index job_time_entries_tech_id_idx on public.job_time_entries (tech_id);

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.job_time_entries enable row level security;

-- job_time_entries: org admins get full read/write within their own
-- organization, including correcting an already-closed entry (a tech
-- cannot — see job_time_entries_update_own_open_entry below).
create policy job_time_entries_admin_all
  on public.job_time_entries for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- A tech may select only their own time entries, scoped to their org.
create policy job_time_entries_select_own
  on public.job_time_entries for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());

-- A tech may insert (clock in) only for jobs they are assigned to, resolved
-- through job_assignments, mirroring job_photos_insert_tech in
-- 0007_field_tech_tables.sql. tech_id must be their own uid.
create policy job_time_entries_insert_own
  on public.job_time_entries for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_time_entries.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- A tech may update ONLY their own entry, and only while it is still open
-- (clock_out_at is null) — this is the punch-out case. The using clause
-- checks the CURRENT row state, so once clock_out_at is set the row falls
-- out of this policy's reach for that tech; closed-entry corrections are
-- admin-only via job_time_entries_admin_all.
create policy job_time_entries_update_own_open_entry
  on public.job_time_entries for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and clock_out_at is null
  )
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
  );
