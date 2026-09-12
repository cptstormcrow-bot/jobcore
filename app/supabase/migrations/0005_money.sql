-- Jobcore P3 - admin/finance money core
-- Apply after 0004.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

-- Lifecycle of a published rate/price document. An enum (not a text CHECK) so
-- adding a status later is a deliberate ALTER TYPE migration rather than a
-- silently-edited constraint.
create type public.publication_status as enum (
  'draft',
  'published',
  'superseded'
);

-- Lifecycle of a technician/employee reimbursement request. An enum (not a
-- text CHECK) so adding a status later is a deliberate ALTER TYPE migration
-- rather than a silently-edited constraint.
create type public.reimbursement_status as enum (
  'pending',
  'approved',
  'rejected',
  'paid'
);

-- Lifecycle of a payout batch. An enum (not a text CHECK) so adding a status
-- later is a deliberate ALTER TYPE migration rather than a silently-edited
-- constraint.
create type public.payout_batch_status as enum (
  'draft',
  'approved',
  'paid'
);

-- ---------------------------------------------------------------------------
-- 2. Tenancy helper
-- ---------------------------------------------------------------------------

-- Returns true when the calling user is an owner or admin in their own
-- organization.
--
-- security definer is REQUIRED, not stylistic: a policy that reads
-- `profiles` inline re-enters its own policy and Postgres raises
-- "infinite recursion detected in policy for relation profiles". Running as
-- the function owner bypasses RLS on this one internal read and breaks the cycle.
--
-- stable lets the planner evaluate it once per statement instead of once per row.
--
-- search_path is pinned EMPTY because security definer functions otherwise
-- inherit the caller's search_path, which is a privilege-escalation surface.
-- An empty path resolves nothing implicitly, so every reference in the body
-- must be schema-qualified (public.profiles, and auth.uid() below).
create or replace function public.is_org_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_org_admin() from public;
grant execute on function public.is_org_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- One published price sheet per organization at a time; drafts and superseded
-- versions may coexist, but only one row per org may hold status = 'published'
-- (enforced below by a partial unique index, not a CHECK, since a CHECK cannot
-- see other rows).
create table public.price_sheets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version         integer not null,
  effective_from  date,
  published_at    timestamptz,
  status          public.publication_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint price_sheets_organization_id_version_key unique (organization_id, version)
);

create index price_sheets_organization_id_idx on public.price_sheets (organization_id);

create unique index price_sheets_one_published_idx on public.price_sheets (organization_id)
  where status = 'published';

-- attach_timing intentionally admits NULL: hero_quick leads seed with no
-- attach_timing set. 'before_start' is included alongside the spec pair
-- at_purchase/after_the_fact because it is the only value actually present
-- in seed.sql; do not narrow this set later without checking seed data first.
create table public.price_sheet_rates (
  id             uuid primary key default gen_random_uuid(),
  price_sheet_id uuid not null references public.price_sheets (id) on delete cascade,
  service_id     uuid not null references public.services (id) on delete cascade,
  attach_timing  text,
  amount_cents   integer not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint price_sheet_rates_attach_timing_check
    check (attach_timing is null or attach_timing in ('at_purchase', 'after_the_fact', 'before_start'))
);

create index price_sheet_rates_price_sheet_id_idx on public.price_sheet_rates (price_sheet_id);
create index price_sheet_rates_service_id_idx on public.price_sheet_rates (service_id);

create unique index price_sheet_rates_sheet_service_timing_idx
  on public.price_sheet_rates (price_sheet_id, service_id, attach_timing);

-- A tech's or sales rep's pay-rule configuration. Column names/units mirror
-- CompensationPolicy in modules/admin-finance/src/money/types.ts:
-- hourlyRate is Money (integer cents) -> hourly_rate_cents; commissionBasisPercent
-- is a plain percent number -> commission_basis_percent (numeric, not basis points).
create table public.compensation_policies (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  name                     text not null,
  hourly_rate_cents        integer,
  commission_basis_percent numeric,
  bonus_rule               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index compensation_policies_organization_id_idx on public.compensation_policies (organization_id);

-- One commission line per job. price_sheet_id and compensation_policy_id are
-- SNAPSHOT foreign keys per Master Spec section 9: a later re-publish of
-- either must never retroactively move historical pay, so both are
-- not null and on delete restrict. Mirrors CommissionLine in
-- modules/admin-finance/src/money/types.ts.
create table public.commissions (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  job_id                  uuid not null references public.jobs (id) on delete restrict,
  user_id                 uuid not null references public.profiles (id) on delete restrict,
  price_sheet_id          uuid not null references public.price_sheets (id) on delete restrict,
  compensation_policy_id  uuid not null references public.compensation_policies (id) on delete restrict,
  amount_cents            integer not null,
  voided_at               timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index commissions_organization_id_idx on public.commissions (organization_id);
create index commissions_job_id_idx on public.commissions (job_id);
create index commissions_user_id_idx on public.commissions (user_id);
create index commissions_price_sheet_id_idx on public.commissions (price_sheet_id);
create index commissions_compensation_policy_id_idx on public.commissions (compensation_policy_id);

-- Only one active (non-voided) commission per job.
create unique index commissions_one_per_job_idx on public.commissions (job_id) where voided_at is null;

-- A technician/employee reimbursement request. job_id is nullable because not
-- every reimbursement ties to a job (e.g. a general supply purchase).
-- receipt_photo_path is a reference to a stored receipt photo, not the photo
-- itself. SPEC: a reimbursement is never a deduction against commission - do
-- not add a column linking it to a commission row.
create table public.reimbursements (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete restrict,
  job_id              uuid references public.jobs (id) on delete restrict,
  amount_cents        integer not null,
  description         text,
  receipt_photo_path  text,
  status              public.reimbursement_status not null default 'pending',
  approved_by         uuid references public.profiles (id),
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index reimbursements_organization_id_idx on public.reimbursements (organization_id);
create index reimbursements_user_id_idx on public.reimbursements (user_id);
create index reimbursements_job_id_idx on public.reimbursements (job_id);

-- A batch of payouts covering a pay period for an organization.
create table public.payout_batches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  status          public.payout_batch_status not null default 'draft',
  approved_by     uuid references public.profiles (id),
  approved_at     timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index payout_batches_organization_id_idx on public.payout_batches (organization_id);

-- One payout line per user per batch. total_amount is enforced to equal the
-- sum of its component amounts by a CHECK constraint, since a CHECK cannot
-- see other rows but can see other columns in the same row.
create table public.payout_lines (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  payout_batch_id       uuid not null references public.payout_batches (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete restrict,
  hours_amount          integer not null default 0,
  commission_amount     integer not null default 0,
  bonus_amount          integer not null default 0,
  reimbursement_amount  integer not null default 0,
  total_amount          integer not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payout_lines_total_amount_check
    check (total_amount = hours_amount + commission_amount + bonus_amount + reimbursement_amount)
);

create index payout_lines_organization_id_idx on public.payout_lines (organization_id);
create index payout_lines_payout_batch_id_idx on public.payout_lines (payout_batch_id);
create index payout_lines_user_id_idx on public.payout_lines (user_id);

-- ---------------------------------------------------------------------------
-- 4. Immutability triggers
-- ---------------------------------------------------------------------------

-- A price sheet is versioned and immutable once published: editing a
-- published sheet must create a new draft version, never mutate rows in
-- place, so that historical pay never moves when a sheet is re-published.
-- Rows in 'draft' status are freely mutable. The single exception is the
-- publish transition itself, which the publish_price_sheet(uuid) RPC
-- (shipped in the next migration slice) performs by flipping the prior
-- published row's status to 'superseded' and nothing else - that specific
-- status-only published -> superseded transition is permitted here so the
-- RPC does not need to bypass this trigger.
create or replace function public.price_sheets_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'price_sheets: cannot delete a % price sheet (id=%)', old.status, old.id;
    end if;
    return old;
  end if;

  -- tg_op = 'UPDATE'
  if old.status = 'draft' then
    return new;
  end if;

  if old.status = 'published' and new.status = 'superseded'
     and new.id = old.id
     and new.organization_id = old.organization_id
     and new.version = old.version
     and new.effective_from is not distinct from old.effective_from
     and new.published_at is not distinct from old.published_at
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'price_sheets: cannot modify a % price sheet (id=%)', old.status, old.id;
end;
$$;

create trigger price_sheets_immutable_trg
  before update or delete on public.price_sheets
  for each row execute function public.price_sheets_immutable();

-- A price sheet's rate lines are immutable once the parent price sheet
-- leaves 'draft' status. Publishing a sheet closes its rates; a correction
-- to a published sheet's rates must go into a new draft version's rates,
-- never mutate the published rows.
create or replace function public.price_sheet_rates_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.publication_status;
begin
  select status into v_status
  from public.price_sheets
  where id = old.price_sheet_id;

  if v_status is distinct from 'draft' then
    raise exception 'price_sheet_rates: cannot modify a rate on a % price sheet (price_sheet_id=%)',
      v_status, old.price_sheet_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger price_sheet_rates_immutable_trg
  before update or delete on public.price_sheet_rates
  for each row execute function public.price_sheet_rates_immutable();

-- A commission row is immutable once created, since it is the historical
-- record of what a job actually paid a user against a snapshotted price
-- sheet and compensation policy. The one correction mechanism is voiding:
-- setting voided_at (and only voided_at) is permitted. Deletion is never
-- permitted; a mistaken commission is voided, not removed.
create or replace function public.commissions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'commissions: cannot delete a commission (id=%); void it instead', old.id;
  end if;

  -- tg_op = 'UPDATE'
  if new.id = old.id
     and new.organization_id = old.organization_id
     and new.job_id = old.job_id
     and new.user_id = old.user_id
     and new.price_sheet_id = old.price_sheet_id
     and new.compensation_policy_id = old.compensation_policy_id
     and new.amount_cents = old.amount_cents
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'commissions: only voided_at may be set on an existing commission (id=%)', old.id;
end;
$$;

create trigger commissions_immutable_trg
  before update or delete on public.commissions
  for each row execute function public.commissions_immutable();

-- A payout line is immutable once its parent payout batch leaves 'draft'
-- status. Approving or paying a batch closes its lines; a correction must
-- go into a new draft batch's lines, never mutate the approved/paid rows.
create or replace function public.payout_lines_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.payout_batch_status;
begin
  select status into v_status
  from public.payout_batches
  where id = old.payout_batch_id;

  if v_status is distinct from 'draft' then
    raise exception 'payout_lines: cannot modify a line on a % payout batch (payout_batch_id=%)',
      v_status, old.payout_batch_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger payout_lines_immutable_trg
  before update or delete on public.payout_lines
  for each row execute function public.payout_lines_immutable();

-- ---------------------------------------------------------------------------
-- 5. Publish RPC
-- ---------------------------------------------------------------------------

-- Publishes a draft price sheet: stamps published_at, supersedes the prior
-- published sheet (if any) for the same organization, and increments
-- version. Statement order matters - the prior published row is demoted to
-- 'superseded' BEFORE the target row is promoted to 'published', so the
-- partial unique index price_sheets_one_published_idx (one published row
-- per organization) is never violated at any point.
--
-- The demote-only UPDATE below sets status alone, matching exactly the one
-- permitted published -> superseded transition carved out by the
-- price_sheets_immutable_trg trigger above. The promote UPDATE targets a
-- 'draft' row, which that trigger admits unconditionally.
--
-- security definer, stable search_path, and full schema-qualification
-- follow the same rationale as public.is_org_admin() above.
create or replace function public.publish_price_sheet(p_price_sheet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.price_sheets;
  v_prior  public.price_sheets;
  v_new_version integer;
begin
  if not public.is_org_admin() then
    raise exception 'publish_price_sheet: caller is not an org admin';
  end if;

  select *
  into v_target
  from public.price_sheets
  where id = p_price_sheet_id
  for update;

  if not found then
    raise exception 'publish_price_sheet: price sheet not found (id=%)', p_price_sheet_id;
  end if;

  if v_target.organization_id <> public.current_org_id() then
    raise exception 'publish_price_sheet: price sheet does not belong to caller organization (id=%)', p_price_sheet_id;
  end if;

  if v_target.status <> 'draft' then
    raise exception 'publish_price_sheet: price sheet is not a draft (id=%, status=%)', p_price_sheet_id, v_target.status;
  end if;

  select *
  into v_prior
  from public.price_sheets
  where organization_id = v_target.organization_id
    and status = 'published'
  for update;

  if found then
    update public.price_sheets
    set status = 'superseded'
    where id = v_prior.id;

    if v_target.version > v_prior.version then
      v_new_version := v_target.version;
    else
      v_new_version := v_prior.version + 1;
    end if;
  else
    v_new_version := v_target.version;
  end if;

  update public.price_sheets
  set status = 'published',
      published_at = now(),
      version = v_new_version
  where id = v_target.id;
end;
$$;

revoke all on function public.publish_price_sheet(uuid) from public;
grant execute on function public.publish_price_sheet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------

alter table public.price_sheets enable row level security;
alter table public.price_sheet_rates enable row level security;
alter table public.compensation_policies enable row level security;
alter table public.commissions enable row level security;
alter table public.reimbursements enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_lines enable row level security;

-- price_sheets - admin-only in every direction. A non-admin caller (e.g. a
-- tech) must see zero rows; there is no non-admin select policy at all, and
-- with RLS enabled the absence of a policy is a denial.
create policy price_sheets_admin_all
  on public.price_sheets for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- price_sheet_rates carries no organization_id of its own, so scope is
-- established by joining up to the parent price_sheets row.
create policy price_sheet_rates_admin_all
  on public.price_sheet_rates for all
  to authenticated
  using (
    public.is_org_admin()
    and exists (
      select 1 from public.price_sheets p
      where p.id = price_sheet_rates.price_sheet_id
        and p.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_org_admin()
    and exists (
      select 1 from public.price_sheets p
      where p.id = price_sheet_rates.price_sheet_id
        and p.organization_id = public.current_org_id()
    )
  );

-- compensation_policies - admin-only in every direction.
create policy compensation_policies_admin_all
  on public.compensation_policies for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- commissions - admin-only in every direction. A commissioned user does not
-- get a self-select policy here; commission visibility for the earner is a
-- product decision for a later slice, not implied by this migration.
create policy commissions_admin_all
  on public.commissions for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- reimbursements - org admins get full access. A non-admin user may select
-- and insert only their own rows within their own org, and may never update
-- or delete them once submitted (no such policy exists for a non-admin, so
-- it is denied); approval columns are therefore admin-only by virtue of
-- update being admin-only.
create policy reimbursements_admin_all
  on public.reimbursements for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy reimbursements_select_own
  on public.reimbursements for select
  to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy reimbursements_insert_own
  on public.reimbursements for insert
  to authenticated
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

-- payout_batches - admin-only in every direction.
create policy payout_batches_admin_all
  on public.payout_batches for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- payout_lines - admin-only in every direction.
create policy payout_lines_admin_all
  on public.payout_lines for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
