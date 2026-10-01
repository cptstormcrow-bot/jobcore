-- 0071_profiles_sensitive_column_guard_rls.test.sql
--
-- Assertions for 0071_profiles_sensitive_column_guard.sql: the BEFORE UPDATE
-- trigger public.guard_profiles_sensitive_columns on public.profiles.
--
-- Hand-applied. Run AFTER 0001..0071 and seed.sql. Each block raises an
-- exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role (which bypasses
-- RLS and would make every assertion pass vacuously).
--
-- Impersonation contract: each block does "reset role", then sets role to
-- authenticated and request.jwt.claims so auth.uid() resolves to the named
-- seed profile. "set local" scopes both to the enclosing transaction.
--
-- Negative cases assert on the MESSAGE TEXT, never the SQLSTATE alone:
-- "permission denied for table" is also 42501.
--
-- Seed identifiers (seed.sql), org 00000000-0000-4000-8000-000000000001:
--   admin  00000000-0000-4000-8000-000000000102
--   tech   00000000-0000-4000-8000-000000000103

begin;

-- Case 1 - tech updates own full_name + phone: succeeds, exactly 1 row.
do $$
declare
  affected integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.profiles set full_name = 'Dev Tech Renamed', phone = '+16195550199'
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'CASE 1 FAILED: expected 1 row updated, got %', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 2 - tech sets own role = admin -> role message
-- ---------------------------------------------------------------------------
do $$
declare
  caught text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000103';
    raise exception 'CASE 2 FAILED: update succeeded, expected 42501';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;

  if caught is distinct from 'profiles.role cannot be changed directly; use public.admin_set_employee_role()' then
    raise exception 'CASE 2 FAILED: expected message "profiles.role cannot be changed directly; use public.admin_set_employee_role()", got "%"', caught;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 3 - tech sets own hourly_rate_cents -> own-profile message
-- ---------------------------------------------------------------------------
do $$
declare
  caught text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    update public.profiles set hourly_rate_cents = 99999 where id = '00000000-0000-4000-8000-000000000103';
    raise exception 'CASE 3 FAILED: update succeeded, expected 42501';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;

  if caught is distinct from 'only name and phone can be changed on your own profile' then
    raise exception 'CASE 3 FAILED: expected message "only name and phone can be changed on your own profile", got "%"', caught;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 4 - tech sets own active = false -> own-profile message
-- ---------------------------------------------------------------------------
do $$
declare
  caught text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    update public.profiles set active = false where id = '00000000-0000-4000-8000-000000000103';
    raise exception 'CASE 4 FAILED: update succeeded, expected 42501';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;

  if caught is distinct from 'only name and phone can be changed on your own profile' then
    raise exception 'CASE 4 FAILED: expected message "only name and phone can be changed on your own profile", got "%"', caught;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 5 - tech updates the ADMIN's full_name: RLS filters it, 0 rows, no error.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.profiles set full_name = 'Hijacked' where id = '00000000-0000-4000-8000-000000000102';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'CASE 5 FAILED: expected 0 rows, got %', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 6 - admin updates the tech's hourly_rate_cents and active: 1 row.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  update public.profiles set hourly_rate_cents = 4500, active = false
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'CASE 6 FAILED: expected 1 row updated, got %', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 7 - admin sets the tech's role directly -> role message
-- ---------------------------------------------------------------------------
do $$
declare
  caught text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  begin
    update public.profiles set role = 'sales' where id = '00000000-0000-4000-8000-000000000103';
    raise exception 'CASE 7 FAILED: update succeeded, expected 42501';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;

  if caught is distinct from 'profiles.role cannot be changed directly; use public.admin_set_employee_role()' then
    raise exception 'CASE 7 FAILED: expected message "profiles.role cannot be changed directly; use public.admin_set_employee_role()", got "%"', caught;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 8 - admin uses admin_set_employee_role(): succeeds, role changes.
-- ---------------------------------------------------------------------------
do $$
declare
  new_role public.user_role;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  perform public.admin_set_employee_role('00000000-0000-4000-8000-000000000103', 'sales');

  select role into new_role from public.profiles where id = '00000000-0000-4000-8000-000000000103';
  if new_role is distinct from 'sales' then
    raise exception 'CASE 8 FAILED: expected role sales, got %', new_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 9 - anon has no UPDATE privilege on profiles: permission denied.
-- ---------------------------------------------------------------------------
do $$
declare
  caught text;
begin
  reset role;
  set local role anon;
  begin
    update public.profiles set full_name = 'anon' where id = '00000000-0000-4000-8000-000000000103';
    raise exception 'CASE 9 FAILED: anon update succeeded';
  exception when insufficient_privilege then
    caught := sqlerrm;
  end;

  if caught is null or caught not like 'permission denied for table%' then
    raise exception 'CASE 9 FAILED: expected "permission denied for table...", got "%"', caught;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case 10 - postgres (reset role) bypasses the guard: direct role update works.
-- ---------------------------------------------------------------------------
do $$
declare
  new_role public.user_role;
begin
  reset role;
  update public.profiles set role = 'tech' where id = '00000000-0000-4000-8000-000000000103';

  select role into new_role from public.profiles where id = '00000000-0000-4000-8000-000000000103';
  if new_role is distinct from 'tech' then
    raise exception 'CASE 10 FAILED: expected role tech, got %', new_role;
  end if;
end $$;

rollback;
