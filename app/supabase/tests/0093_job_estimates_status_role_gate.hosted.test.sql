-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - assertions for 0093_job_estimates_status_role_gate.sql (Row 17)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0093 and seed.hosted.sql.
-- Each block raises an exception on failure and is silent on success.
-- Everything is rolled back at the end.
--
-- Impersonation contract: authenticated blocks set `role` to `authenticated`
-- and `request.jwt.claims` so auth.uid() resolves to the named seed profile.
-- Fixtures are planted under `reset role` with claims cleared (auth.uid() is
-- null, the service-role path), on seed jobs ...0601 .. ...0605.

begin;

-- Fixtures (service-role path): estimates in known states.
reset role;
set local request.jwt.claims = '';
insert into public.job_estimates (job_id, organization_id, status) values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', 'draft'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', 'submitted'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001', 'approved')
on conflict (job_id) do update set status = excluded.status;

-- AC-93.1 - tech draft -> submitted is allowed.
do $$
declare affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  update public.job_estimates set status = 'submitted'
   where job_id = '00000000-0000-4000-8000-000000000601';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'AC-93.1 FAILED: tech draft->submitted affected % rows, expected 1', affected;
  end if;
end $$;

-- AC-93.2 - tech submitted -> approved is rejected (42501).
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  begin
    update public.job_estimates set status = 'approved'
     where job_id = '00000000-0000-4000-8000-000000000602';
    raise exception 'AC-93.2 FAILED: tech approved an estimate without the gate raising';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- AC-93.3 - tech update of an already-approved estimate is rejected (42501),
-- both a status move out of approved and a non-status column edit.
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  begin
    update public.job_estimates set status = 'draft'
     where job_id = '00000000-0000-4000-8000-000000000603';
    raise exception 'AC-93.3 FAILED: tech moved an estimate out of approved without the gate raising';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.job_estimates set summary = 'tampered'
     where job_id = '00000000-0000-4000-8000-000000000603';
    raise exception 'AC-93.3 FAILED: tech edited an approved estimate without the gate raising';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- AC-93.4 - tech INSERT with status approved is rejected (42501).
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  begin
    insert into public.job_estimates (job_id, organization_id, status)
    values ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001', 'approved');
    raise exception 'AC-93.4 FAILED: tech inserted an approved estimate without the gate raising';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- AC-93.5 - admin approves a submitted estimate and edits it afterwards.
do $$
declare affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';
  update public.job_estimates set status = 'approved'
   where job_id = '00000000-0000-4000-8000-000000000602';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'AC-93.5 FAILED: admin approve affected % rows, expected 1', affected;
  end if;
  update public.job_estimates set status = 'draft'
   where job_id = '00000000-0000-4000-8000-000000000603';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'AC-93.5 FAILED: admin move out of approved affected % rows, expected 1', affected;
  end if;
end $$;

-- AC-93.6 - sales approves (is_org_sales_or_above path).
do $$
declare affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';
  update public.job_estimates set status = 'approved'
   where job_id = '00000000-0000-4000-8000-000000000601';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'AC-93.6 FAILED: sales approve affected % rows, expected 1', affected;
  end if;
end $$;

-- AC-93.7 - service role (auth.uid() null) may approve and insert approved.
do $$
declare affected integer;
begin
  reset role;
  set local request.jwt.claims = '';
  update public.job_estimates set status = 'submitted'
   where job_id = '00000000-0000-4000-8000-000000000601';
  update public.job_estimates set status = 'approved'
   where job_id = '00000000-0000-4000-8000-000000000601';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'AC-93.7 FAILED: service-role approve affected % rows, expected 1', affected;
  end if;
  insert into public.job_estimates (job_id, organization_id, status)
  values ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001', 'approved');
end $$;

-- Nothing above is meant to persist.
rollback;
