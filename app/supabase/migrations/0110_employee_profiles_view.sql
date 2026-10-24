-- Jobcore - migration 0110: employee_profiles_v, the pay-masked view of profiles
--
-- What: creates public.employee_profiles_v. For the caller's own organization it
-- returns every profiles column, except that the six pay columns
-- (hourly_rate_cents, worker_type, tech_role, dev_pay_mode, commission_enabled,
-- commission_percent) come back NULL unless the caller is an org admin or the row
-- is the caller's own. Nothing is locked by this migration: it is purely additive
-- and safe to apply at any time.
--
-- Why: the only profiles SELECT policy (0001 profiles_select_own_org) is row-level,
-- so any org member can read every colleague's pay columns (live SQL case 12,
-- 2026-10-24). RLS cannot hide columns; a view can. The app reads its employee
-- lists through this view (apps/mobile/src/lib/employee-profiles-source.ts), and
-- migration 0111 then locks the pay columns on the table itself.
--
-- Security model: the view is deliberately SECURITY DEFINER (security_invoker =
-- false), unlike customer_project_history_v and job_task_summary_v, which are
-- invoker views. An invoker view could not read the pay columns once 0111 revokes
-- them. The view runs as its owner (postgres, which owns profiles and so bypasses
-- RLS), so it re-applies the org boundary itself with the helpers the policy uses:
-- current_org_id() and is_org_admin() (both SECURITY DEFINER, stable). The
-- (select ...) wrappers make Postgres evaluate each helper once per query rather
-- than once per row. security_barrier makes the org filter run before any filter
-- the client adds. Supabase's advisor flags security-definer views
-- (security_definer_view); that lint is intended here.
--
-- Grants: a single-table view is auto-updatable and Supabase's default privileges
-- hand new public objects to anon and authenticated, so this migration revokes
-- everything and re-grants SELECT to authenticated only. Pay writes keep going to
-- public.profiles.
--
-- Must be applied AFTER 0109. The closing check raises, and rolls the whole
-- migration back, if the view's columns differ from profiles' columns or if the
-- grants are wrong.
--
-- APPLIED LIVE 2026-10-24 on Jeff's go naming 0110 (dry-run listed only this migration; verified with migration list, the catalog and hosted cases 01-03).
--
-- Idempotent: create or replace view, revoke/grant, comment on. Re-running changes
-- nothing. When profiles gains a column later, add it to this view in the same
-- migration that adds it (create or replace view allows new columns at the end).
--
-- Rollback notes (manual):
--   drop view if exists public.employee_profiles_v;
--   Safe at any time while 0111 is not applied. After 0111 is applied, drop the
--   view only together with:  grant select on public.profiles to authenticated;

begin;

create or replace view public.employee_profiles_v
with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.organization_id,
  p.full_name,
  p.phone,
  p.email,
  p.role,
  p.active,
  p.created_at,
  p.is_test,
  p.address,
  p.drivers_license_number,
  p.vehicle_status,
  p.tool_status,
  p.paid_travel,
  p.paid_travel_policy_message,
  p.test_jobs_only,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.hourly_rate_cents end as hourly_rate_cents,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.worker_type end as worker_type,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.tech_role end as tech_role,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.dev_pay_mode end as dev_pay_mode,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.commission_enabled end as commission_enabled,
  case when (select public.is_org_admin()) or p.id = (select auth.uid())
       then p.commission_percent end as commission_percent
from public.profiles p
where p.organization_id = (select public.current_org_id());

revoke all on public.employee_profiles_v from public, anon, authenticated;
grant select on public.employee_profiles_v to authenticated;

comment on view public.employee_profiles_v is
  'Org-scoped profiles with the pay columns (hourly_rate_cents, worker_type, tech_role, dev_pay_mode, commission_enabled, commission_percent) masked to NULL unless the caller is an org admin or the row is their own. SECURITY DEFINER by design (0110); the app reads employee lists from here, pay writes go to public.profiles.';

-- Closing check: the view carries exactly profiles' columns, and only SELECT
-- for authenticated.
do $$
declare
  diff text;
begin
  if not has_table_privilege('authenticated', 'public.employee_profiles_v', 'select') then
    raise exception '0110: authenticated cannot select employee_profiles_v';
  end if;
  if has_table_privilege('anon', 'public.employee_profiles_v', 'select')
     or has_table_privilege('authenticated', 'public.employee_profiles_v', 'insert')
     or has_table_privilege('authenticated', 'public.employee_profiles_v', 'update')
     or has_table_privilege('authenticated', 'public.employee_profiles_v', 'delete') then
    raise exception '0110: employee_profiles_v carries grants it must not have';
  end if;

  select string_agg(d.attname, ', ' order by d.attname) into diff
  from (
    (select attname::text from pg_attribute
      where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
     except
     select attname::text from pg_attribute
      where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped)
    union all
    (select attname::text from pg_attribute
      where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped
     except
     select attname::text from pg_attribute
      where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped)
  ) d(attname);
  if diff is not null then
    raise exception '0110: employee_profiles_v and profiles differ on columns: %', diff;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
