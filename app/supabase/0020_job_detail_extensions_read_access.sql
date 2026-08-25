-- Jobcore — Workstream I-3: additive org-wide read access for job detail
-- extensions (photos, notes, payments).
-- Apply after 0017. Postgres RLS ORs multiple permissive SELECT policies
-- together, so these are purely additive read access on top of the existing
-- admin/assigned-tech policies on these tables — no existing policy is
-- dropped or modified.

create policy job_photos_select_org
  on public.job_photos for select
  using (organization_id = public.current_org_id());

create policy job_notes_select_org
  on public.job_notes for select
  using (organization_id = public.current_org_id());

create policy payments_select_org
  on public.payments for select
  using (organization_id = public.current_org_id());
