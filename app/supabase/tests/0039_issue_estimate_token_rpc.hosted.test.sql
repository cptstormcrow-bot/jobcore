-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RPC assertions for 0039_issue_estimate_token_rpc.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0039 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS/SECURITY DEFINER org checks entirely and makes every assertion
-- below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- This suite covers public.issue_estimate_token(p_job_id uuid):
--   AC-39.1 - admin@ (org 1) issuing a token for an org-1 job succeeds,
--     returns a non-null token text, and inserts a matching estimate_tokens
--     row (job_id, ~14-day expires_at).
--   AC-39.2 - admin@ (org 1) attempting to issue a token for a job owned by
--     a second, synthetic org is rejected (org-scoping enforced via
--     public.current_org_id()).

begin;

-- ---------------------------------------------------------------------------
-- Fixture plant - all under `reset role` first (the falsifiability gate).
-- Org C (a synthetic second organization + one job row, mirroring the
-- 0013-suite Org B tenant-boundary pattern) exercises the cross-org rejection
-- probe.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000c3', 'Org C - estimate token isolation probe', 'org-c-estimate-token-probe')
  on conflict (id) do nothing;

  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000006c3', '00000000-0000-4000-8000-0000000000c3', 'new')
  on conflict (id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- AC-39.1 - issue_estimate_token: admin@ (org 1) issues a token for an
-- org-1 job (...000601). Returns a non-null token, and a matching
-- estimate_tokens row now exists with the correct job_id and an expiry
-- ~14 days out.
-- ---------------------------------------------------------------------------
do $$
declare
  v_token   text;
  v_job_id  uuid;
  v_expires timestamptz;
  v_days    numeric;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select public.issue_estimate_token('00000000-0000-4000-8000-000000000601') into v_token;

  if v_token is null or v_token = '' then
    raise exception 'AC-39.1 FAILED: issue_estimate_token returned null/empty token for an own-org job';
  end if;

  select job_id, expires_at into v_job_id, v_expires
  from public.estimate_tokens
  where token = v_token;

  if v_job_id is null then
    raise exception 'AC-39.1 FAILED: no estimate_tokens row found for the returned token';
  end if;

  if v_job_id <> '00000000-0000-4000-8000-000000000601' then
    raise exception 'AC-39.1 FAILED: estimate_tokens row job_id = %, expected 00000000-0000-4000-8000-000000000601', v_job_id;
  end if;

  v_days := extract(epoch from (v_expires - now())) / 86400.0;

  if v_days < 13.9 or v_days > 14.1 then
    raise exception 'AC-39.1 FAILED: estimate_tokens expires_at is % days out, expected ~14', v_days;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-39.2 - issue_estimate_token: org-scoping. admin@ (org 1) attempting to
-- issue a token for the Org C job is rejected - the function's
-- public.current_org_id() check raises rather than silently succeeding.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  begin
    perform public.issue_estimate_token('00000000-0000-4000-8000-0000000006c3');

    raise exception 'AC-39.2 FAILED: admin@ (org 1) issued a token for a job owned by another org - org-scoping is not enforced';
  exception
    when others then
      if sqlerrm like 'AC-39.2 FAILED%' then
        raise;
      end if;
      -- Expected: the function's own `raise exception` for cross-org access.
  end;
end $$;

-- Nothing above is meant to persist. Roll the probe org, job, and tokens back out.
rollback;
