-- Jobcore - migration 0077: Prem checklist fields
--
-- Adds to public.job_investigations:
--   * room_work         - per-room work list (jsonb array)
--   * measurements      - free-text measurements
--   * tech_instructions - free-text instructions for the tech
--   * materials_arrived - yes/no; null = unanswered
--
-- Adds a tech DELETE policy on public.job_planning_photos (0033 gave techs
-- only select/insert) so an assigned tech can remove photos on their jobs.
--
-- Idempotent: safe to re-run.

begin;

alter table public.job_investigations
  add column if not exists room_work jsonb not null default '[]'::jsonb,
  add column if not exists measurements text,
  add column if not exists tech_instructions text,
  add column if not exists materials_arrived boolean;

comment on column public.job_investigations.room_work is
  'Per-room work list captured on the Prem checklist (jsonb array).';
comment on column public.job_investigations.measurements is
  'Free-text measurements captured on the Prem checklist.';
comment on column public.job_investigations.tech_instructions is
  'Free-text instructions for the tech captured on the Prem checklist.';
comment on column public.job_investigations.materials_arrived is
  'Whether materials have arrived; null = unanswered.';

drop policy if exists job_planning_photos_delete_tech on public.job_planning_photos;
create policy job_planning_photos_delete_tech
  on public.job_planning_photos for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_planning_photos.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- job-photos storage bucket (private, 50 MiB cap) + authenticated policies.
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-photos', 'job-photos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists job_photos_objects_select on storage.objects;
create policy job_photos_objects_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'job-photos');

drop policy if exists job_photos_objects_insert on storage.objects;
create policy job_photos_objects_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'job-photos');

drop policy if exists job_photos_objects_delete on storage.objects;
create policy job_photos_objects_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-photos');

commit;
