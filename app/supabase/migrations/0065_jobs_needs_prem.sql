-- 0065: jobs.needs_prem_at + Prem queue RLS + job_assignments write hardening + backfill
-- Held uncommitted until GATE M. Do not run against the hosted DB from this migration
-- file directly; the push happens at GATE M only.

alter table public.jobs add column if not exists needs_prem_at timestamptz;
create index if not exists jobs_needs_prem_idx
  on public.jobs (organization_id, needs_prem_at) where needs_prem_at is not null;

-- Dedupe: keep each job's most recent investigator row before the partial unique index (Jeff 2026-09-23).
delete from public.job_assignments a
using public.job_assignments b
where a.job_id = b.job_id
  and a.kind = 'investigator' and b.kind = 'investigator'
  and (a.assigned_at, a.id) < (b.assigned_at, b.id);

create unique index if not exists job_assignments_one_investigator_per_job
  on public.job_assignments (job_id) where kind = 'investigator';

drop policy if exists jobs_select_tech_prem_queue on public.jobs;
create policy jobs_select_tech_prem_queue on public.jobs
  for select to authenticated
  using (organization_id = public.current_org_id()
    and needs_prem_at is not null
    and not exists (select 1 from public.job_assignments ja
                    where ja.job_id = jobs.id and ja.kind = 'investigator'));

drop policy if exists job_assignments_insert_tech_prem_claim on public.job_assignments;
create policy job_assignments_insert_tech_prem_claim on public.job_assignments
  for insert to authenticated
  with check (organization_id = public.current_org_id()
    and tech_id = auth.uid() and kind = 'investigator'
    and exists (select 1 from public.jobs j
                where j.id = job_assignments.job_id
                  and j.organization_id = public.current_org_id()
                  and j.needs_prem_at is not null));

-- Hardening: the three existing org-wide job_assignments write policies are narrowed
-- to sales-or-above, matching jobs_update_org's precedent (0013_rls_fixes.sql).
-- job_assignments_select_org is left untouched (read stays org-wide).
drop policy if exists job_assignments_insert_org on public.job_assignments;
create policy job_assignments_insert_org on public.job_assignments
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

drop policy if exists job_assignments_update_org on public.job_assignments;
create policy job_assignments_update_org on public.job_assignments
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

drop policy if exists job_assignments_delete_org on public.job_assignments;
create policy job_assignments_delete_org on public.job_assignments
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- Backfill: jobs without an approved estimate are flagged into the Prem queue.
-- Trigger disabled/re-enabled around the backfill because jobs_tech_update_whitelist_trg
-- (0008_field_tech_jobs_rls.sql) narrows tech-role column updates, not this admin-side
-- backfill, but per plan text it is bracketed defensively.
alter table public.jobs disable trigger jobs_tech_update_whitelist_trg;

update public.jobs j
set needs_prem_at = coalesce(j.created_at, now())
where j.needs_prem_at is null
  and not exists (
    select 1 from public.job_estimates e
    where e.job_id = j.id and e.status = 'approved'
  );

alter table public.jobs enable trigger jobs_tech_update_whitelist_trg;
