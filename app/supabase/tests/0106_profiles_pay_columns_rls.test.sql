-- Jobcore - assertions for the profiles pay columns (0103 tech_role/flat/worker_type,
-- 0106 commission_enabled/commission_percent, 0107 dev_pay_mode commission + percent cap 50).
--
-- Hand-applied AFTER 0001..0107 and seed.sql. Not run against any live DB
-- without Jeff's go. Each block raises on failure and is silent on success.
-- Run as a normal session, NOT the service role (it bypasses RLS).
-- Same impersonation contract as 0104_job_payout_lines_rls.test.sql: `set local role
-- authenticated` + `request.jwt.claims`. Everything rolls back at the end.
-- Seed users: ...101 owner, ...102 admin, ...103 tech, ...104 tech (second),
-- all org A (prefix 00000000-0000-4000-8000-000000000NNN).

begin;

-- T1 - fixture: roles and shared organization
do $$
declare n integer;
begin
  reset role;
  select count(*) into n from public.profiles
   where id = '00000000-0000-4000-8000-000000000102' and role = 'admin';
  if n <> 1 then raise exception 'T1 SETUP FAILED: ...102 is not admin'; end if;
  select count(*) into n from public.profiles
   where id in ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104')
     and role = 'tech';
  if n <> 2 then raise exception 'T1 SETUP FAILED: ...103/...104 are not both tech'; end if;
  select count(distinct organization_id) into n from public.profiles
   where id in ('00000000-0000-4000-8000-000000000102',
                '00000000-0000-4000-8000-000000000103',
                '00000000-0000-4000-8000-000000000104');
  if n <> 1 then raise exception 'T1 SETUP FAILED: users do not share one organization_id (%)', n; end if;
end $$;

-- T2 - constraints exist
do $$
declare d text;
begin
  reset role;
  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid = 'public.profiles'::regclass and conname = 'profiles_commission_percent_chk';
  if d is null then raise exception 'T2 FAILED: profiles_commission_percent_chk missing'; end if;
  if d not like '%50%' then raise exception 'T2 FAILED: percent check lacks cap 50: %', d; end if;

  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid = 'public.profiles'::regclass and conname = 'profiles_commission_enabled_chk';
  if d is null then raise exception 'T2 FAILED: profiles_commission_enabled_chk missing'; end if;

  select pg_get_constraintdef(oid) into d from pg_constraint
   where conrelid = 'public.profiles'::regclass and conname = 'profiles_dev_pay_mode_chk';
  if d is null then raise exception 'T2 FAILED: profiles_dev_pay_mode_chk missing'; end if;
  if d not like '%commission%' then raise exception 'T2 FAILED: dev_pay_mode check lacks commission: %', d; end if;
  if d like '%flat%' then raise exception 'T2 FAILED: dev_pay_mode check still allows flat: %', d; end if;
end $$;

-- T3 - POSITIVE CONTROL: tech can update own non-pay column
do $$
declare n integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  update public.profiles set full_name = full_name
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'T3 FAILED: positive control updated % rows, expected 1', n; end if;
end $$;

-- T4 - tech may not change own pay columns (insufficient_privilege)
do $$
declare caught boolean;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  caught := false;
  begin
    update public.profiles set commission_percent = 10
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (a) tech changed commission_percent'; end if;

  caught := false;
  begin
    update public.profiles set commission_enabled = true
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (b) tech changed commission_enabled'; end if;

  caught := false;
  begin
    update public.profiles set tech_role = 'dev'
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (c) tech changed tech_role'; end if;

  caught := false;
  begin
    update public.profiles set dev_pay_mode = 'commission'
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (d) tech changed dev_pay_mode'; end if;

  caught := false;
  begin
    update public.profiles set commission_percent = 1
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (e) tech changed commission_percent'; end if;

  caught := false;
  begin
    update public.profiles
       set worker_type = case when worker_type = 'employee' then 'contractor' else 'employee' end
     where id = '00000000-0000-4000-8000-000000000103';
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'T4 FAILED: (f) tech changed worker_type'; end if;
end $$;

-- T5 - admin may set commission on a tech
do $$
declare
  n integer;
  p numeric;
  e boolean;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  update public.profiles set commission_enabled = true, commission_percent = 25
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'T5 FAILED: (a) admin update touched % rows', n; end if;
  select commission_percent, commission_enabled into p, e from public.profiles
   where id = '00000000-0000-4000-8000-000000000103';
  if p is distinct from 25 then raise exception 'T5 FAILED: (a) percent read back %', p; end if;
  if e is distinct from true then raise exception 'T5 FAILED: (a) enabled read back %', e; end if;

  update public.profiles set commission_percent = 50
   where id = '00000000-0000-4000-8000-000000000103';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'T5 FAILED: (b) boundary 50 touched % rows', n; end if;
end $$;

-- T6 - admin writes that violate the checks (check_violation)
do $$
declare caught boolean;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  caught := false;
  begin
    update public.profiles set commission_percent = 51
     where id = '00000000-0000-4000-8000-000000000103';
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'T6 FAILED: (a) percent 51 accepted'; end if;

  caught := false;
  begin
    update public.profiles set commission_enabled = true, commission_percent = 0
     where id = '00000000-0000-4000-8000-000000000103';
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'T6 FAILED: (b) enabled with percent 0 accepted'; end if;

  caught := false;
  begin
    update public.profiles set commission_enabled = true, commission_percent = null
     where id = '00000000-0000-4000-8000-000000000103';
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'T6 FAILED: (c) enabled with percent null accepted'; end if;

  caught := false;
  begin
    update public.profiles set dev_pay_mode = 'flat'
     where id = '00000000-0000-4000-8000-000000000103';
  exception when check_violation then caught := true;
  end;
  if not caught then raise exception 'T6 FAILED: (d) dev_pay_mode flat accepted'; end if;
end $$;

-- T7 - tech may not change another tech's commission
do $$
declare
  caught boolean := false;
  n integer := 0;
  before_p numeric;
  after_p numeric;
begin
  reset role;
  select commission_percent into before_p from public.profiles
   where id = '00000000-0000-4000-8000-000000000104';

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  begin
    update public.profiles set commission_percent = 5
     where id = '00000000-0000-4000-8000-000000000104';
    get diagnostics n = row_count;
  exception when insufficient_privilege then caught := true;
  end;
  if not caught and n <> 0 then
    raise exception 'T7 FAILED: tech updated % row(s) of another tech', n;
  end if;

  reset role;
  select commission_percent into after_p from public.profiles
   where id = '00000000-0000-4000-8000-000000000104';
  if after_p is distinct from before_p then
    raise exception 'T7 FAILED: ...104 commission_percent changed (% -> %)', before_p, after_p;
  end if;
end $$;

-- T8 - INFORMATIONAL (never fails): can a tech read another tech's pay columns?
do $$
declare n integer;
begin
  reset role;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';
  select count(*) into n from (
    select commission_percent from public.profiles
     where id = '00000000-0000-4000-8000-000000000104'
  ) s;
  raise notice 'T8 INFO: tech can read another tech''s pay columns: % row(s) visible (profiles_select_own_org exposure, documented, NOT a fix)', n;
end $$;

rollback;
