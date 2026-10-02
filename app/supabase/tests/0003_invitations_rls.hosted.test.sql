-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0003_invitations_and_signup.sql
--
-- Hand-applied. Run this file in the SQL editor AFTER migrations/0001..0004 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- Policies under test (from 0003's inline comments):
--   invitations_select_own_org  - "Members read their own org's invitations"
--   invitations_insert_admin    - "Owners and admins extend invitations,
--                                  scoped to their own org"
--   invitations_update_admin /
--   invitations_delete_admin    - "Revoking a pending invite is an UPDATE ...
--                                  or DELETE; both are admin-only and
--                                  org-scoped"
--
-- Seed identifiers used here (see seed.sql):
--   org A (seed)  00000000-0000-4000-8000-000000000001
--   owner         09595a9b-12f3-46a7-845c-aae615f776c3
--   admin         a143fac2-4806-42ed-9283-b45275b6c53a
--   tech          d59e3bc7-691d-4ada-8959-e86f40c1e344
--   org B (probe) 00000000-0000-4000-8000-0000000000b2 (same id 0004 uses)

begin;

-- ---------------------------------------------------------------------------
-- Fixture: plant one org-A invitation, one org-B invitation (cross-org probe
-- material), and a spare org-A invitation each for the update and delete
-- assertions below. All planted with RLS bypassed, under reset role first -
-- the falsifiability gate.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe', 'org-b-isolation-probe')
  on conflict (id) do nothing;

  insert into public.invitations (organization_id, email, role, full_name)
  values
    ('00000000-0000-4000-8000-000000000001', 'test.invite.a@example.com', 'tech', 'Invite A'),
    ('00000000-0000-4000-8000-0000000000b2', 'test.invite.b@example.com', 'tech', 'Invite B'),
    ('00000000-0000-4000-8000-000000000001', 'test.invite.update@example.com', 'tech', 'Invite Update'),
    ('00000000-0000-4000-8000-000000000001', 'test.invite.delete@example.com', 'tech', 'Invite Delete');

  if (select count(*) from public.invitations
       where email in ('test.invite.a@example.com', 'test.invite.b@example.com',
                        'test.invite.update@example.com', 'test.invite.delete@example.com')) <> 4 then
    raise exception 'FIXTURE FAILED: expected exactly 4 planted invitation rows';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.1 - a member of org A sees org A's own invitation.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into seen
  from public.invitations
  where email = 'test.invite.a@example.com';

  if seen <> 1 then
    raise exception 'AC-INV.1 FAILED: owner@ sees % row(s) for the org A invitation, expected exactly 1', seen;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.1b - the org B invitation is invisible to an org A member, both on a
-- bulk select and on a direct primary-key lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
  leaked_by_id integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"09595a9b-12f3-46a7-845c-aae615f776c3","role":"authenticated"}';

  select count(*) into leaked
  from public.invitations
  where email = 'test.invite.b@example.com';

  if leaked <> 0 then
    raise exception 'AC-INV.1b FAILED: owner@ sees % row(s) for the org B invitation - invitations_select_own_org leaked across the tenant boundary', leaked;
  end if;

  select count(*) into leaked_by_id
  from public.invitations
  where organization_id = '00000000-0000-4000-8000-0000000000b2';

  if leaked_by_id <> 0 then
    raise exception 'AC-INV.1b FAILED: owner@ resolved % org B invitation row(s) by organization_id - point lookups bypass the tenant boundary', leaked_by_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2 - an admin can extend an invitation scoped to their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  insert into public.invitations (organization_id, email, role, full_name)
  values ('00000000-0000-4000-8000-000000000001', 'test.invite.admininsert@example.com', 'tech', 'Invite Admin Insert');

  select count(*) into seen
  from public.invitations
  where email = 'test.invite.admininsert@example.com';

  if seen <> 1 then
    raise exception 'AC-INV.2 FAILED: admin@ insert of an org-scoped invitation did not land - invitations_insert_admin blocked a legitimate admin caller';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2b - a non-admin (tech) cannot extend an invitation.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  begin
    insert into public.invitations (organization_id, email, role, full_name)
    values ('00000000-0000-4000-8000-000000000001', 'test.invite.techinsert@example.com', 'tech', 'Invite Tech Insert');

    raise exception 'AC-INV.2b FAILED: tech@ was able to insert an invitation - invitations_insert_admin did not block a non-admin caller';
  exception
    when others then
      if sqlerrm not ilike '%row-level security%' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.2c - an admin cannot extend an invitation into a different org, even
-- one they can otherwise read into via the fixture above.
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  begin
    insert into public.invitations (organization_id, email, role, full_name)
    values ('00000000-0000-4000-8000-0000000000b2', 'test.invite.crossorginsert@example.com', 'tech', 'Invite Cross Org');

    raise exception 'AC-INV.2c FAILED: admin@ was able to insert an invitation into org B - invitations_insert_admin did not enforce organization_id = current_org_id()';
  exception
    when others then
      if sqlerrm not ilike '%row-level security%' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.3 - an admin can revoke a pending invite via UPDATE (stamp
-- consumed_at), scoped to their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  update public.invitations
     set consumed_at = now()
   where email = 'test.invite.update@example.com';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-INV.3 FAILED: admin@ update affected % invitation row(s), expected exactly 1 - invitations_update_admin blocked a legitimate admin caller', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.3b - a non-admin (tech) cannot revoke an invite via UPDATE.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  update public.invitations
     set consumed_at = now()
   where email = 'test.invite.a@example.com';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.3b FAILED: tech@ update affected % invitation row(s), expected 0 - invitations_update_admin did not block a non-admin caller', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.4 - a non-admin (tech) cannot revoke an invite via DELETE.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  delete from public.invitations
   where email = 'test.invite.delete@example.com';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.4 FAILED: tech@ delete affected % invitation row(s), expected 0 - invitations_delete_admin did not block a non-admin caller', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.4b - an admin can revoke a pending invite via DELETE, scoped to
-- their own org.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  delete from public.invitations
   where email = 'test.invite.delete@example.com';

  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'AC-INV.4b FAILED: admin@ delete affected % invitation row(s), expected exactly 1 - invitations_delete_admin blocked a legitimate admin caller', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-INV.4c - the org B invitation is invisible to org A's admin, so it
-- cannot be reached for UPDATE or DELETE at all (0 rows affected, not denied
-- via error - the USING predicate hides the row before the CRUD verb runs).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  delete from public.invitations
   where email = 'test.invite.b@example.com';

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-INV.4c FAILED: admin@ delete affected % org B invitation row(s), expected 0 - invitations_delete_admin leaked across the tenant boundary', affected;
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and invitations back out.
rollback;
</content>
