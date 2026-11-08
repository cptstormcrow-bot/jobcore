-- 0133: any tech assigned to a job (investigator OR installer) may read, create and update that
-- job's Prelim/investigation row (job_investigations). The 0050 tech policies only allowed
-- kind = 'investigator', so a tech assigned as 'installer' (e.g. Job #116) got
-- 'new row violates row-level security policy for table "job_investigations"' and the change
-- stuck in the offline queue. Same org, own tech_id and an assignment on the job still required.
-- Additive widening, no data change. Restore the 0050 policies to re-tighten.

drop policy if exists job_investigations_select_tech on public.job_investigations;
drop policy if exists job_investigations_insert_tech on public.job_investigations;
drop policy if exists job_investigations_update_tech on public.job_investigations;

create policy job_investigations_select_tech
  on public.job_investigations for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_investigations_insert_tech
  on public.job_investigations for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1 from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy job_investigations_update_tech
  on public.job_investigations for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and exists (
      select 1 from public.job_assignments ja
      where ja.job_id = job_investigations.job_id
        and ja.tech_id = auth.uid()
    )
  );
