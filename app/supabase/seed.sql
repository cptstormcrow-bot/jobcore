-- Jobcore P1 — S3 · Development seed
-- Apply AFTER 0001_foundation.sql. See README.md for the full apply order.
--
-- DEPENDENCY: public.profiles.id references auth.users(id). A profile cannot
-- exist without a real auth user, so this seed inserts the four auth users
-- directly. That is a LOCAL-DEV convention only — against a hosted project,
-- create the users through the Auth API / dashboard instead and substitute
-- their UUIDs below (the ids here are fixed constants precisely so they can be
-- swapped in one place).
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
  '{admin-finance,field-tech,sales-marketing}'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Auth users (LOCAL DEV ONLY — see header)
-- ---------------------------------------------------------------------------
-- Password for all four: jobcore-dev. crypt() comes from pgcrypto, which the
-- Supabase auth schema already depends on.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@sdassemblypro.com',
   crypt('jobcore-dev', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@sdassemblypro.com',
   crypt('jobcore-dev', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tech@sdassemblypro.com',
   crypt('jobcore-dev', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sales@sdassemblypro.com',
   crypt('jobcore-dev', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Profiles — one per role
-- ---------------------------------------------------------------------------
-- These four rows are the AC-4 fixture: the same org, four different roles, so
-- getEnabledModules(org, role) can be exercised across the whole role matrix
-- without changing any org-level data.

insert into public.profiles (id, organization_id, full_name, phone, role, active)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
   'Dev Owner', '+16195550101', 'owner', true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
   'Dev Admin', '+16195550102', 'admin', true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001',
   'Dev Tech',  null,           'tech',  true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001',
   'Dev Sales', '+16195550104', 'sales', true)
on conflict (id) do nothing;

-- Dev Tech's phone is deliberately null — it is the fixture that exercises
-- `phone: string | null` in the frozen S1 Profile interface.
