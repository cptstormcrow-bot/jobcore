-- Jobcore - HOSTED variant of 0104_job_payout_lines_rls.test.sql
--
-- Carries the real auth uuids: admin a143fac2-4806-42ed-9283-b45275b6c53a,
-- tech d59e3bc7-691d-4ada-8959-e86f40c1e344, second tech
-- 000b2b3c-d636-4bae-a6d3-bdb735bd4358. Seed job ...601 exists on the hosted project.
-- Run with: npx -y supabase@2.116.0 db query --linked --file <absolute path>
-- (from the app directory). Each block raises on failure; an assertion failure
-- shows its own T<n> FAILED message instead of the final error.
-- ON SUCCESS the script ends with a deliberate forced error
-- `22P02 ... 0104 HOSTED ALL PASS` so the whole transaction aborts and nothing
-- persists even if the tool ignores begin/rollback (same pattern as
-- tests/0071_hosted_cases/README.md). Never remove the ::int.

begin;

-- T1 - fixture: close the seed job, no pre-existing lines
do $$
declare n integer;
begin
  reset role;
  update public.jobs set status = 'closed'
   where id = '00000000-0000-4000-8000-000000000601';
  select count(*) into n from public.job_payout_lines;
  if n <> 0 then raise exception 'T1 SETUP FAILED: job_payout_lines not empty (%)', n; end if;
end $$;

-- T2 - table, RLS flag, policies, trigger exist
do $$
declare n integer;
begin
  reset role;
  if to_regclass('public.job_payout_lines') is null then
    raise exception 'T2 FAILED: job_payout_lines missing';
  end if;
  select count(*) into n from pg_class
   where oid = 'public.job_payout_lines'::regclass and relrowsecurity;
  if n <> 1 then raise exception 'T2 FAILED: RLS not enabled'; end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'job_payout_lines'
     and policyname in ('job_payout_lines_admin_all', 'job_payout_lines_select_own');
  if n <> 2 then raise exception 'T2 FAILED: expected 2 policies, found %', n; end if;
  select count(*) into n from pg_trigger
   where tgrelid = 'public.job_payout_lines'::regclass
     and tgname = 'job_payout_lines_immutable_trg';
  if n <> 1 then raise exception 'T2 FAILED: immutability trigger missing'; end if;
end $$;

-- T3 - admin posts lines; re-post is idempotent (0 inserted)
do $$
declare n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  n := public.post_job_payout_lines(
    '00000000-0000-4000-8000-000000000601',
    '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","amount_cents":5000,"basis":"dev_flat"},
      {"user_id":"000b2b3c-d636-4bae-a6d3-bdb735bd4358","amount_cents":2500,"basis":"prem_bonus"}]'::jsonb);
  if n <> 2 then raise exception 'T3 FAILED: first post inserted %, expected 2', n; end if;

  n := public.post_job_payout_lines(
    '00000000-0000-4000-8000-000000000601',
    '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","amount_cents":5000,"basis":"dev_flat"}]'::jsonb);
  if n <> 0 then raise exception 'T3 FAILED: re-post inserted %, expected 0', n; end if;

  select count(*) into n from public.job_payout_lines;
  if n <> 2 then raise exception 'T3 FAILED: admin sees % rows, expected 2', n; end if;
end $$;

-- T4 - bad input rejected (negative amount, non-array, bad basis); non-admin cannot post
do $$
declare caught boolean;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  caught := false;
  begin
    perform public.post_job_payout_lines('00000000-0000-4000-8000-000000000601',
      '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","amount_cents":-1,"basis":"dev_flat"}]'::jsonb);
  exception when others then caught := true; end;
  if not caught then raise exception 'T4 FAILED: negative amount accepted'; end if;

  caught := false;
  begin
    perform public.post_job_payout_lines('00000000-0000-4000-8000-000000000601', '{"a":1}'::jsonb);
  exception when others then caught := true; end;
  if not caught then raise exception 'T4 FAILED: non-array accepted'; end if;

  caught := false;
  begin
    perform public.post_job_payout_lines('00000000-0000-4000-8000-000000000601',
      '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","amount_cents":100,"basis":"dev_hourly"}]'::jsonb);
  exception when others then caught := true; end;
  if not caught then raise exception 'T4 FAILED: bad basis accepted'; end if;

  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  caught := false;
  begin
    perform public.post_job_payout_lines('00000000-0000-4000-8000-000000000601',
      '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","amount_cents":100,"basis":"dev_flat"}]'::jsonb);
  exception when others then caught := true; end;
  if not caught then raise exception 'T4 FAILED: tech was allowed to post lines'; end if;
end $$;

-- T5 - immutability trigger
do $$
declare caught boolean; v_id uuid;
begin
  reset role;
  select id into v_id from public.job_payout_lines
   where user_id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344';

  caught := false;
  begin update public.job_payout_lines set amount_cents = 9999 where id = v_id;
  exception when others then caught := true; end;
  if not caught then raise exception 'T5 FAILED: amount_cents update allowed'; end if;

  caught := false;
  begin update public.job_payout_lines set basis = 'prem_bonus' where id = v_id;
  exception when others then caught := true; end;
  if not caught then raise exception 'T5 FAILED: basis update allowed'; end if;

  caught := false;
  begin update public.job_payout_lines set status = 'included' where id = v_id;
  exception when others then caught := true; end;
  if not caught then raise exception 'T5 FAILED: pending -> included without payout_batch_id allowed'; end if;

  caught := false;
  begin delete from public.job_payout_lines where id = v_id;
  exception when others then caught := true; end;
  if not caught then raise exception 'T5 FAILED: delete allowed'; end if;
end $$;

-- T6 - select-own: tech 103 sees only own row; tech 104 cannot see 103's row
do $$
declare n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';
  select count(*) into n from public.job_payout_lines;
  if n <> 1 then raise exception 'T6 FAILED: tech 103 sees % rows, expected 1', n; end if;
  select count(*) into n from public.job_payout_lines
   where user_id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358';
  if n <> 0 then raise exception 'T6 FAILED: tech 103 can see tech 104 row'; end if;

  set local request.jwt.claims = '{"sub":"000b2b3c-d636-4bae-a6d3-bdb735bd4358","role":"authenticated"}';
  select count(*) into n from public.job_payout_lines
   where user_id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344';
  if n <> 0 then raise exception 'T6 FAILED: tech 104 can see tech 103 row'; end if;
end $$;

-- T7 - create_payout_batch folds pending lines into bonus; total ties; lines
-- marked included; a user with only pending lines (104) still gets a line.
-- Only tech 103 is passed in p_lines (with 1000 hours cents).
do $$
declare
  b public.payout_batches;
  n integer; r record;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  b := public.create_payout_batch(current_date - 14, current_date,
    '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","employee_name":"Tech","hours_amount":1000}]'::jsonb);

  select * into r from public.payout_lines
   where payout_batch_id = b.id and user_id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344';
  if r.bonus_amount <> 5000 then raise exception 'T7 FAILED: 103 bonus %, expected 5000', r.bonus_amount; end if;
  if r.total_amount <> 6000 then raise exception 'T7 FAILED: 103 total %, expected 6000', r.total_amount; end if;
  if r.total_amount <> r.hours_amount + r.commission_amount + r.bonus_amount + r.reimbursement_amount then
    raise exception 'T7 FAILED: total does not equal component sum';
  end if;

  select * into r from public.payout_lines
   where payout_batch_id = b.id and user_id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358';
  if not found then raise exception 'T7 FAILED: pending-only user 104 got no payout line'; end if;
  if r.bonus_amount <> 2500 or r.total_amount <> 2500 or r.hours_amount <> 0 or r.reimbursement_amount <> 0 then
    raise exception 'T7 FAILED: 104 line wrong (bonus %, total %)', r.bonus_amount, r.total_amount;
  end if;

  select count(*) into n from public.job_payout_lines
   where status = 'included' and payout_batch_id = b.id;
  if n <> 2 then raise exception 'T7 FAILED: % lines included, expected 2', n; end if;
  select count(*) into n from public.job_payout_lines where status = 'pending';
  if n <> 0 then raise exception 'T7 FAILED: % lines still pending', n; end if;
end $$;

-- T8 - a second batch does not re-include the same lines
do $$
declare
  b public.payout_batches;
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  b := public.create_payout_batch(current_date - 14, current_date,
    '[{"user_id":"d59e3bc7-691d-4ada-8959-e86f40c1e344","hours_amount":0}]'::jsonb);

  select coalesce(sum(bonus_amount), 0) into n from public.payout_lines where payout_batch_id = b.id;
  if n <> 0 then raise exception 'T8 FAILED: second batch bonus %, expected 0', n; end if;
  select count(*) into n from public.payout_lines where payout_batch_id = b.id;
  if n <> 1 then raise exception 'T8 FAILED: second batch has % lines, expected 1 (only passed user)', n; end if;
end $$;

-- Convention note: every case above is expressible in the existing DO-block
-- style. Immutability probes run under reset role (trigger fires for any role,
-- as in 0005 AC-M6). Nothing persists.
select ('0104 HOSTED ALL PASS')::int;
rollback;
