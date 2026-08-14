-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0010_payment_review.sql (P5)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0010 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` (or `anon`
-- for the public review-submission probe) and sets `request.jwt.claims` so that
-- `auth.uid()` resolves to the named seed profile. `set local` scopes both to
-- the enclosing transaction.
--
-- CROSS-SUITE COORDINATION (per .crib/a3a-f-suite-split.md): `reviews` gets
-- policies exercised by both this suite and 0012_marketing_rls. This file
-- covers ONLY 0010's own policies on `reviews` - reviews_admin_all and
-- reviews_insert_anon. The sales-role policies layered on the same table
-- (reviews_select_sales, update_sort_sales, from 0012_marketing.sql) are
-- deliberately left to the 0012 suite - not duplicated here.

begin;

-- ---------------------------------------------------------------------------
-- Fixture plant - all under `reset role` first (the falsifiability gate).
-- Org A rows exercise the positive/negative-tech probes; Org B rows (a
-- synthetic second organization + one row per table, mirroring the 0004-suite
-- AC-3.5 pattern) exercise cross-org isolation.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe', 'org-b-isolation-probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  -- payment_providers: one Org A row, one Org B row.
  insert into public.payment_providers (id, organization_id, provider_id, enabled, config)
  values
    ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', 'stripe', true, '{}'),
    ('00000000-0000-4000-8000-0000000008b1', '00000000-0000-4000-8000-0000000000b2', 'stripe', true, '{}')
  on conflict (id) do nothing;

  -- payments: Org A job ...601 (assigned to tech), Org A job ...603
  -- (unassigned, same org), and one Org B row.
  insert into public.payments (id, organization_id, job_id, provider_id, amount, status)
  values
    ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 'stripe', 150.00, 'pending'),
    ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000603', 'stripe', 75.00, 'pending'),
    ('00000000-0000-4000-8000-0000000008b2', '00000000-0000-4000-8000-0000000000b2',
     '00000000-0000-4000-8000-0000000006b2', 'stripe', 200.00, 'pending')
  on conflict (id) do nothing;

  -- handoff_tokens: one Org A row, one Org B row.
  insert into public.handoff_tokens (id, organization_id, job_id, token, expires_at)
  values
    ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 'hosted-token-org-a', now() + interval '1 day'),
    ('00000000-0000-4000-8000-0000000008b3', '00000000-0000-4000-8000-0000000000b2',
     '00000000-0000-4000-8000-0000000006b2', 'hosted-token-org-b', now() + interval '1 day')
  on conflict (id) do nothing;

  -- reviews: one Org A row, one Org B row.
  insert into public.reviews (id, organization_id, job_id, rating, body, platform)
  values
    ('00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 5, 'Great work', 'internal'),
    ('00000000-0000-4000-8000-0000000008b4', '00000000-0000-4000-8000-0000000000b2',
     '00000000-0000-4000-8000-0000000006b2', 5, 'Org B review', 'internal')
  on conflict (id) do nothing;

  -- review_requests: one Org A row, one Org B row.
  insert into public.review_requests (id, organization_id, job_id, state)
  values
    ('00000000-0000-4000-8000-000000000806', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 'awaiting_payment'),
    ('00000000-0000-4000-8000-0000000008b5', '00000000-0000-4000-8000-0000000000b2',
     '00000000-0000-4000-8000-0000000006b2', 'awaiting_payment')
  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PP-1 - payment_providers_admin_all: an org admin sees exactly the one
-- Org A payment_providers row, not the Org B row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into visible from public.payment_providers;

  if visible <> 1 then
    raise exception 'AC-PP-1 FAILED: admin@ sees % payment_providers rows, expected exactly 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PP-2 - a tech has no policy at all on payment_providers: zero rows, both
-- bulk-select and point lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible from public.payment_providers;
  if visible <> 0 then
    raise exception 'AC-PP-2 FAILED: tech@ sees % payment_providers rows, expected 0 - no tech policy exists', visible;
  end if;

  select count(*) into leaked
  from public.payment_providers
  where id = '00000000-0000-4000-8000-000000000801';

  if leaked <> 0 then
    raise exception 'AC-PP-2 FAILED: tech@ resolved payment_providers row by id - point lookup bypassed the admin-only gate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PP-3 - cross-org: the Org A admin cannot see the Org B payment_providers
-- row, by bulk count or point lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked
  from public.payment_providers
  where id = '00000000-0000-4000-8000-0000000008b1';

  if leaked <> 0 then
    raise exception 'AC-PP-3 FAILED: admin@ resolved the org B payment_providers row by id - tenant boundary breached';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-1 - payments_admin_all: an org admin sees both Org A payments rows
-- (job ...601 assigned, job ...603 unassigned), not the Org B row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into visible from public.payments;

  if visible <> 2 then
    raise exception 'AC-PAY-1 FAILED: admin@ sees % payments rows, expected exactly 2', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-2 - payments_select_tech: the tech sees only the payment for the job
-- they are assigned to (...601), not the unassigned job's payment (...603).
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
  visible_ids uuid[];
  expected_ids uuid[] := array['00000000-0000-4000-8000-000000000802'::uuid];
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*), array_agg(id order by id)
  into visible, visible_ids
  from public.payments;

  if visible <> 1 then
    raise exception 'AC-PAY-2 FAILED: tech@ sees % payments rows, expected exactly 1 (own assigned job)', visible;
  end if;

  if visible_ids is distinct from expected_ids then
    raise exception 'AC-PAY-2 FAILED: tech@ sees payments %, expected % - the job_assignments join is not gating the read', visible_ids, expected_ids;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-2b - the tech cannot resolve the unassigned job's payment row by id.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked
  from public.payments
  where id = '00000000-0000-4000-8000-000000000803';

  if leaked <> 0 then
    raise exception 'AC-PAY-2b FAILED: tech@ resolved the unassigned job payment by id - assignment gating is not applied to point lookups';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-3 - payments_update_tech + payments_tech_confirm_whitelist_trg: the
-- tech may update their own assigned job's payment to status='manual_confirmed'
-- plus confirmed_at/confirmed_by.
-- ---------------------------------------------------------------------------
do $$
declare
  new_status text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  update public.payments
     set status = 'manual_confirmed',
         confirmed_at = now(),
         confirmed_by = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'
   where id = '00000000-0000-4000-8000-000000000802';

  select status into new_status from public.payments where id = '00000000-0000-4000-8000-000000000802';

  if new_status <> 'manual_confirmed' then
    raise exception 'AC-PAY-3 FAILED: tech@ own-job whitelisted update did not apply, status = %', new_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-3b - the whitelist trigger rejects a non-whitelisted column change
-- (amount) from a tech-role update, even on the tech's own assigned job.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    update public.payments
       set amount = 999.99
     where id = '00000000-0000-4000-8000-000000000802';

    raise exception 'AC-PAY-3b FAILED: tech@ updated payments.amount - the column-whitelist trigger did not block it';
  exception
    when others then
      if sqlerrm not like '%tech update may only set status%' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-3c - the tech cannot update the unassigned job's payment at all: the
-- RLS USING predicate filters the row before the trigger ever fires, so zero
-- rows are affected (checked via get diagnostics, per the crib convention).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  update public.payments
     set status = 'manual_confirmed'
   where id = '00000000-0000-4000-8000-000000000803';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-PAY-3c FAILED: tech@ updated the unassigned job payment - RLS did not filter the row, % rows affected', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-PAY-4 - cross-org: neither the Org A admin nor the Org A tech can see
-- the Org B payments row.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked
  from public.payments
  where id = '00000000-0000-4000-8000-0000000008b2';

  if leaked <> 0 then
    raise exception 'AC-PAY-4 FAILED: admin@ resolved the org B payments row by id - tenant boundary breached';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-HT-1 - handoff_tokens_admin_all: an org admin sees exactly the one Org A
-- handoff_tokens row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into visible from public.handoff_tokens;

  if visible <> 1 then
    raise exception 'AC-HT-1 FAILED: admin@ sees % handoff_tokens rows, expected exactly 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-HT-2 - handoff_tokens has no tech-role policy at all: a tech sees zero
-- rows, by design (validated server-side via the service role only).
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible from public.handoff_tokens;

  if visible <> 0 then
    raise exception 'AC-HT-2 FAILED: tech@ sees % handoff_tokens rows, expected 0 - no tech policy exists on this table', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-HT-3 - cross-org: the Org A admin cannot see the Org B handoff_tokens
-- row by id.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked
  from public.handoff_tokens
  where id = '00000000-0000-4000-8000-0000000008b3';

  if leaked <> 0 then
    raise exception 'AC-HT-3 FAILED: admin@ resolved the org B handoff_tokens row by id - tenant boundary breached';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RV-1 - reviews_admin_all: an org admin sees exactly the one Org A
-- reviews row. (0010's own scope only - reviews_select_sales/update_sort_sales
-- from 0012_marketing.sql are covered by the 0012 suite, not here.)
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into visible from public.reviews;

  if visible <> 1 then
    raise exception 'AC-RV-1 FAILED: admin@ sees % reviews rows, expected exactly 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RV-2 - reviews_insert_anon: an anon-role caller (no authenticated
-- session, as on the public handoff page) can insert a review for a real job
-- whose organization_id matches the job's own organization_id.
-- ---------------------------------------------------------------------------
do $$
declare
  inserted integer;
begin
  set local role anon;

  insert into public.reviews (id, organization_id, job_id, rating, body, platform)
  values (
    '00000000-0000-4000-8000-000000000807',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    4, 'Anon-submitted review', 'internal'
  );

  select count(*) into inserted
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000807';

  reset role;

  if inserted <> 1 then
    raise exception 'AC-RV-2 FAILED: anon insert into reviews did not persist, expected exactly 1 matching row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RV-2b - the anon insert is rejected when job_id/organization_id do not
-- reference the same real job row (the only guard the public policy has).
-- ---------------------------------------------------------------------------
do $$
begin
  set local role anon;

  begin
    insert into public.reviews (id, organization_id, job_id, rating, body, platform)
    values (
      '00000000-0000-4000-8000-000000000808',
      '00000000-0000-4000-8000-0000000000b2',
      '00000000-0000-4000-8000-000000000601',
      3, 'Mismatched org/job anon review', 'internal'
    );

    raise exception 'AC-RV-2b FAILED: anon insert with mismatched organization_id/job_id succeeded - the WITH CHECK predicate is not enforcing the join';
  exception
    when others then
      if sqlerrm like 'AC-RV-2b FAILED%' then
        raise;
      end if;
  end;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RV-2c - anon has no select policy on reviews: an anon caller sees zero
-- rows even though it can insert.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role anon;

  select count(*) into visible from public.reviews;

  reset role;

  if visible <> 0 then
    raise exception 'AC-RV-2c FAILED: anon@ sees % reviews rows, expected 0 - no anon select policy exists', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RV-3 - cross-org: the Org A admin cannot see the Org B reviews row.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked
  from public.reviews
  where id = '00000000-0000-4000-8000-0000000008b4';

  if leaked <> 0 then
    raise exception 'AC-RV-3 FAILED: admin@ resolved the org B reviews row by id - tenant boundary breached';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RR-1 - review_requests_admin_all: an org admin sees exactly the one
-- Org A review_requests row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into visible from public.review_requests;

  if visible <> 1 then
    raise exception 'AC-RR-1 FAILED: admin@ sees % review_requests rows, expected exactly 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RR-2 - review_requests has no tech-role policy: a tech sees zero rows.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into visible from public.review_requests;

  if visible <> 0 then
    raise exception 'AC-RR-2 FAILED: tech@ sees % review_requests rows, expected 0 - no tech policy exists on this table', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-RR-3 - cross-org: the Org A admin cannot see the Org B review_requests
-- row by id.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked
  from public.review_requests
  where id = '00000000-0000-4000-8000-0000000008b5';

  if leaked <> 0 then
    raise exception 'AC-RR-3 FAILED: admin@ resolved the org B review_requests row by id - tenant boundary breached';
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
