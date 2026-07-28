-- Jobcore P1 — S3 · Foundation schema
-- Mirrors the frozen S1 contract in packages/core/src/index.ts.
-- TS is camelCase, the DB is snake_case: enabledModules <-> enabled_modules,
-- organizationId <-> organization_id, fullName <-> full_name, createdAt <-> created_at.
--
-- Apply order and test protocol: see README.md in this directory.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

-- Mirrors `Role = 'owner' | 'admin' | 'tech' | 'sales'`.
-- An enum (not a text CHECK) so adding a role later is a deliberate ALTER TYPE
-- migration rather than a silently-edited constraint.
create type public.user_role as enum ('owner', 'admin', 'tech', 'sales');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  -- Module ids enabled for this org. Consumed by getEnabledModules(org, role),
  -- which is fail-closed: absence here denies the module regardless of role.
  enabled_modules text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create table public.profiles (
  -- 1:1 with the Supabase auth user. Cascade so deleting an auth user cannot
  -- leave an orphaned profile that current_org_id() would still resolve.
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name       text not null,
  phone           text,
  role            public.user_role not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

create table public.audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Nullable and ON DELETE SET NULL: an audit row must survive the deletion of
  -- the actor it describes, otherwise the log deletes its own evidence.
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null,
  entity          text not null,
  entity_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_organization_id_created_at_idx
  on public.audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Tenancy helper
-- ---------------------------------------------------------------------------

-- Returns the calling user's organization_id.
--
-- security definer is REQUIRED, not stylistic: a policy on `profiles` that
-- reads `profiles` inline re-enters its own policy and Postgres raises
-- "infinite recursion detected in policy for relation profiles". Running as
-- the function owner bypasses RLS on this one internal read and breaks the cycle.
--
-- stable lets the planner evaluate it once per statement instead of once per row.
--
-- search_path is pinned EMPTY because security definer functions otherwise
-- inherit the caller's search_path, which is a privilege-escalation surface.
-- An empty path resolves nothing implicitly, so every reference in the body
-- must be schema-qualified (public.profiles, and auth.uid() below).
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.audit_log     enable row level security;

-- organizations — a member reads only their own org. No client-side insert or
-- delete: org provisioning is a service-role operation.
create policy organizations_select_own
  on public.organizations for select
  to authenticated
  using (id = public.current_org_id());

-- Only an owner may change org settings (including enabled_modules, which is
-- the module-visibility switch for the whole tenant).
create policy organizations_update_owner
  on public.organizations for update
  to authenticated
  using (
    id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (id = public.current_org_id());

-- profiles — every member sees the roster of their own org (needed for job
-- assignment), expressed through the helper so there is no recursion.
create policy profiles_select_own_org
  on public.profiles for select
  to authenticated
  using (organization_id = public.current_org_id());

-- A user may edit their own profile. WITH CHECK repeats the predicate so the
-- row cannot be moved to another org or reassigned to another user by the update.
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and organization_id = public.current_org_id());

-- Owners and admins manage the roster within their own org.
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  )
  with check (organization_id = public.current_org_id());

create policy profiles_insert_admin
  on public.profiles for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- audit_log — append-only from the client's perspective.
-- SELECT is org-scoped; INSERT is org-scoped and forces actor_id = auth.uid()
-- so a caller cannot forge a row attributed to someone else.
-- No UPDATE and no DELETE policy exists: with RLS enabled, the absence of a
-- policy is a denial, so the log is immutable to every authenticated client.
-- Retention/pruning is a service-role job, which bypasses RLS entirely.
create policy audit_log_select_own_org
  on public.audit_log for select
  to authenticated
  using (organization_id = public.current_org_id());

create policy audit_log_insert_own_org
  on public.audit_log for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and actor_id = auth.uid()
  );
