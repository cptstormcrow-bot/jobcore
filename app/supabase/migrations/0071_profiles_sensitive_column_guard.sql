-- 0071_profiles_sensitive_column_guard.sql
--
-- Closes the profiles.role privilege hole.
--
-- Why 0002's `revoke update (role) on public.profiles from authenticated` was a
-- no-op: authenticated (and anon) hold a TABLE-level UPDATE grant on
-- public.profiles. In Postgres a column-level REVOKE only removes a column-level
-- grant; it cannot carve a column out of a table-level grant. Combined with
-- profiles_update_self (0001), which has no column limit, any signed-in user
-- could set their own role, pay rate, active flag, and so on.
--
-- Fix: a BEFORE UPDATE trigger that applies only to the API roles
-- (authenticated, anon). SECURITY DEFINER functions (admin_set_employee_role,
-- handle_new_user) run as their owner, so current_user is not an API role and
-- the guard steps aside for them; service_role and postgres also bypass.
--   * id, organization_id, role, created_at are immutable for API roles.
--     Role changes go through public.admin_set_employee_role() (0029).
--   * Org admins/owners may change any other column (RLS profiles_update_admin
--     already limits them to their own org).
--   * Everyone else may change only full_name and phone, on their own row.
--     This is an allow-list: columns added later are locked by default.
-- Violations raise SQLSTATE 42501 (insufficient_privilege). Clients must treat
-- 42501 as permanent (never retry).
--
-- Also: anon loses write privileges on profiles, and authenticated loses
-- TRUNCATE (TRUNCATE bypasses RLS and row-level triggers).

create or replace function public.guard_profiles_sensitive_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed'
      using errcode = '42501';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'profiles.organization_id cannot be changed'
      using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'profiles.role cannot be changed directly; use public.admin_set_employee_role()'
      using errcode = '42501';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'profiles.created_at cannot be changed'
      using errcode = '42501';
  end if;

  if public.is_org_admin() then
    return new;
  end if;

  if old.id is distinct from auth.uid() then
    raise exception 'you can only change your own profile'
      using errcode = '42501';
  end if;

  if (pg_catalog.to_jsonb(new) - 'full_name' - 'phone')
     is distinct from (pg_catalog.to_jsonb(old) - 'full_name' - 'phone') then
    raise exception 'only name and phone can be changed on your own profile'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sensitive_column_guard on public.profiles;
create trigger profiles_sensitive_column_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_sensitive_columns();

revoke insert, update, delete, truncate on public.profiles from anon;
revoke truncate on public.profiles from authenticated;
