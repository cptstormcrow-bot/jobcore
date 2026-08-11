-- Jobcore - RLS assertions for 0010_payment_review.sql (P5)
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0010 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` (or `anon`)
-- and sets `request.jwt.claims` so that `auth.uid()` resolves to the named seed
-- profile. `set local` scopes both to the enclosing transaction.
--
-- Scope note: `reviews` is also layered by 0012_marketing.sql's sales-facing
-- policies (`reviews_select_sales`, `reviews_update_sort_sales`). Those are
-- covered by `tests/0012_marketing_rls.test.sql`; this suite covers
-- only 0010's own admin/anon policies on `reviews` to avoid duplication.

begin;

-- ---------------------------------------------------------------------------
-- AC-10.1 - fixture plant under `reset role` first (the falsifiability gate).
-- One row per 0010 table, scoped to org A, linked to seed job ...601 (tech@
-- is assigned to ...601 per seed.sql).
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  reset role;

  insert into public.payment_providers (id, organization_id, provider_id, enabled, config)
  values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001',
          'stripe', true, '{}')
  on conflict (id) do nothing;

  insert into public.payments (id, organization_id, job_id, provider_id, amount, status)
  values ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'stripe', 150.00, 'pending')
  on conflict (id) do nothing;

  insert into public.handoff_tokens (id, organization_id, job_id, token, expires_at)
  values ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'ac10-fixture-token', now() + interval '1 day')
  on conflict (id) do nothing;

  insert into public.reviews (id, organization_id, job_id, rating, body, platform, publish_ok)
  values ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 5, 'Great work', 'internal', false)
  on conflict (id) do nothing;

  insert into public.review_requests (id, organization_id, job_id, state)
  values ('00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'awaiting_payment')
  on conflict (id) do nothing;

  select count(*) into n from public.payment_providers where id = '00000000-0000-4000-8000-000000000801';
  if n <> 1 then
    raise exception 'AC-10.1 SETUP FAILED: payment_providers fixture row did not plant';
  end if;

  select count(*) into n from public.payments where id = '00000000-0000-4000-8000-000000000802';
  if n <> 1 then
    raise exception 'AC-10.1 SETUP FAILED: payments fixture row did not plant';
  end if;

  select count(*) into n from public.handoff_tokens where id = '00000000-0000-4000-8000-000000000803';
  if n <> 1 then
    raise exception 'AC-10.1 SETUP FAILED: handoff_tokens fixture row did not plant';
  end if;

  select count(*) into n from public.reviews where id = '00000000-0000-4000-8000-000000000804';
  if n <> 1 then
    raise exception 'AC-10.1 SETUP FAILED: reviews fixture row did not plant';
  end if;

  select count(*) into n from public.review_requests where id = '00000000-0000-4000-8000-000000000805';
  if n <> 1 then
    raise exception 'AC-10.1 SETUP FAILED: review_requests fixture row did not plant';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.2 - payment_providers_admin_all: org admin sees the fixture row.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into n
  from public.payment_providers
  where id = '00000000-0000-4000-8000-000000000801';

  if n <> 1 then
    raise exception 'AC-10.2 FAILED: admin@ does not see the org payment_providers row, expected 1, got %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.3 - payment_providers_admin_all: a tech has no policy on this table
-- at all (bulk count + PK point lookup both zero).
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n from public.payment_providers;
  if n <> 0 then
    raise exception 'AC-10.3 FAILED: tech@ sees % payment_providers rows, expected 0 - table is admin-only', n;
  end if;

  select count(*) into leaked
  from public.payment_providers
  where id = '00000000-0000-4000-8000-000000000801';

  if leaked <> 0 then
    raise exception 'AC-10.3 FAILED: tech@ resolved the payment_providers row by id - point lookups bypass the admin-only gate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.4 - payments_admin_all: org admin sees the fixture payment.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into n
  from public.payments
  where id = '00000000-0000-4000-8000-000000000802';

  if n <> 1 then
    raise exception 'AC-10.4 FAILED: admin@ does not see the org payments row, expected 1, got %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.5 - payments_select_tech: tech@ (assigned to job ...601) sees the
-- fixture payment via the job_assignments join.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n
  from public.payments
  where id = '00000000-0000-4000-8000-000000000802';

  if n <> 1 then
    raise exception 'AC-10.5 FAILED: tech@ assigned to job ...601 does not see its payment row, expected 1, got %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.6 - payments_select_tech: an unassigned job's payment stays invisible
-- to a different tech (bulk count + PK point lookup both zero). Job ...603 is
-- in the same org but unassigned per seed.sql.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  leaked integer;
begin
  reset role;

  insert into public.payments (id, organization_id, job_id, provider_id, amount, status)
  values ('00000000-0000-4000-8000-000000000806', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000603', 'stripe', 200.00, 'pending')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n
  from public.payments
  where job_id = '00000000-0000-4000-8000-000000000603';

  if n <> 0 then
    raise exception 'AC-10.6 FAILED: tech@ sees % payments for unassigned job ...603, expected 0', n;
  end if;

  select count(*) into leaked
  from public.payments
  where id = '00000000-0000-4000-8000-000000000806';

  if leaked <> 0 then
    raise exception 'AC-10.6 FAILED: tech@ resolved the unassigned-job payment by id - point lookups bypass assignment gating';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.7 - payments_update_tech + payments_tech_confirm_whitelist_trg:
-- tech@ may set status -> manual_confirmed on their own assigned job's
-- payment (positive path through both the RLS policy and the trigger).
-- ---------------------------------------------------------------------------
do $$
declare
  new_status text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.payments
  set status = 'manual_confirmed', confirmed_at = now(), confirmed_by = '00000000-0000-4000-8000-000000000103'
  where id = '00000000-0000-4000-8000-000000000802';

  select status into new_status from public.payments where id = '00000000-0000-4000-8000-000000000802';

  if new_status is distinct from 'manual_confirmed' then
    raise exception 'AC-10.7 FAILED: tech@ own-assigned-job payment update did not apply, status is %', new_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.8 - payments_tech_confirm_whitelist_trg: a tech-role update to a
-- non-whitelisted column (amount) is rejected even on an own-assigned job.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    update public.payments
    set amount = 999.00
    where id = '00000000-0000-4000-8000-000000000802';

    raise exception 'AC-10.8 FAILED: tech@ updated amount on their own assigned job payment - column whitelist did not fire';
  exception
    when others then
      if sqlerrm not like 'payments: tech update may only set status%' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.9 - payments_update_tech: a tech cannot update an unassigned job's
-- payment at all (zero rows affected).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.payments
  set status = 'manual_confirmed'
  where id = '00000000-0000-4000-8000-000000000806';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-10.9 FAILED: tech@ updated % rows on the unassigned-job payment, expected 0', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.10 - handoff_tokens_admin_all: org admin sees the fixture token, a
-- tech sees none (bulk count + PK point lookup both zero) - no tech/customer
-- select policy exists on this table by design.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into n
  from public.handoff_tokens
  where id = '00000000-0000-4000-8000-000000000803';

  if n <> 1 then
    raise exception 'AC-10.10 FAILED: admin@ does not see the org handoff_tokens row, expected 1, got %', n;
  end if;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n from public.handoff_tokens;
  if n <> 0 then
    raise exception 'AC-10.10 FAILED: tech@ sees % handoff_tokens rows, expected 0 - table is admin-only', n;
  end if;

  select count(*) into leaked
  from public.handoff_tokens
  where id = '00000000-0000-4000-8000-000000000803';

  if leaked <> 0 then
    raise exception 'AC-10.10 FAILED: tech@ resolved the handoff_tokens row by id - point lookups bypass the admin-only gate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.11 - reviews_admin_all: org admin sees the fixture review. This is
-- the admin/anon layer only - the 0012 sales-facing reviews_select_sales and
-- reviews_update_sort_sales policies are covered by the 0012 suite.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into n
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000804';

  if n <> 1 then
    raise exception 'AC-10.11 FAILED: admin@ does not see the org reviews row, expected 1, got %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.12 - reviews_admin_all: an owner-role select of an unpublished
-- review with publish_ok = false still succeeds - the admin-all policy is
-- not gated by publish_ok (that gate belongs to 0012's sales-facing policy).
-- ---------------------------------------------------------------------------
do $$
declare
  is_published boolean;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  select publish_ok into is_published
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000804';

  if is_published is distinct from false then
    raise exception 'AC-10.12 FAILED: owner@ did not resolve the unpublished review row via reviews_admin_all';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.13 - reviews_admin_all: a tech has no policy on this table at all
-- (bulk count + PK point lookup both zero) - reviews is admin/anon/sales
-- only, tech is not a covered role.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n from public.reviews;
  if n <> 0 then
    raise exception 'AC-10.13 FAILED: tech@ sees % reviews rows, expected 0', n;
  end if;

  select count(*) into leaked
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000804';

  if leaked <> 0 then
    raise exception 'AC-10.13 FAILED: tech@ resolved the reviews row by id - point lookups bypass the RLS gate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.14 - reviews_insert_anon: an anon-role session (no authenticated
-- session at all, matching the real customer handoff-page flow) can insert a
-- review for a real job, and the row lands scoped to that job's org.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role anon;
  reset request.jwt.claims;

  insert into public.reviews (id, organization_id, job_id, rating, body, platform)
  values ('00000000-0000-4000-8000-000000000807', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000602', 4, 'Anon-submitted review', 'internal');

  reset role;

  select count(*) into n
  from public.reviews
  where id = '00000000-0000-4000-8000-000000000807'
    and organization_id = '00000000-0000-4000-8000-000000000001';

  if n <> 1 then
    raise exception 'AC-10.14 FAILED: anon insert via reviews_insert_anon did not land the expected row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.15 - reviews_insert_anon: an anon-role insert cannot select the row
-- back (no anon select policy) and cannot insert against a job_id that does
-- not correspond to any real job row.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  raised boolean := false;
begin
  set local role anon;
  reset request.jwt.claims;

  select count(*) into n from public.reviews;
  if n <> 0 then
    raise exception 'AC-10.15 FAILED: anon sees % reviews rows, expected 0 - no anon select policy exists', n;
  end if;

  begin
    insert into public.reviews (id, organization_id, job_id, rating, body, platform)
    values ('00000000-0000-4000-8000-000000000808', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-0000000000ff', 3, 'Forged job_id, no matching job row', 'internal');
  exception
    when others then
      raised := true;
  end;

  if not raised then
    raise exception 'AC-10.15 FAILED: anon insert with a non-matching job_id/organization_id pair was not rejected';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-10.16 - review_requests_admin_all: org admin sees the fixture row, a
-- tech sees none (bulk count + PK point lookup both zero) - state
-- transitions are server-side only, no tech/customer client policy exists.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into n
  from public.review_requests
  where id = '00000000-0000-4000-8000-000000000805';

  if n <> 1 then
    raise exception 'AC-10.16 FAILED: admin@ does not see the org review_requests row, expected 1, got %', n;
  end if;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n from public.review_requests;
  if n <> 0 then
    raise exception 'AC-10.16 FAILED: tech@ sees % review_requests rows, expected 0 - table is admin-only', n;
  end if;

  select count(*) into leaked
  from public.review_requests
  where id = '00000000-0000-4000-8000-000000000805';

  if leaked <> 0 then
    raise exception 'AC-10.16 FAILED: tech@ resolved the review_requests row by id - point lookups bypass the admin-only gate';
  end if;
end $$;

-- Nothing above is meant to persist. Roll every probe row back out.
rollback;
