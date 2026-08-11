-- Jobcore - RLS assertions for 0003_invitations_and_signup.sql (invitations + signup_attempts)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0004 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.

begin;

-- ---------------------------------------------------------------------------
-- AC-INV.1 - invitations_select_own_org. A cross-org synthetic invitation is
-- planted (org B, via `reset role`) alongside a same-org one. owner@ must see
-- only the org A row.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  seen_id uuid;
begin
  reset role;

  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b4', 'Org B - invitations isolation probe')
  on conflict (id) do nothing;

  insert into public.invitations (id, organization_id, email, role, full_name)
  values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001',
          'invitee-a@example.com', 'tech', 'Invitee A')
  on conflict (id) do nothing;

  insert into public.invitations (id, organization_id, email, role, full_name)
  values ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-0000000000b4',
          'invitee-b@example.com', 'tech', 'Invitee B')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  select count(*) into n from public.invitations;

  if n <> 1 then
    raise exception 'AC-INV.1 FAILED: owner@ sees % invitations rows, expected exactly 1 - org B leaked across the tenant boundary', n;
  end if;

  select id into seen_id from public.invitations limit 1;

  if seen_id is distinct from '00000000-0000-4000-8000-000000000401'::uuid then
    raise exception 'AC-INV.1 FAILED: owner@ sees invitation %, expected the org A fixture ...0401', seen_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.1b - the org B invitation is invisible to a direct primary-key
-- lookup as well as the bulk select above.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  select count(*) into leaked
  from public.invitations
  where id = '00000000-0000-4000-8000-000000000402';

  if leaked <> 0 then
    raise exception 'AC-INV.1b FAILED: owner@ resolved the org B invitation by id - point lookups bypass the tenant boundary';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2 - invitations_insert_admin (positive). owner@ extends a new
-- invitation scoped to their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  insert into public.invitations (id, organization_id, email, role, full_name)
  values ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001',
          'invitee-c@example.com', 'sales', 'Invitee C');

  select count(*) into n
  from public.invitations
  where id = '00000000-0000-4000-8000-000000000403';

  if n <> 1 then
    raise exception 'AC-INV.2 FAILED: owner@ insert did not land, expected 1 visible row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2b - invitations_insert_admin (negative, non-admin role). tech@ may
-- not extend an invitation at all - the predicate requires owner/admin.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.invitations (id, organization_id, email, role, full_name)
    values ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001',
            'invitee-d@example.com', 'tech', 'Invitee D');

    raise exception 'AC-INV.2b FAILED: tech@ inserted an invitation - only owner/admin may extend one';
  exception
    when insufficient_privilege then
      null; -- expected: WITH CHECK denies
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2c - invitations_insert_admin (negative, cross-org). owner@ may not
-- extend an invitation scoped to another organization.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  begin
    insert into public.invitations (id, organization_id, email, role, full_name)
    values ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-0000000000b4',
            'invitee-e@example.com', 'tech', 'Invitee E');

    raise exception 'AC-INV.2c FAILED: owner@ inserted an invitation into org B - the organization_id predicate did not hold';
  exception
    when insufficient_privilege then
      null; -- expected: WITH CHECK denies
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.3 - invitations_update_admin (positive). owner@ stamps the org A
-- fixture consumed.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  update public.invitations
     set consumed_at = now()
   where id = '00000000-0000-4000-8000-000000000401';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-INV.3 FAILED: owner@ update affected % rows, expected exactly 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.3b - invitations_update_admin (negative, non-admin role). tech@'s
-- update of the same org A row is a 0-row-affected no-op, not an error - the
-- USING clause simply filters the row out.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  update public.invitations
     set consumed_at = now()
   where id = '00000000-0000-4000-8000-000000000403';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.3b FAILED: tech@ update affected % rows, expected exactly 0 - update-admin gating did not apply', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.3c - invitations_update_admin (negative, cross-org). owner@ (org A)
-- cannot update the org B fixture.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  update public.invitations
     set consumed_at = now()
   where id = '00000000-0000-4000-8000-000000000402';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.3c FAILED: owner@ update affected % org B rows, expected exactly 0 - the tenant boundary did not hold on UPDATE', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.4 - invitations_delete_admin (positive). owner@ revokes the org A
-- fixture ...0403 by deleting it.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

  delete from public.invitations where id = '00000000-0000-4000-8000-000000000403';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-INV.4 FAILED: owner@ delete affected % rows, expected exactly 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.4b - invitations_delete_admin (negative, non-admin role). tech@'s
-- delete of the remaining org A fixture ...0401 is a 0-row-affected no-op.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  delete from public.invitations where id = '00000000-0000-4000-8000-000000000401';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.4b FAILED: tech@ delete affected % rows, expected exactly 0 - delete-admin gating did not apply', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.5 - signup_attempts is RLS-enabled with deliberately zero policies.
-- Policy-count canary, mirroring audit_log's missing UPDATE/DELETE policies.
-- ---------------------------------------------------------------------------
do $$
declare
  n_policies integer;
begin
  select count(*) into n_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'signup_attempts';

  if n_policies <> 0 then
    raise exception 'AC-INV.5 FAILED: signup_attempts has % policies, expected exactly 0 - the deliberate absence-is-denial contract was broken', n_policies;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.5b - with zero policies and RLS enabled, a planted signup_attempts
-- row stays invisible to every authenticated client, including the tech
-- named as its own user_id.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  reset role;

  insert into public.signup_attempts (id, user_id, email)
  values ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000103', 'uninvited@example.com')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into n
  from public.signup_attempts
  where id = '00000000-0000-4000-8000-000000000406';

  if n <> 0 then
    raise exception 'AC-INV.5b FAILED: tech@ (the row''s own user_id) resolved a signup_attempts row - the no-policy-is-denial contract was broken';
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org back out.
rollback;
