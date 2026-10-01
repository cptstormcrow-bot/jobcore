-- Jobcore P1 — S3 · Development seed
-- Apply AFTER 0001_foundation.sql. See README.md for the full apply order.
--
-- DEPENDENCY: public.profiles.id references auth.users(id). This HOSTED variant
-- does not insert auth.users rows — the four users must already exist (created
-- through the Supabase Auth dashboard) and the real UUIDs below are already
-- substituted for the local-dev placeholder constants.
--
-- Fixed UUIDs, not gen_random_uuid(): the seed must be re-runnable and the
-- module/RLS test protocol in README.md refers to these users by id.

-- ---------------------------------------------------------------------------
-- 1. Organization
-- ---------------------------------------------------------------------------

insert into public.organizations (id, name, slug, enabled_modules)
values (
  '00000000-0000-4000-8000-000000000001',
  'SD Assembly Pros',
  'sd-assembly-pros',
  '{admin-finance,field-tech,sales-marketing,payment-review}'
)
on conflict (id) do nothing;
-- Section 2 (auth users) intentionally omitted: this is the HOSTED variant. The four
-- auth users are created through the Supabase Auth dashboard; the real UUIDs
-- below were substituted for the local-dev placeholder constants.

-- ---------------------------------------------------------------------------
-- 3. Profiles — one per role
-- ---------------------------------------------------------------------------
-- These four rows are the AC-4 fixture: the same org, four different roles, so
-- getEnabledModules(org, role) can be exercised across the whole role matrix
-- without changing any org-level data.

insert into public.profiles (id, organization_id, full_name, phone, role, active)
values
  ('09595a9b-12f3-46a7-845c-aae615f776c3', '00000000-0000-4000-8000-000000000001',
   'Dev Owner', '+16195550101', 'owner', true),
  ('a143fac2-4806-42ed-9283-b45275b6c53a', '00000000-0000-4000-8000-000000000001',
   'Dev Admin', '+16195550102', 'admin', true),
  ('d59e3bc7-691d-4ada-8959-e86f40c1e344', '00000000-0000-4000-8000-000000000001',
   'Dev Tech',  null,           'tech',  true),
  ('cff3db85-9535-45c7-ac36-3a78ac161a4b', '00000000-0000-4000-8000-000000000001',
   'Dev Sales', '+16195550104', 'sales', true)
on conflict (id) do nothing;

-- Dev Tech's phone is deliberately null — it is the fixture that exercises
-- `phone: string | null` in the frozen S1 Profile interface.

-- ---------------------------------------------------------------------------
-- 4. Services — the nine offerings from Master Spec §4
-- ---------------------------------------------------------------------------

insert into public.services (id, organization_id, name, created_at)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001',
   'Furniture Assembly',            now()),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001',
   'Outdoor Equipment',             now()),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001',
   'Fitness & Game Room',           now()),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001',
   'Home Theater & TV',             now()),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001',
   'Wall Hanging & Mounting',       now()),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000001',
   'Plumbing',                      now()),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000001',
   'Handyman',                      now()),
  ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000001',
   'Carpentry & Construction',      now()),
  ('00000000-0000-4000-8000-000000000309', '00000000-0000-4000-8000-000000000001',
   'Tile & Flooring',               now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Service areas — 31 San Diego County communities seeded (6 original
-- placeholder communities plus 25 additional communities appended below).
-- Additive and idempotent: on conflict (id) do nothing means re-running this
-- file against a live DB with the original 6 rows already applied only
-- inserts the 25 new rows.
-- ---------------------------------------------------------------------------

insert into public.service_areas (id, organization_id, name, created_at)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001',
   'La Jolla',     now()),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001',
   'Chula Vista',  now()),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001',
   'Poway',        now()),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001',
   'Encinitas',    now()),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000001',
   'Carlsbad',     now()),
  ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000001',
   'El Cajon',     now()),
  ('00000000-0000-4000-8000-000000000407', '00000000-0000-4000-8000-000000000001',
   'San Diego',    now()),
  ('00000000-0000-4000-8000-000000000408', '00000000-0000-4000-8000-000000000001',
   'Pacific Beach', now()),
  ('00000000-0000-4000-8000-000000000409', '00000000-0000-4000-8000-000000000001',
   'Rancho Bernardo', now()),
  ('00000000-0000-4000-8000-00000000040a', '00000000-0000-4000-8000-000000000001',
   'Carmel Valley', now()),
  ('00000000-0000-4000-8000-00000000040b', '00000000-0000-4000-8000-000000000001',
   'National City', now()),
  ('00000000-0000-4000-8000-00000000040c', '00000000-0000-4000-8000-000000000001',
   'Imperial Beach', now()),
  ('00000000-0000-4000-8000-00000000040d', '00000000-0000-4000-8000-000000000001',
   'Coronado',     now()),
  ('00000000-0000-4000-8000-00000000040e', '00000000-0000-4000-8000-000000000001',
   'La Mesa',      now()),
  ('00000000-0000-4000-8000-00000000040f', '00000000-0000-4000-8000-000000000001',
   'Santee',       now()),
  ('00000000-0000-4000-8000-000000000410', '00000000-0000-4000-8000-000000000001',
   'Lemon Grove',  now()),
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000001',
   'Del Mar',      now()),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000001',
   'Solana Beach', now()),
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000001',
   'Oceanside',    now()),
  ('00000000-0000-4000-8000-000000000414', '00000000-0000-4000-8000-000000000001',
   'Escondido',    now()),
  ('00000000-0000-4000-8000-000000000415', '00000000-0000-4000-8000-000000000001',
   'San Marcos',   now()),
  ('00000000-0000-4000-8000-000000000416', '00000000-0000-4000-8000-000000000001',
   'Vista',        now()),
  ('00000000-0000-4000-8000-000000000417', '00000000-0000-4000-8000-000000000001',
   'Ramona',       now()),
  ('00000000-0000-4000-8000-000000000418', '00000000-0000-4000-8000-000000000001',
   'Alpine',       now()),
  ('00000000-0000-4000-8000-000000000419', '00000000-0000-4000-8000-000000000001',
   'Lakeside',     now()),
  ('00000000-0000-4000-8000-00000000041a', '00000000-0000-4000-8000-000000000001',
   'Bonsall',      now()),
  ('00000000-0000-4000-8000-00000000041b', '00000000-0000-4000-8000-000000000001',
   'Spring Valley', now()),
  ('00000000-0000-4000-8000-00000000041c', '00000000-0000-4000-8000-000000000001',
   'Hillcrest',    now()),
  ('00000000-0000-4000-8000-00000000041d', '00000000-0000-4000-8000-000000000001',
   'North Park',   now()),
  ('00000000-0000-4000-8000-00000000041e', '00000000-0000-4000-8000-000000000001',
   'Mission Valley', now()),
  ('00000000-0000-4000-8000-00000000041f', '00000000-0000-4000-8000-000000000001',
   'Scripps Ranch', now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Customers
-- ---------------------------------------------------------------------------

insert into public.customers (id, organization_id, name, phone, email, address, created_at)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001',
   'Karen Whitfield', '+16195550201', 'karen.whitfield@example.com',
   '412 Prospect St, La Jolla, CA 92037', now()),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001',
   'Marcus Delgado',  '+16195550202', 'marcus.delgado@example.com',
   '88 Third Ave, Chula Vista, CA 91910', now()),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001',
   'Priya Anand',     '+16195550203', 'priya.anand@example.com',
   '2210 Community Rd, Poway, CA 92064', now()),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001',
   'Trevor Nakamura', '+16195550204', 'trevor.nakamura@example.com',
   '505 Vulcan Ave, Encinitas, CA 92024', now()),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001',
   'Sofia Reyes',      '+16195550205', 'sofia.reyes@example.com',
   '1901 State St, Carlsbad, CA 92008', now()),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001',
   'Ben Castellano',  '+16195550206', 'ben.castellano@example.com',
   '340 Main St, El Cajon, CA 92020', now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Leads — two intake shapes per Master Spec §4 (hero quick form vs.
-- booking form)
-- ---------------------------------------------------------------------------

insert into public.leads (
  id, organization_id, source_form, name, phone, email, service,
  preferred_date, preferred_time, address, project_details, source, payer,
  attach_timing, qualified_at, converted_job_id, created_at
)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001',
   'hero_quick', 'Dana Whitfield', '+16195550301', null, 'Furniture Assembly',
   null, null, null, null, 'website', null, null, null, null, now()),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001',
   'booking', 'Oscar Mendez', '+16195550302', 'oscar.mendez@example.com', 'Plumbing',
   '2026-08-04', 'morning', '77 Grand Ave, Poway, CA 92064',
   'Kitchen faucet replacement', 'website', 'customer', 'before_start', null, null, now()),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001',
   'booking', 'Linda Choi', '+16195550303', 'linda.choi@example.com', 'Handyman',
   '2026-08-06', 'afternoon', '19 Ash St, Encinitas, CA 92024',
   'Drywall patch and paint touch-up', 'website', 'customer', 'before_start', now(), null, now()),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000001',
   'booking', 'Karen Whitfield', '+16195550201', 'karen.whitfield@example.com',
   'Furniture Assembly', '2026-07-30', 'morning', '412 Prospect St, La Jolla, CA 92037',
   'Assemble two wardrobe units', 'website', 'customer', 'before_start', now(),
   null, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Jobs — spans a spread of job_status values from the 0004 enum;
-- requested_window kept separate from scheduled_start/scheduled_end per
-- Master Spec §6.3.
-- ---------------------------------------------------------------------------

insert into public.jobs (
  id, organization_id, status, customer_id, service_id, source, payer,
  attach_timing, requested_window, scheduled_start, scheduled_end, address,
  description, assigned_tech_id, en_route_at, in_progress_at, completed_at,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001',
   'completed', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301',
   'website', 'customer', 'before_start', '2026-07-30 morning',
   '2026-07-30 09:00:00+00', '2026-07-30 11:00:00+00',
   '412 Prospect St, La Jolla, CA 92037', 'Assemble two wardrobe units',
   'd59e3bc7-691d-4ada-8959-e86f40c1e344', '2026-07-30 08:45:00+00',
   '2026-07-30 09:05:00+00', '2026-07-30 10:55:00+00', now()),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001',
   'scheduled', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000306',
   'website', 'customer', 'before_start', '2026-08-04 morning',
   '2026-08-04 09:00:00+00', '2026-08-04 10:30:00+00',
   '88 Third Ave, Chula Vista, CA 91910', 'Kitchen faucet replacement',
   'd59e3bc7-691d-4ada-8959-e86f40c1e344', null, null, null, now()),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001',
   'new', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000307',
   'website', 'customer', 'before_start', '2026-08-06 afternoon',
   null, null, '2210 Community Rd, Poway, CA 92064',
   'Drywall patch and paint touch-up', null, null, null, null, now()),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001',
   'in_progress', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000309',
   'website', 'customer', 'before_start', '2026-07-28 afternoon',
   '2026-07-28 13:00:00+00', '2026-07-28 16:00:00+00',
   '505 Vulcan Ave, Encinitas, CA 92024', 'Re-grout kitchen tile floor',
   'd59e3bc7-691d-4ada-8959-e86f40c1e344', '2026-07-28 12:50:00+00',
   '2026-07-28 13:10:00+00', null, now()),
  ('00000000-0000-4000-8000-000000000605', '00000000-0000-4000-8000-000000000001',
   'cancelled', '00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000302',
   'website', 'customer', 'before_start', '2026-08-01 morning',
   null, null, '1901 State St, Carlsbad, CA 92008',
   'Assemble patio storage shed', null, null, null, null, now())
on conflict (id) do nothing;

-- Deferred link: lead ...0504 converted into job ...0601. Applied here, after section 8,
-- because leads.converted_job_id references jobs(id) -- the foreign key cannot be satisfied
-- while section 7 runs. Re-runnable: the `is null` guard makes a second run a no-op.
update public.leads
   set converted_job_id = '00000000-0000-4000-8000-000000000601'
 where id = '00000000-0000-4000-8000-000000000504'
   and converted_job_id is null;

-- ---------------------------------------------------------------------------
-- 9. Job assignments
-- ---------------------------------------------------------------------------

insert into public.job_assignments (id, organization_id, job_id, tech_id, assigned_at, created_at)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
   '2026-07-29 17:00:00+00', now()),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000602', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
   '2026-08-02 17:00:00+00', now()),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000604', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
   '2026-07-27 17:00:00+00', now())
on conflict (id) do nothing;