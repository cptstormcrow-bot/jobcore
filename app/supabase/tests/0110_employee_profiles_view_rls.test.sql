-- Jobcore - assertions for migration 0110 (view public.employee_profiles_v) and
-- migration 0111 (column lock on public.profiles).
--
-- Purpose: prove the view masks a colleague's six pay columns (hourly_rate_cents,
-- worker_type, tech_role, dev_pay_mode, commission_enabled, commission_percent) for
-- a tech while leaving own row and admin reads unmasked, that the view is row-scoped
-- to the caller's organization and read-only, and that 0111 removed direct SELECT of
-- the pay columns on public.profiles from authenticated.
--
-- Assumes ALL migrations 0001..0111 are applied, plus seed.sql.
-- WRITTEN, NOT RUN locally (no local Postgres); the hosted equivalents are
-- supabase/tests/0110_hosted_cases/, to be run only on Jeff's go.
-- Never run this file against the hosted database.
--
-- Same impersonation contract as 0106_profiles_pay_columns_rls.test.sql: `set local role
-- authenticated` + `request.jwt.claims`. Everything rolls back at the end.
-- Seed users: ...102 admin, ...103 tech, ...104 tech (second), all org A
-- (prefix 00000000-0000-4000-8000-000000000NNN).
--
-- Cases:
--   V1 tech reads OWN row via the view: 1 row, worker_type not null
--   V2 tech reads a colleague via the view: 1 row, full_name set, all six pay columns NULL
--   V3 admin reads the colleague via the view: 1 row, worker_type not null
--   V4 row scope: view count for the tech equals the org's profiles count; no other-org rows
--   V5 anon cannot read the view (insufficient_privilege)
--   V6 view is read-only for authenticated (select true; insert/update/delete false)
--   L1 (0111) tech cannot select commission_percent directly from profiles
--   L2 (0111) tech can select id, full_name, role, active directly from profiles
--   L3 (0111) admin cannot select hourly_rate_cents directly; admin can still update
--      commission_percent
--   L4 (0111) canary: profiles columns equal view columns; 6 pay columns not selectable,
--      16 open columns selectable

begin;

-- V1 - tech reads OWN row via the view (own pay unmasked)
do $$
declare n integer; w text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  select count(*), max(worker_type) into n, w from public.employee_profiles_v
   where id = '00000000-0000-4000-8000-000000000103';
  if n <> 1 then raise exception 'V1 FAILED: expected 1 own row, got %', n; end if;
  if w is null then raise exception 'V1 FAILED: own worker_type is null (masked)'; end if;
  raise notice 'V1 ok';
end $$;

-- V2 - tech reads a colleague via the view (all six pay columns masked)
do $$
declare n integer; bad integer; nm text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  select count(*), max(full_name),
         count(*) filter (where hourly_rate_cents is not null
                             or worker_type is not null
                             or tech_role is not null
                             or dev_pay_mode is not null
                             or commission_enabled is not null
                             or commission_percent is not null)
    into n, nm, bad
    from public.employee_profiles_v
   where id = '00000000-0000-4000-8000-000000000104';
  if n <> 1 then raise exception 'V2 FAILED: expected 1 colleague row, got %', n; end if;
  if nm is null then raise exception 'V2 FAILED: colleague full_name is null'; end if;
  if bad <> 0 then raise exception 'V2 FAILED: colleague pay columns are not all NULL'; end if;
  raise notice 'V2 ok';
end $$;

-- V3 - admin reads the colleague via the view (pay unmasked)
do $$
declare n integer; w text;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
  select count(*), max(worker_type) into n, w from public.employee_profiles_v
   where id = '00000000-0000-4000-8000-000000000104';
  if n <> 1 then raise exception 'V3 FAILED: expected 1 row, got %', n; end if;
  if w is null then raise exception 'V3 FAILED: admin sees worker_type null'; end if;
  raise notice 'V3 ok';
end $$;

-- V4 - row scope: view shows exactly the tech's organization
do $$
declare v integer; p integer; org uuid; other integer;
begin
  reset role;
  select organization_id into org from public.profiles
   where id = '00000000-0000-4000-8000-000000000103';
  select count(*) into p from public.profiles where organization_id = org;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  select count(*) into v from public.employee_profiles_v;
  if v <> p then raise exception 'V4 FAILED: view shows % rows, org has %', v, p; end if;
  select count(*) into other from public.employee_profiles_v where organization_id <> org;
  if other <> 0 then raise exception 'V4 FAILED: % rows from another organization visible', other; end if;
  raise notice 'V4 ok';
end $$;

-- V5 - anon cannot read the view
do $$
declare caught boolean; n integer;
begin
  reset role;
  set local role anon;
  caught := false;
  begin
    select count(*) into n from public.employee_profiles_v;
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'V5 FAILED: anon read the view'; end if;
  raise notice 'V5 ok';
end $$;

-- V6 - view is read-only for authenticated
do $$
begin
  reset role;
  if not has_table_privilege('authenticated', 'public.employee_profiles_v', 'select') then
    raise exception 'V6 FAILED: authenticated lacks select on the view';
  end if;
  if has_table_privilege('authenticated', 'public.employee_profiles_v', 'insert') then
    raise exception 'V6 FAILED: authenticated has insert on the view';
  end if;
  if has_table_privilege('authenticated', 'public.employee_profiles_v', 'update') then
    raise exception 'V6 FAILED: authenticated has update on the view';
  end if;
  if has_table_privilege('authenticated', 'public.employee_profiles_v', 'delete') then
    raise exception 'V6 FAILED: authenticated has delete on the view';
  end if;
  raise notice 'V6 ok';
end $$;

-- L1 (0111) - tech cannot select a pay column directly from profiles
do $$
declare caught boolean; x numeric;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  caught := false;
  begin
    select commission_percent into x from public.profiles
     where id = '00000000-0000-4000-8000-000000000104';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'L1 FAILED: tech selected commission_percent from profiles'; end if;
  raise notice 'L1 ok';
end $$;

-- L2 (0111) - tech can still select the open columns directly
do $$
declare n integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  select count(*) into n from (
    select id, full_name, role, active from public.profiles
     where id = '00000000-0000-4000-8000-000000000104'
  ) s;
  if n <> 1 then raise exception 'L2 FAILED: expected 1 row, got %', n; end if;
  raise notice 'L2 ok';
end $$;

-- L3 (0111) - admin cannot select hourly_rate_cents directly, can still update commission
do $$
declare caught boolean; x integer; n integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';
  caught := false;
  begin
    select hourly_rate_cents into x from public.profiles
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'L3 FAILED: admin selected hourly_rate_cents from profiles'; end if;

  update public.profiles set commission_percent = 25
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'L3 FAILED: admin commission update touched % rows, expected 1', n; end if;
  raise notice 'L3 ok';
end $$;

-- L4 (0111) - canary: column sets match, pay columns closed, open columns open
do $$
declare diff integer; pay integer; opn integer;
begin
  reset role;
  select count(*) into diff from (
    (select attname from pg_attribute
      where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
     except
     select attname from pg_attribute
      where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped)
    union all
    (select attname from pg_attribute
      where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped
     except
     select attname from pg_attribute
      where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped)
  ) d;
  if diff <> 0 then raise exception 'L4 FAILED: profiles and view column sets differ by % columns', diff; end if;

  select count(*) into pay
    from unnest(array['hourly_rate_cents','worker_type','tech_role','dev_pay_mode',
                      'commission_enabled','commission_percent']) c
   where has_column_privilege('authenticated', 'public.profiles', c, 'select');
  if pay <> 0 then raise exception 'L4 FAILED: % pay columns are selectable, expected 0', pay; end if;

  select count(*) into opn
    from unnest(array['id','organization_id','full_name','phone','email','role','active',
                      'created_at','is_test','address','drivers_license_number',
                      'vehicle_status','tool_status','paid_travel',
                      'paid_travel_policy_message','test_jobs_only']) c
   where has_column_privilege('authenticated', 'public.profiles', c, 'select');
  if opn <> 16 then raise exception 'L4 FAILED: % open columns selectable, expected 16', opn; end if;
  raise notice 'L4 ok';
end $$;

rollback;
