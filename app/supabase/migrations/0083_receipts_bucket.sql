-- Jobcore - migration 0083: receipts storage bucket (reimbursement receipts)
--
-- Private bucket for reimbursement receipt images. Unlike job-photos (0078),
-- the policies here are NOT bucket-wide: every policy is scoped by object path.
--
-- Path contract: <org_id>/<user_id>/<reimbursement_id>.<ext>
--   (storage.foldername(name))[1] = organization id
--   (storage.foldername(name))[2] = submitting user's auth.uid()
--
-- A user may upload only under their own <org>/<uid>/ prefix. A user may read
-- or delete only their own receipts; org admins may read or delete any receipt
-- in their org. A colleague can never read another user's receipt. There is no
-- update policy: receipts are immutable once uploaded (a replacement is a new
-- object). The app-side upload (offline-ops/tech.ts reimbursement.create) must
-- write exactly this path. Idempotent; safe to re-run.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg','image/png','image/heic','image/heif','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_objects_insert on storage.objects;
create policy receipts_objects_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists receipts_objects_select on storage.objects;
create policy receipts_objects_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_org_admin()
    )
  );

drop policy if exists receipts_objects_delete on storage.objects;
create policy receipts_objects_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_org_admin()
    )
  );

commit;
