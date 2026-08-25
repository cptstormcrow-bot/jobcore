-- Jobcore - RLS assertions for 0031_employee_profile_fields.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0031 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed
-- profile. `set local` scopes both to the enclosing transaction. Reuses the
-- same real seed admin/tech ids as 0013_rls_fixes_rls.test.sql (org
-- 00000000-0000-4000-8000-000000000001).

begin;

-- ---------------------------------------------------------------------------
-- AC-31.1 - tech_skills_admin_all: an org admin can insert a tech_skills row
-- for their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  inserted integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  insert into public.tech_skills (id, organization_id, tech_id, skill)
  values (
    '00000000-0000-4000-8000-000000000a01',
    '00000000-0000-4000-8000-000000000001',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'installation'
  );

  select count(*) into inserted
  from public.tech_skills
  where id = '00000000-0000-4000-8000-000000000a01';

  if inserted <> 1 then
    raise exception 'AC-31.1 FAILED: admin@ insert into tech_skills did not persist - tech_skills_admin_all is not permitting org-admin insert';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-31.2 - tech_skills_admin_all: an org admin can update and delete a
-- tech_skills row for their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  new_skill text;
  remaining integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  update public.tech_skills set skill = 'electrical' where id = '00000000-0000-4000-8000-000000000a01';

  select skill into new_skill from public.tech_skills where id = '00000000-0000-4000-8000-000000000a01';

  if new_skill <> 'electrical' then
    raise exception 'AC-31.2 FAILED: admin@ update of tech_skills did not apply, skill = %', new_skill;
  end if;

  delete from public.tech_skills where id = '00000000-0000-4000-8000-000000000a01';

  select count(*) into remaining from public.tech_skills where id = '00000000-0000-4000-8000-000000000a01';

  if remaining <> 0 then
    raise exception 'AC-31.2 FAILED: admin@ delete of tech_skills did not apply, % rows remain', remaining;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-31.3 - tech_skills_admin_all: a non-admin tech is DENIED write access to
-- another profile's tech_skills row - zero rows affected on insert.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.tech_skills (id, organization_id, tech_id, skill)
    values (
      '00000000-0000-4000-8000-000000000a02',
      '00000000-0000-4000-8000-000000000001',
      'cff3db85-9535-45c7-ac36-3a78ac161a4b',
      'estimating'
    );

    raise exception 'AC-31.3 FAILED: tech@ inserted a tech_skills row for another profile - tech_skills_admin_all / tech_skills_select_own is over-permitting write access';
  exception
    when others then
      if sqlerrm like 'AC-31.3 FAILED%' then
        raise;
      end if;
  end;

  select count(*) into affected from public.tech_skills where id = '00000000-0000-4000-8000-000000000a02';

  if affected <> 0 then
    raise exception 'AC-31.3 FAILED: tech@ insert into another profile''s tech_skills row persisted, % rows', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-31.4 - tech_skills_select_own: a tech CAN read their own tech_skills
-- rows.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  reset role;

  insert into public.tech_skills (id, organization_id, tech_id, skill)
  values (
    '00000000-0000-4000-8000-000000000a03',
    '00000000-0000-4000-8000-000000000001',
    'd59e3bc7-691d-4ada-8959-e86f40c1e344',
    'service_repair'
  )
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible
  from public.tech_skills
  where id = '00000000-0000-4000-8000-000000000a03';

  if visible <> 1 then
    raise exception 'AC-31.4 FAILED: tech@ could not read their own tech_skills row via tech_skills_select_own, visible = %', visible;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe fixtures back out.
rollback;
