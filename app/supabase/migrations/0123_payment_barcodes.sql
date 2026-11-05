-- Jobcore - migration 0123: payment barcodes (screen #0078 fullscreen QR).
-- The owner saves one QR image per service (PayPal, Venmo, Zelle) in Company Info
-- (Settings #0065). Techs show the chosen one fullscreen on #0078.
-- Path contract: <org_id>/<service>-<timestamp>.<ext>  ((storage.foldername(name))[1] = org id)
-- Any org member reads (techs need to show it); only org admins write or delete.
-- No update policy: a replacement is a new object and the column is repointed.
-- NOT applied live yet. Idempotent.

begin;

alter table public.company_info add column if not exists paypal_barcode_path text;
alter table public.company_info add column if not exists venmo_barcode_path text;
alter table public.company_info add column if not exists zelle_barcode_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-barcodes', 'payment-barcodes', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_barcodes_objects_select on storage.objects;
create policy payment_barcodes_objects_select
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-barcodes'
         and (storage.foldername(name))[1] = public.current_org_id()::text);

drop policy if exists payment_barcodes_objects_insert on storage.objects;
create policy payment_barcodes_objects_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-barcodes'
              and (storage.foldername(name))[1] = public.current_org_id()::text
              and public.is_org_admin());

drop policy if exists payment_barcodes_objects_delete on storage.objects;
create policy payment_barcodes_objects_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-barcodes'
         and (storage.foldername(name))[1] = public.current_org_id()::text
         and public.is_org_admin());

commit;
