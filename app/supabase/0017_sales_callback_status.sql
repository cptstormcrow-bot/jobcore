-- Jobcore P6 — Workstream J: sales callback task done/not-done state.
-- Apply after 0016 (next free number before 0018_beta_test_jobs.sql).
--
-- A completed job with no row here, or a row with called_back_at is null,
-- is an open callback task (see modules/sales-marketing/src/data/ports.ts,
-- CallbackTaskRepository). Setting called_back_at clears it. Deliberately a
-- small targeted table, not a subsystem — same precedent as job_materials /
-- job_reference_links.

create table public.sales_callback_status (
  job_id          uuid primary key references public.jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  called_back_at  timestamptz,
  called_back_by  uuid references auth.users (id) on delete set null
);

create index sales_callback_status_organization_id_idx on public.sales_callback_status (organization_id);

alter table public.sales_callback_status enable row level security;

-- Same shape as reviews_admin_all / payments_admin_all (0010): org admins
-- get full read/write. Sales also needs read+write here to run the
-- callback-task tab (Workstream J is a sales-marketing screen), reusing
-- public.is_org_sales_or_above() — the same helper jobs_select_org uses to
-- scope admin-or-sales read access to jobs (0013_rls_fixes.sql).
create policy sales_callback_status_admin_all
  on public.sales_callback_status for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy sales_callback_status_sales_all
  on public.sales_callback_status for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());
