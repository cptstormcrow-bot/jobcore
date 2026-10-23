-- Jobcore - migration 0099: job-photos storage UPDATE policy
--
-- Storage upload with upsert:true over an existing path (used by photo note
-- edits and before-photo retake) needs an UPDATE policy on storage.objects.
-- Migration 0078 granted only select/insert/delete on the job-photos bucket,
-- so those overwrites were rejected. This adds the missing update policy,
-- scoped to the bucket only (same as 0078). Idempotent; safe to re-run.

begin;

drop policy if exists job_photos_objects_update on storage.objects;
create policy job_photos_objects_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'job-photos')
  with check (bucket_id = 'job-photos');

commit;
