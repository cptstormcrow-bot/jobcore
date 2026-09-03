-- One-off: create a single qualifying (status='qualified') test job so assignment can be tested live.
-- Safe to delete after use.

insert into public.customers (id, organization_id, name, phone, email, address, created_at)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000001',
   'ASSIGN TEST - safe to delete', '555-010-0901', 'assigntest@example.com',
   '123 Verify St, Carlsbad, CA 92008', now())
on conflict (id) do nothing;

insert into public.jobs (id, organization_id, status, customer_id, service_id, source, payer, attach_timing, requested_window, scheduled_start, scheduled_end, address, description, assigned_tech_id, en_route_at, in_progress_at, completed_at, created_at)
values
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000001',
   'qualified', '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000306',
   'website', 'customer', 'before_start', '2026-09-06 morning',
   null, null,
   '123 Verify St, Carlsbad, CA 92008', 'ASSIGN TEST - Plumbing job, safe to delete',
   null, null, null, null, now())
on conflict (id) do nothing;
