-- Jobcore P1 — Invitations + signup provisioning
--
-- Closes the bootstrap deadlock in 0001: `profiles_insert_admin` requires the
-- CALLER to already be an owner/admin of the target org, which a brand-new
-- signup never is. Nothing could ever insert the first profile for a user.
--
-- Model (chosen): signup CONFIRMS an invitation that an admin already extended
-- from the admin portal. There is no self-serve org creation and no NULL-org
-- window — `profiles.organization_id` is NOT NULL in 0001 and stays that way.
--
-- Apply after 0002. See README.md in this directory for apply order.

-- ---------------------------------------------------------------------------
-- 1. Invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Stored as entered; matched case-insensitively via the index below.
  email           text not null,
  -- The role the invitee will hold. Same enum as profiles.role, so an invite
  -- cannot grant a role the schema does not recognise.
  role            public.user_role not null,
  full_name       text not null,
  -- SET NULL, not cascade: revoking the inviter's account must not silently
  -- delete pending invitations they extended on the org's behalf.
  invited_by      uuid references auth.users (id) on delete set null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- One live invitation per email address. PARTIAL (where consumed_at is null)
-- so the same person can be re-invited after leaving — consumed rows stay as
-- an audit trail instead of being deleted to make room.
create unique index invitations_pending_email_idx
  on public.invitations (lower(email))
  where consumed_at is null;

create index invitations_organization_id_idx on public.invitations (organization_id);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.invitations enable row level security;

-- Members read their own org's invitations (the admin portal's pending list).
create policy invitations_select_own_org
  on public.invitations for select
  to authenticated
  using (organization_id = public.current_org_id());

-- Owners and admins extend invitations, scoped to their own org. The predicate
-- deliberately mirrors profiles_insert_admin in 0001: the same people who could
-- create a roster row are the people who can invite someone to become one.
create policy invitations_insert_admin
  on public.invitations for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- Revoking a pending invite is an UPDATE (stamp consumed_at) or a DELETE; both
-- are admin-only and org-scoped. No policy lets a client edit another org's row.
create policy invitations_update_admin
  on public.invitations for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  )
  with check (organization_id = public.current_org_id());

create policy invitations_delete_admin
  on public.invitations for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Unmatched signup attempts
-- ---------------------------------------------------------------------------

-- An auth user who signs up with no pending invitation gets no profile, so
-- there is nothing to hang an audit_log row off (audit_log.organization_id is
-- NOT NULL and the attempt belongs to no org). This table is that evidence:
-- it lets an admin see who tried and extend a real invitation.
create table public.signup_attempts (
  id           uuid primary key default gen_random_uuid(),
  -- The auth user DOES exist — the trigger returns new, it just never got a
  -- profile. Cascade so purging the orphan account purges its attempt row.
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text not null,
  attempted_at timestamptz not null default now()
);

create index signup_attempts_attempted_at_idx
  on public.signup_attempts (attempted_at desc);

-- RLS on, DELIBERATELY no policies. Every other policy in this schema scopes by
-- organization_id = current_org_id(); an unmatched signup belongs to no org, so
-- there is no tenant predicate to write and org-scoping it would be a lie.
-- With RLS enabled the absence of a policy is a denial, so the table is opaque
-- to every authenticated client. The admin portal reads it with the service
-- role, which bypasses RLS — same shape as audit_log's missing UPDATE/DELETE
-- policies in 0001. handle_new_user() can still insert because security definer
-- runs as the owner.
alter table public.signup_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Signup provisioning
-- ---------------------------------------------------------------------------

-- Runs on every new auth user and turns a pending invitation into a profile.
--
-- security definer is REQUIRED: the inserting "caller" is the brand-new user,
-- who satisfies neither profiles_insert_admin nor invitations_update_admin.
-- Running as owner bypasses RLS for this one provisioning step.
--
-- search_path is pinned EMPTY for the same reason as current_org_id() in 0001 —
-- a definer function must not inherit a caller-controlled resolution path.
-- Consequently EVERY identifier below is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.invitations%rowtype;
begin
  -- Newest unconsumed invitation wins if an admin somehow created several
  -- (the partial unique index makes that unreachable, but the order by keeps
  -- the behaviour deterministic rather than relying on the index to hold).
  select *
    into invite
    from public.invitations
   where lower(email) = lower(new.email)
     and consumed_at is null
   order by created_at desc
   limit 1;

  if invite.id is null then
    -- No invitation: log the attempt and let the auth user exist WITHOUT a
    -- profile. Chosen over `raise exception` because aborting the trigger also
    -- rolls back the auth.users insert, and Supabase surfaces that to the
    -- client as a raw "Database error saving new user" with nothing an admin
    -- can act on afterwards. This way the attempt is recoverable: an admin sees
    -- the row and extends an invitation.
    --
    -- Contract for the app: a signed-in user with no profile row is the orphan
    -- state. current_org_id() returns NULL for them and every RLS policy denies,
    -- so the client MUST detect the missing profile at session start and route
    -- them to an explanatory screen rather than an empty dashboard.
    insert into public.signup_attempts (user_id, email)
    values (new.id, new.email);

    return new;
  end if;

  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, invite.organization_id, invite.full_name, invite.role);

  update public.invitations
     set consumed_at = now()
   where id = invite.id;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
