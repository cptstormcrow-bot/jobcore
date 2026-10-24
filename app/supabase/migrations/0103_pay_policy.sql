-- 0103_pay_policy.sql
-- Pay policy: worker classification on profiles + Prem bonus / Dev default pay
-- on compensation_policies, with a default policy for every organization.
--
-- WHAT:
--   1. public.profiles gains worker_type ('employee' | 'contractor', default
--      'employee'), tech_role (null | 'prem' | 'dev' | 'service'), dev_pay_mode
--      (null | 'hourly' | 'flat') and flat_rate_cents (null or >= 0).
--      Hourly pay uses the existing profiles.hourly_rate_cents (0066).
--      The 0071 allow-list guard already locks these new columns for
--      non-admins (admins may edit), so the guard is NOT changed.
--   2. public.compensation_policies gains prem_bonus_flat_cents,
--      prem_bonus_percent and dev_default_flat_cents (all default 0, with
--      CHECK constraints). Existing columns are unchanged.
--   3. Seed: every existing organization with no compensation policy gets a
--      'Default pay policy' (0 hourly, 0 commission) so close-out is unblocked.
--   4. New organizations get the same default policy through an AFTER INSERT
--      trigger on public.organizations (security definer, empty search_path).
--
-- WHY: close-out needs a pay policy to exist for every org, and techs need a
-- worker type / role / dev pay mode so pay can be computed per person.
--
-- Idempotent: add column if not exists, drop constraint if exists then add,
-- seed guarded by not exists, create or replace function, drop trigger if
-- exists then create. Re-running changes nothing.
--
-- ROLLBACK:
--   drop trigger if exists organizations_seed_compensation_policy on public.organizations;
--   drop function if exists public.seed_default_compensation_policy();
--   alter table public.compensation_policies
--     drop constraint if exists compensation_policies_prem_bonus_flat_chk,
--     drop constraint if exists compensation_policies_prem_bonus_percent_chk,
--     drop constraint if exists compensation_policies_dev_default_flat_chk,
--     drop column if exists prem_bonus_flat_cents,
--     drop column if exists prem_bonus_percent,
--     drop column if exists dev_default_flat_cents;
--   alter table public.profiles
--     drop constraint if exists profiles_worker_type_chk,
--     drop constraint if exists profiles_tech_role_chk,
--     drop constraint if exists profiles_dev_pay_mode_chk,
--     drop constraint if exists profiles_flat_rate_cents_chk,
--     drop column if exists worker_type,
--     drop column if exists tech_role,
--     drop column if exists dev_pay_mode,
--     drop column if exists flat_rate_cents;
--   (Seeded 'Default pay policy' rows are data; delete by name if wanted.)
--
-- NOT APPLIED to any database by this file's authoring.

-- 1. profiles columns -------------------------------------------------------
alter table public.profiles
  add column if not exists worker_type text not null default 'employee',
  add column if not exists tech_role text,
  add column if not exists dev_pay_mode text,
  add column if not exists flat_rate_cents integer;

alter table public.profiles drop constraint if exists profiles_worker_type_chk;
alter table public.profiles
  add constraint profiles_worker_type_chk
  check (worker_type in ('employee', 'contractor'));

alter table public.profiles drop constraint if exists profiles_tech_role_chk;
alter table public.profiles
  add constraint profiles_tech_role_chk
  check (tech_role is null or tech_role in ('prem', 'dev', 'service'));

alter table public.profiles drop constraint if exists profiles_dev_pay_mode_chk;
alter table public.profiles
  add constraint profiles_dev_pay_mode_chk
  check (dev_pay_mode is null or dev_pay_mode in ('hourly', 'flat'));

alter table public.profiles drop constraint if exists profiles_flat_rate_cents_chk;
alter table public.profiles
  add constraint profiles_flat_rate_cents_chk
  check (flat_rate_cents is null or flat_rate_cents >= 0);

-- 2. compensation_policies columns -------------------------------------------
alter table public.compensation_policies
  add column if not exists prem_bonus_flat_cents integer not null default 0,
  add column if not exists prem_bonus_percent numeric not null default 0,
  add column if not exists dev_default_flat_cents integer not null default 0;

alter table public.compensation_policies
  drop constraint if exists compensation_policies_prem_bonus_flat_chk;
alter table public.compensation_policies
  add constraint compensation_policies_prem_bonus_flat_chk
  check (prem_bonus_flat_cents >= 0);

alter table public.compensation_policies
  drop constraint if exists compensation_policies_prem_bonus_percent_chk;
alter table public.compensation_policies
  add constraint compensation_policies_prem_bonus_percent_chk
  check (prem_bonus_percent between 0 and 100);

alter table public.compensation_policies
  drop constraint if exists compensation_policies_dev_default_flat_chk;
alter table public.compensation_policies
  add constraint compensation_policies_dev_default_flat_chk
  check (dev_default_flat_cents >= 0);

-- 3. Seed existing orgs ------------------------------------------------------
insert into public.compensation_policies
  (organization_id, name, hourly_rate_cents, commission_basis_percent)
select o.id, 'Default pay policy', 0, 0
from public.organizations o
where not exists (
  select 1 from public.compensation_policies c where c.organization_id = o.id
);

-- 4. New orgs get a default policy -------------------------------------------
create or replace function public.seed_default_compensation_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.compensation_policies
    (organization_id, name, hourly_rate_cents, commission_basis_percent)
  values (new.id, 'Default pay policy', 0, 0);
  return new;
end;
$$;

revoke all on function public.seed_default_compensation_policy() from public;

drop trigger if exists organizations_seed_compensation_policy on public.organizations;
create trigger organizations_seed_compensation_policy
  after insert on public.organizations
  for each row execute function public.seed_default_compensation_policy();

-- 5. Column comments ---------------------------------------------------------
comment on column public.profiles.tech_role is
  'Tech role for pay: prem, dev or service (null = not a field tech).';
comment on column public.profiles.worker_type is
  'Worker classification: employee or contractor.';
comment on column public.profiles.dev_pay_mode is
  'How a dev-role tech is paid: hourly (profiles.hourly_rate_cents) or flat (profiles.flat_rate_cents).';
comment on column public.compensation_policies.prem_bonus_percent is
  'Prem bonus = prem_bonus_flat_cents + this percent of the job total. A plain percent number 0-100, like commission_basis_percent.';
