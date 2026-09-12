-- Jobcore P5 — payment + review
-- Apply after 0009.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Org-level configuration for which payment providers are enabled and how
-- they are addressed (a handle, a publishable key). config NEVER holds a
-- secret key or any card data — only client-safe identifiers a provider's
-- own hosted flow needs to resolve a payment link.
create table public.payment_providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_id     text not null,
  enabled         boolean not null default true,
  config          jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payment_providers_organization_id_provider_id_key
    unique (organization_id, provider_id)
);

create index payment_providers_organization_id_idx on public.payment_providers (organization_id);

-- The payment record for a job. This table (and every column on it) may
-- NEVER hold a card number, a PAN, a CVV, or any token that could be one —
-- not now, not later, no exceptions. That constraint is enforced by naming
-- convention and a repo-wide grep check (P5 acceptance criterion 6), not by
-- a DB constraint: external_ref is a webhook/provider transaction reference
-- only (e.g. a Stripe PaymentIntent id), never raw payment-instrument data.
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  provider_id     text not null,
  amount          numeric(10,2) not null,
  status          text not null default 'pending',
  external_ref    text,
  confirmed_at    timestamptz,
  confirmed_by    uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint payments_status_check
    check (status in ('pending', 'confirmed', 'failed', 'manual_confirmed'))
);

create index payments_organization_id_idx on public.payments (organization_id);
create index payments_job_id_idx on public.payments (job_id);

-- Signed, expiring, single-job-scoped QR handoff tokens used to hand a
-- customer from the tech's device to a public payment/review page.
create table public.handoff_tokens (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid not null references public.jobs (id) on delete cascade,
  token           text not null unique,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index handoff_tokens_organization_id_idx on public.handoff_tokens (organization_id);
create index handoff_tokens_job_id_idx on public.handoff_tokens (job_id);
create index handoff_tokens_token_idx on public.handoff_tokens (token);

-- A customer-submitted review for a job. This table is intentionally NOT
-- tied to commissions or payout_lines by any FK or trigger — a review's
-- existence must have zero effect on any commission/bonus/payout row (P5
-- acceptance criterion 8).
create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  job_id              uuid not null references public.jobs (id) on delete cascade,
  rating              integer not null,
  body                text,
  author_display_name text,
  platform            text not null default 'internal',
  submitted_at        timestamptz not null default now(),
  publish_ok          boolean not null default false,
  constraint reviews_rating_check
    check (rating between 1 and 5),
  constraint reviews_platform_check
    check (platform in ('internal', 'google', 'facebook', 'other'))
);

create index reviews_organization_id_idx on public.reviews (organization_id);
create index reviews_job_id_idx on public.reviews (job_id);

-- Tracks the state of the post-job payment/review handoff flow for a job,
-- linking back to the handoff_tokens row that drove it (if any).
create table public.review_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete cascade,
  handoff_token_id uuid references public.handoff_tokens (id) on delete set null,
  sent_at          timestamptz not null default now(),
  state            text not null default 'awaiting_payment',
  constraint review_requests_state_check
    check (state in ('awaiting_payment', 'confirming', 'review', 'done'))
);

create index review_requests_organization_id_idx on public.review_requests (organization_id);
create index review_requests_job_id_idx on public.review_requests (job_id);

-- ---------------------------------------------------------------------------
-- 2. payments: tech column-whitelist trigger
-- ---------------------------------------------------------------------------

-- A tech-role update to payments may only mark their own assigned job's
-- payment manually confirmed: status -> 'manual_confirmed', plus
-- confirmed_at/confirmed_by. Any other column change originating from a
-- non-admin caller is rejected, mirroring jobs_tech_update_whitelist() in
-- 0008. public.is_org_admin() (defined in 0005) distinguishes the actor: an
-- owner/admin caller is NOT restricted by this trigger.
create or replace function public.payments_tech_confirm_whitelist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_org_admin() then
    return new;
  end if;

  if new.id = old.id
     and new.organization_id = old.organization_id
     and new.job_id = old.job_id
     and new.provider_id = old.provider_id
     and new.amount = old.amount
     and new.external_ref is not distinct from old.external_ref
     and new.created_at = old.created_at
     and new.status = 'manual_confirmed'
  then
    return new;
  end if;

  raise exception 'payments: tech update may only set status to manual_confirmed, confirmed_at, confirmed_by (id=%)', old.id;
end;
$$;

create trigger payments_tech_confirm_whitelist_trg
  before update on public.payments
  for each row execute function public.payments_tech_confirm_whitelist();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.payment_providers enable row level security;
alter table public.payments enable row level security;
alter table public.handoff_tokens enable row level security;
alter table public.reviews enable row level security;
alter table public.review_requests enable row level security;

-- payment_providers: admin-only. Provider enablement/config is an
-- organization-settings concern, never tech- or customer-facing.
create policy payment_providers_admin_all
  on public.payment_providers for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- payments: org admins get full read/write within their own organization. A
-- tech may select payments only for jobs they are assigned to, resolved
-- through job_assignments, mirroring checklist_instances_select_tech in
-- 0007/0008. Tech UPDATE is granted by the same join shape as
-- jobs_update_tech in 0008; the payments_tech_confirm_whitelist_trg trigger
-- above narrows which columns and which status value a tech-role update may
-- actually apply.
create policy payments_admin_all
  on public.payments for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy payments_select_tech
  on public.payments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = payments.job_id
        and ja.tech_id = auth.uid()
    )
  );

create policy payments_update_tech
  on public.payments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = payments.job_id
        and ja.tech_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = payments.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- handoff_tokens: admin-only. No tech/customer-role select policy exists on
-- this table by design — a handoff token is validated server-side via an
-- Edge Function/RPC running under the service role, never through client-side
-- RLS, since the customer holding the QR code has no authenticated session
-- at all.
create policy handoff_tokens_admin_all
  on public.handoff_tokens for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- reviews: org admins get full read/write within their own organization. The
-- insert-only anon policy below is intentionally permissive: a review is
-- submitted from the public handoff page, where there is no authenticated
-- app session to scope against, so the only guard available is that job_id
-- must reference a real job row. Do not over-engineer public RLS here — if
-- this policy is abused, tightening it is a P5 follow-up.
create policy reviews_admin_all
  on public.reviews for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- Returns true when a job with the given id exists under the given
-- organization. security definer bypasses RLS on `jobs` for this one read
-- â€” required because reviews_insert_anon runs as `anon`, which has no
-- SELECT policy on `jobs` at all, so an inline EXISTS subquery under RLS
-- always saw zero rows and rejected every anon review insert (AC-RV-2).
-- Mirrors public.current_org_id() (0001_foundation.sql): security definer,
-- stable, search_path pinned empty for the same privilege-escalation
-- reasons documented there.
create or replace function public.job_exists_in_org(p_job_id uuid, p_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id and organization_id = p_organization_id
  );
$$;

revoke all on function public.job_exists_in_org(uuid, uuid) from public;
grant execute on function public.job_exists_in_org(uuid, uuid) to anon, authenticated;

create policy reviews_insert_anon
  on public.reviews for insert
  to anon
  with check (
    public.job_exists_in_org(reviews.job_id, reviews.organization_id)
  );

-- review_requests: admin-only. State transitions through the handoff flow
-- are driven server-side (Edge Function/RPC), not by a tech or customer
-- client.
create policy review_requests_admin_all
  on public.review_requests for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
