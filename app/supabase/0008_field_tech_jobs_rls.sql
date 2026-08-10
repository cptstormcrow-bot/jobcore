-- Jobcore P3+ — field tech job-status RLS
-- Apply after 0005.

-- ---------------------------------------------------------------------------
-- 1. jobs: tech UPDATE policy
-- ---------------------------------------------------------------------------

-- jobs: a tech may update only jobs they are assigned to, resolved through
-- job_assignments (same join shape as jobs_select_tech in 0004), still
-- bounded to their own organization. This grants the UPDATE privilege at the
-- row level; the jobs_tech_update_whitelist_trg trigger below narrows which
-- COLUMNS a tech-role update may touch.
create policy jobs_update_tech on public.jobs
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = jobs.id
        and ja.tech_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = jobs.id
        and ja.tech_id = auth.uid()
    )
  );

-- job_assignments already carries full read/write coverage for org staff, and
-- techs already have no direct policy on job_assignments (0004 comment,
-- section 3) — their assignment visibility is resolved solely through the
-- jobs table joins above. No parallel job_assignments policy is needed here.

-- ---------------------------------------------------------------------------
-- 2. jobs: tech column-whitelist trigger
-- ---------------------------------------------------------------------------

-- A tech-role update to jobs may touch only the day-of-service status
-- columns (status, en_route_at, in_progress_at, completed_at). Any other
-- column change originating from a non-admin caller is rejected, mirroring
-- the column-whitelist approach of commissions_immutable() in 0005: rather
-- than a column-level REVOKE (every client authenticates as the same
-- `authenticated` role per the 0004 comment, section 3), this is enforced as
-- a before-update trigger check.
--
-- public.is_org_admin() (defined in 0005) distinguishes the actor: an
-- owner/admin caller is NOT restricted by this trigger and may update any
-- column, matching jobs_update_org's unrestricted column set.
create or replace function public.jobs_tech_update_whitelist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_org_admin() then
    return new;
  end if;

  if new.id = old.id
     and new.organization_id = old.organization_id
     and new.customer_id = old.customer_id
     and new.service_id = old.service_id
     and new.source = old.source
     and new.payer = old.payer
     and new.attach_timing = old.attach_timing
     and new.requested_window = old.requested_window
     and new.scheduled_start = old.scheduled_start
     and new.scheduled_end = old.scheduled_end
     and new.address = old.address
     and new.description = old.description
     and new.assigned_tech_id is not distinct from old.assigned_tech_id
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'jobs: tech update may only change status, en_route_at, in_progress_at, completed_at (id=%)', old.id;
end;
$$;

create trigger jobs_tech_update_whitelist_trg
  before update on public.jobs
  for each row execute function public.jobs_tech_update_whitelist();

-- ---------------------------------------------------------------------------
-- 3. commissions: tech self-select policy
-- ---------------------------------------------------------------------------

-- commissions: a tech may select only their own commission rows within their
-- own organization. This is additive to commissions_admin_all in 0005 (which
-- remains admin-only for insert/update/delete); user_id is the earner column
-- established by the commissions table definition in 0005.
create policy commissions_select_own
  on public.commissions for select
  to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid());
