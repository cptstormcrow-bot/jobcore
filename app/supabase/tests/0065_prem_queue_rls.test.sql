-- 0065_prem_queue_rls.test.sql
-- Plain-assert RLS probe for migration 0065 (Prem queue select + job_assignments
-- write hardening). Run as a normal authenticated session via the Supabase SQL
-- editor or `supabase db query --file`, NEVER as the service role — the service
-- role bypasses RLS and every assertion below would pass vacuously.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (planted under bypass/superuser role; reset here first as a
-- falsifiability gate before any impersonation below).
-- ---------------------------------------------------------------------------
reset role;

-- J1: flagged (needs_prem_at set) and unclaimed — visible to any org tech
-- until an investigator assignment lands on it.
insert into public.jobs (id, organization_id, status, needs_prem_at)
values ('00000000-0000-4000-8000-000000065001', '00000000-0000-4000-8000-000000000001', 'new', now())
on conflict (id) do nothing;

-- J2: unflagged (needs_prem_at null) — must never surface in the Prem queue.
insert into public.jobs (id, organization_id, status, needs_prem_at)
values ('00000000-0000-4000-8000-000000065002', '00000000-0000-4000-8000-000000000001', 'new', null)
on conflict (id) do nothing;

-- J3: a second flagged/unclaimed job, kept separate from J1 so the negative-
-- insert cases (wrong kind / wrong tech_id) and the update/delete cases aren't
-- entangled with J1's claim + unique-index cases above.
insert into public.jobs (id, organization_id, status, needs_prem_at)
values ('00000000-0000-4000-8000-000000065003', '00000000-0000-4000-8000-000000000001', 'new', now())
on conflict (id) do nothing;

-- Tech B: a second same-org tech, distinct from the seeded Dev Tech (...103),
-- needed for the claim-race and cross-visibility cases. auth.users row follows
-- seed.sql's own insert pattern; the profiles row is what makes current_org_id()
-- / is_org_sales_or_above() resolve for this identity, same as any real actor.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000065004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'dev-tech-b@jobcore.test',
  crypt('jobcore-dev', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
)
on conflict (id) do nothing;

insert into public.profiles (id, organization_id, full_name, role, active)
values ('00000000-0000-4000-8000-000000065004', '00000000-0000-4000-8000-000000000001', 'Dev Tech B', 'tech', true)
on conflict (id) do nothing;

-- Pre-existing job_assignments row on J3 (installer, tech A) used only by the
-- update/delete-denial and sales/admin-still-can cases below.
insert into public.job_assignments (id, organization_id, job_id, tech_id, kind, assigned_at)
values ('00000000-0000-4000-8000-000000065007', '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000065003', '00000000-0000-4000-8000-000000000103',
        'installer', now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- AC-65.1: tech sees a flagged unclaimed job.
-- ---------------------------------------------------------------------------
do $$
declare
  visible_count integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into visible_count
  from public.jobs
  where id = '00000000-0000-4000-8000-000000065001';

  if visible_count <> 1 then
    raise exception 'AC-65.1 FAILED: tech@103 did not see flagged unclaimed job ...065001 (count=%) - jobs_select_tech_prem_queue', visible_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.2: tech does not see an unflagged unassigned job.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where id = '00000000-0000-4000-8000-000000065002';

  if leaked <> 0 then
    raise exception 'AC-65.2 FAILED: tech@103 saw unflagged job ...065002 (leaked=%) - jobs_select_tech_prem_queue needs_prem_at predicate', leaked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.3: tech A's claim succeeds.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  insert into public.job_assignments (id, organization_id, job_id, tech_id, kind, assigned_at)
  values ('00000000-0000-4000-8000-000000065005', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000065001', '00000000-0000-4000-8000-000000000103',
          'investigator', now());
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-65.3 FAILED: tech@103 could not claim job ...065001 (affected=%) - job_assignments_insert_tech_prem_claim', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.4: tech B's second claim on the same job fails (unique index).
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000065004","role":"authenticated"}';

  begin
    insert into public.job_assignments (id, organization_id, job_id, tech_id, kind, assigned_at)
    values ('00000000-0000-4000-8000-000000065006', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000065001', '00000000-0000-4000-8000-000000065004',
            'investigator', now());
    raise exception 'AC-65.4 FAILED: tech@065004 claimed already-claimed job ...065001 without a unique-index violation - job_assignments_one_investigator_per_job';
  exception
    when others then
      if sqlerrm not like 'duplicate key value violates unique constraint%' then
        raise exception 'AC-65.4 FAILED: tech@065004 claim on ...065001 raised an unexpected error - job_assignments_one_investigator_per_job: %', sqlerrm;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.5: tech B no longer sees tech A's claimed job.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000065004","role":"authenticated"}';

  select count(*) into leaked
  from public.jobs
  where id = '00000000-0000-4000-8000-000000065001';

  if leaked <> 0 then
    raise exception 'AC-65.5 FAILED: tech@065004 still saw claimed job ...065001 (leaked=%) - jobs_select_tech_prem_queue not-exists predicate', leaked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.6: tech cannot insert a claim with kind='installer'.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.job_assignments (id, organization_id, job_id, tech_id, kind, assigned_at)
    values ('00000000-0000-4000-8000-000000065008', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000065003', '00000000-0000-4000-8000-000000000103',
            'installer', now());
    raise exception 'AC-65.6 FAILED: tech@103 inserted kind=installer on job ...065003 without an RLS violation - job_assignments_insert_tech_prem_claim';
  exception
    when others then
      if sqlerrm not like 'new row violates row-level security policy%' then
        raise exception 'AC-65.6 FAILED: tech@103 kind=installer insert on ...065003 raised an unexpected error - job_assignments_insert_tech_prem_claim: %', sqlerrm;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.7: tech cannot insert a claim carrying another tech's id.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.job_assignments (id, organization_id, job_id, tech_id, kind, assigned_at)
    values ('00000000-0000-4000-8000-000000065009', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000065003', '00000000-0000-4000-8000-000000065004',
            'investigator', now());
    raise exception 'AC-65.7 FAILED: tech@103 inserted a job_assignments row for another tech (...065004) without an RLS violation - job_assignments_insert_tech_prem_claim';
  exception
    when others then
      if sqlerrm not like 'new row violates row-level security policy%' then
        raise exception 'AC-65.7 FAILED: tech@103 cross-tech insert on ...065004 raised an unexpected error - job_assignments_insert_tech_prem_claim: %', sqlerrm;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.8: tech cannot update job_assignments.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.job_assignments
  set assigned_at = now()
  where id = '00000000-0000-4000-8000-000000065007';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-65.8 FAILED: tech@103 updated job_assignments ...065007 (affected=%) - job_assignments_update_org sales-or-above predicate', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.9: tech cannot delete job_assignments.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  delete from public.job_assignments
  where id = '00000000-0000-4000-8000-000000065007';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-65.9 FAILED: tech@103 deleted job_assignments ...065007 (affected=%) - job_assignments_delete_org sales-or-above predicate', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-65.10: sales/admin still can update and delete job_assignments.
-- Uses the seeded Dev Admin (...102); is_org_sales_or_above() treats
-- owner/admin/sales alike, so admin stands in for the whole bucket here.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  update public.job_assignments
  set assigned_at = now()
  where id = '00000000-0000-4000-8000-000000065007';
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-65.10 FAILED: admin@102 could not update job_assignments ...065007 (affected=%) - job_assignments_update_org', affected;
  end if;

  delete from public.job_assignments
  where id = '00000000-0000-4000-8000-000000065007';
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-65.10 FAILED: admin@102 could not delete job_assignments ...065007 (affected=%) - job_assignments_delete_org', affected;
  end if;
end $$;

reset role;
-- Nothing above is meant to persist. Roll the fixtures and claims back out.
rollback;
