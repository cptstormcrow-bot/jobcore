-- Jobcore - migration 0078: job-photos storage bucket
--
-- Migration 0077 had already been applied remotely before its bucket SQL was
-- added, so the job-photos bucket was never created live. Supabase tracks
-- migration history by version, so edited applied files do not re-run.
-- This migration re-issues the bucket and its policies idempotently; it is
-- safe to re-run.

begin;

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
