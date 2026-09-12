-- Jobcore — RLS defect fixes (hosted suite findings: 0004 AC-7, 0008 AC-8.2,
-- 0010 AC-RV-2)
-- Apply after 0012_marketing.sql on an already-migrated database.
-- Idempotent: safe to run standalone, more than once, without replaying
-- 0001..0012. Supersedes jobs_select_org / jobs_update_org (originally
-- 0004_scheduling.sql) and reviews_insert_anon (originally
-- 0010_payment_review.sql); those source files have also been updated in
-- place so local source-of-truth matches production going forward. Item 4
-- (0012 AC-12.1c) is a test-file-only fix and has no counterpart here.

-- ---------------------------------------------------------------------------
-- 1. jobs_select_org — AC-7 fix
-- ---------------------------------------------------------------------------
drop policy if exists jobs_select_org on public.jobs;
create policy jobs_select_org on public.jobs
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and public.is_org_sales_or_above()
  );

-- ---------------------------------------------------------------------------
-- 2. jobs_update_org — AC-8.2 fix
-- ---------------------------------------------------------------------------
drop policy if exists jobs_update_org on public.jobs;
create policy jobs_update_org on public.jobs
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- ---------------------------------------------------------------------------
-- 3. reviews_insert_anon — AC-RV-2 fix
-- ---------------------------------------------------------------------------
create or replace function public.job_exists_in_org(p_job_id uuid, p_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id and organization_id = p_organization_id
  );
$$;

revoke all on function public.job_exists_in_org(uuid, uuid) from public;
grant execute on function public.job_exists_in_org(uuid, uuid) to anon, authenticated;

drop policy if exists reviews_insert_anon on public.reviews;
create policy reviews_insert_anon
  on public.reviews for insert
  to anon
  with check (public.job_exists_in_org(reviews.job_id, reviews.organization_id));
