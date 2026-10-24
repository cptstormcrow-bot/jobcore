-- Jobcore - migration 0111: lock the pay columns on public.profiles
--
-- What: takes authenticated's table-wide SELECT on public.profiles away and grants
-- SELECT back on the 16 non-pay columns only. After this, the six pay columns
-- (hourly_rate_cents, worker_type, tech_role, dev_pay_mode, commission_enabled,
-- commission_percent) can be read only through public.employee_profiles_v (0110)
-- or by SECURITY DEFINER functions, which run as the owner. anon loses its
-- table-wide SELECT too (anon sees no rows today because every profiles policy is
-- "to authenticated"; this only stops the grant covering the pay columns).
-- INSERT, UPDATE and DELETE grants, every RLS policy and every trigger are
-- untouched, so pay edits still go to public.profiles and the 0071 guard still
-- applies.
--
-- Why: closes the profiles_select_own_org pay-column read exposure (live SQL case
-- 12, 2026-10-24). RLS is row-level, so until now any org member could read every
-- colleague's pay columns.
--
-- Live check before writing (read-only, 2026-10-24): 0 RLS policies, 0 invoker
-- functions and 0 views read a profiles pay column; the four profiles policies are
-- all "to authenticated"; profiles holds exactly the 22 columns named below.
--
-- Must be applied AFTER 0110 AND AFTER the app build that reads employee_profiles_v
-- is what everyone runs. Once this is live, any select('*') on profiles, or any
-- select that names a pay column, fails with 42501 (permission denied for table
-- profiles). The current app reads employee lists through
-- apps/mobile/src/lib/employee-profiles-source.ts, which uses the view; older
-- installed APKs and a dev server on an old build do not. The preflight below
-- raises if 0110 is missing or if profiles has a column this migration does not
-- know.
--
-- Future columns: a column added to profiles later is NOT readable by
-- authenticated until a migration grants it (grant select (col) on public.profiles
-- to authenticated) and adds it to employee_profiles_v. That default is intended:
-- new columns start locked.
--
-- APPLIED LIVE 2026-10-24 on Jeff's go naming 0111, after 0110 (verified: migration list,
-- the catalog, hosted cases 04-08 and 0106 case 12). The pay-column read exposure is closed.
--
-- Idempotent: revoke-then-grant leaves the same end state however often it runs
-- (revoking table-level SELECT also clears column-level grants first).
--
-- Rollback notes (manual):
--   grant select on public.profiles to authenticated;
--   (add anon only to restore the exact pre-0111 state; anon reads no rows either way.)

begin;

-- Preflight: the view must exist, and profiles must hold no column this
-- migration has not decided on.
do $$
declare
  unknown_cols text;
begin
  if to_regclass('public.employee_profiles_v') is null then
    raise exception '0111: apply 0110 first (public.employee_profiles_v is missing)';
  end if;

  select string_agg(a.attname::text, ', ' order by a.attname::text) into unknown_cols
  from pg_attribute a
  where a.attrelid = 'public.profiles'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text <> all (array[
      'id', 'organization_id', 'full_name', 'phone', 'email', 'role', 'active',
      'created_at', 'is_test', 'address', 'drivers_license_number',
      'vehicle_status', 'tool_status', 'paid_travel', 'paid_travel_policy_message',
      'test_jobs_only',
      'hourly_rate_cents', 'worker_type', 'tech_role', 'dev_pay_mode',
      'commission_enabled', 'commission_percent'
    ]);
  if unknown_cols is not null then
    raise exception '0111: profiles has columns this migration does not know: %. Decide each (grant select and add to employee_profiles_v, or leave locked) and update this migration.', unknown_cols;
  end if;
end $$;

revoke select on public.profiles from anon, authenticated;

grant select (
  id, organization_id, full_name, phone, email, role, active, created_at, is_test,
  address, drivers_license_number, vehicle_status, tool_status,
  paid_travel, paid_travel_policy_message, test_jobs_only
) on public.profiles to authenticated;

-- Closing check: pay columns unreadable (but still updatable) for authenticated,
-- everything unreadable for anon, the 16 open columns readable for authenticated.
do $$
declare
  pay_cols text[] := array[
    'hourly_rate_cents', 'worker_type', 'tech_role', 'dev_pay_mode',
    'commission_enabled', 'commission_percent'
  ];
  open_cols text[] := array[
    'id', 'organization_id', 'full_name', 'phone', 'email', 'role', 'active',
    'created_at', 'is_test', 'address', 'drivers_license_number',
    'vehicle_status', 'tool_status', 'paid_travel', 'paid_travel_policy_message',
    'test_jobs_only'
  ];
  c text;
begin
  foreach c in array pay_cols loop
    if has_column_privilege('authenticated', 'public.profiles', c, 'select')
       or has_column_privilege('anon', 'public.profiles', c, 'select') then
      raise exception '0111: profiles.% is still readable', c;
    end if;
    if not has_column_privilege('authenticated', 'public.profiles', c, 'update') then
      raise exception '0111: authenticated lost UPDATE on profiles.%', c;
    end if;
  end loop;

  foreach c in array open_cols loop
    if not has_column_privilege('authenticated', 'public.profiles', c, 'select') then
      raise exception '0111: authenticated cannot read profiles.%', c;
    end if;
    if has_column_privilege('anon', 'public.profiles', c, 'select') then
      raise exception '0111: anon can still read profiles.%', c;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
