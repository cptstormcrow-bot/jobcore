-- Jobcore P6 — sales/marketing
-- Apply after 0011.

-- ---------------------------------------------------------------------------
-- 1. Existing-table changes
-- ---------------------------------------------------------------------------

-- Sales-owned manual curation order for the review library (ReviewLibrary
-- screen). Independent of submitted_at; a sales user reorders without
-- affecting when a review was actually collected.
alter table public.reviews
  add column sort_order integer not null default 0;

create index reviews_sort_order_idx on public.reviews (organization_id, sort_order);

-- Second, independent consent flag. reviews.publish_ok (0010) gates a
-- review-backed asset; job_photos.customer_consent gates a photo-backed one.
-- Fail-closed default so an existing photo row is never marketing-eligible
-- until a human explicitly flips it.
alter table public.job_photos
  add column customer_consent boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- One row per job-photo-or-review reference that has been curated as
-- marketing-eligible. Exactly one of job_photo_id / review_id is set (XOR,
-- enforced by the CHECK below plus the two partial unique indexes that
-- follow it, so the same source row can't be turned into two competing
-- assets). approved_for_public is a second, marketing-specific approval
-- distinct from the underlying source's own consent flag — both are checked
-- by post_draft_assets_consent_check_trg before an asset can enter a draft.
create table public.marketing_assets (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  job_photo_id       uuid references public.job_photos (id) on delete cascade,
  review_id          uuid references public.reviews (id) on delete cascade,
  approved_for_public boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  constraint marketing_assets_source_xor_check
    check (
      (job_photo_id is not null and review_id is null)
      or (job_photo_id is null and review_id is not null)
    )
);

create index marketing_assets_organization_id_idx on public.marketing_assets (organization_id);

create unique index marketing_assets_job_photo_id_key
  on public.marketing_assets (job_photo_id)
  where job_photo_id is not null;

create unique index marketing_assets_review_id_key
  on public.marketing_assets (review_id)
  where review_id is not null;

-- A composed social post in progress. suggested_caption is the pure
-- template-interpolation output of buildCaption(); caption is what actually
-- ships once a sales user edits it (or leaves it identical to the
-- suggestion). service_id / service_area_id feed the pitch-angle selection;
-- neither is required (a post need not be tied to either).
create table public.post_drafts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  status             text not null default 'draft',
  pitch_angle        text,
  service_id         uuid references public.services (id) on delete set null,
  service_area_id    uuid references public.service_areas (id) on delete set null,
  suggested_caption  text,
  caption            text,
  approved_by        uuid references auth.users (id) on delete set null,
  approved_at        timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  constraint post_drafts_status_check
    check (status in ('draft', 'approved', 'posted', 'failed'))
);

create index post_drafts_organization_id_idx on public.post_drafts (organization_id);

-- Join table between post_drafts and marketing_assets — a draft may carry
-- more than one asset, and an asset may be reused across drafts. This is
-- also where dual-consent gets enforced (see the trigger in section 3
-- below): a row cannot be inserted or have its asset_id updated unless the
-- referenced marketing_assets row is approved_for_public AND its
-- source-specific consent flag is true.
create table public.post_draft_assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  draft_id        uuid not null references public.post_drafts (id) on delete cascade,
  asset_id        uuid not null references public.marketing_assets (id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint post_draft_assets_draft_id_asset_id_key
    unique (draft_id, asset_id)
);

create index post_draft_assets_organization_id_idx on public.post_draft_assets (organization_id);
create index post_draft_assets_draft_id_idx on public.post_draft_assets (draft_id);
create index post_draft_assets_asset_id_idx on public.post_draft_assets (asset_id);

-- One row per platform a draft is (or was) targeted at. platform is
-- deliberately unconstrained text, not an enum or FK to social_providers —
-- adding a new SocialProvider must never require a schema migration here
-- (AC-8).
create table public.post_targets (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  draft_id           uuid not null references public.post_drafts (id) on delete cascade,
  platform           text not null,
  status             text not null default 'pending',
  posted_platform_id text,
  error              text,
  created_at         timestamptz not null default now(),
  constraint post_targets_status_check
    check (status in ('pending', 'posted', 'failed')),
  constraint post_targets_draft_id_platform_key
    unique (draft_id, platform)
);

create index post_targets_organization_id_idx on public.post_targets (organization_id);
create index post_targets_draft_id_idx on public.post_targets (draft_id);

-- Append-only log of every post attempt, manual or API, mirroring
-- audit_log's shape (0001): bigint identity pk, no update/delete policy so
-- RLS's default-deny-on-absent-policy makes it immutable to every
-- authenticated client. This is the single source Reporting reads from
-- regardless of which path (manual export or Edge Function) a post went out
-- by.
create table public.campaign_log (
  id          bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  draft_id    uuid references public.post_drafts (id) on delete set null,
  channel     text not null,
  platform    text,
  status      text not null,
  actor_id    uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  constraint campaign_log_channel_check
    check (channel in ('manual', 'api'))
);

create index campaign_log_organization_id_idx on public.campaign_log (organization_id);
create index campaign_log_draft_id_idx on public.campaign_log (draft_id);

-- Org-level enablement config for a social provider, structurally modeled on
-- payment_providers (0010). config NEVER holds a secret key or access
-- token — those live in social_provider_credentials below, which has no
-- authenticated-role RLS policy at all.
create table public.social_providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_id     text not null,
  platform        text not null,
  enabled         boolean not null default false,
  config          jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint social_providers_organization_id_provider_id_key
    unique (organization_id, provider_id)
);

create index social_providers_organization_id_idx on public.social_providers (organization_id);

-- Provider access tokens and platform identifiers. RLS is enabled with zero
-- policies for the authenticated role (see section 4) — the same
-- default-deny-via-absent-policy pattern used elsewhere in this codebase.
-- Only the meta-publish Edge Function's service-role key can read/write this
-- table; it never reaches the client.
create table public.social_provider_credentials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_id     text not null,
  access_token    text not null,
  expires_at      timestamptz,
  page_id         text,
  ig_business_id  text,
  updated_at      timestamptz not null default now(),
  constraint social_provider_credentials_organization_id_provider_id_key
    unique (organization_id, provider_id)
);

create index social_provider_credentials_organization_id_idx
  on public.social_provider_credentials (organization_id);

-- ---------------------------------------------------------------------------
-- 3. post_draft_assets: consent-enforcement trigger
-- ---------------------------------------------------------------------------

-- Before an asset can be attached to a draft (insert) or have its asset_id
-- changed (update), the referenced marketing_assets row must be
-- approved_for_public AND its source's own consent flag must be true
-- (reviews.publish_ok for a review-backed asset, job_photos.customer_consent
-- for a photo-backed one), AND the asset must belong to the caller's own
-- organization. security definer with an empty search_path and full
-- schema-qualification, matching payments_tech_confirm_whitelist() (0010) —
-- this is server-side and un-bypassable from the client, which is what VS-2
-- explicitly tests ("via a direct API call, not the UI").
create or replace function public.post_draft_assets_consent_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.marketing_assets;
  v_consented boolean;
begin
  select *
  into v_asset
  from public.marketing_assets
  where id = new.asset_id;

  if not found then
    raise exception 'post_draft_assets: marketing_assets row not found (asset_id=%)', new.asset_id;
  end if;

  if v_asset.organization_id <> new.organization_id then
    raise exception 'post_draft_assets: asset does not belong to the caller organization (asset_id=%)', new.asset_id;
  end if;

  if not v_asset.approved_for_public then
    raise exception 'post_draft_assets: asset is not approved_for_public (asset_id=%)', new.asset_id;
  end if;

  if v_asset.review_id is not null then
    select r.publish_ok
    into v_consented
    from public.reviews r
    where r.id = v_asset.review_id;
  else
    select jp.customer_consent
    into v_consented
    from public.job_photos jp
    where jp.id = v_asset.job_photo_id;
  end if;

  if v_consented is not true then
    raise exception 'post_draft_assets: source consent flag is not true (asset_id=%)', new.asset_id;
  end if;

  return new;
end;
$$;

create trigger post_draft_assets_consent_check_trg
  before insert or update of asset_id on public.post_draft_assets
  for each row execute function public.post_draft_assets_consent_check();

-- ---------------------------------------------------------------------------
-- 4. reviews: sales column-whitelist trigger
-- ---------------------------------------------------------------------------

-- A sales-role update to reviews may only reorder the library: sort_order.
-- Any other column change originating from a non-admin caller is rejected,
-- mirroring jobs_tech_update_whitelist() (0008) and
-- payments_tech_confirm_whitelist() (0010). public.is_org_admin() (0005)
-- distinguishes the actor: an owner/admin caller is NOT restricted by this
-- trigger.
create or replace function public.reviews_sales_sort_whitelist()
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
     and new.rating = old.rating
     and new.body is not distinct from old.body
     and new.author_display_name is not distinct from old.author_display_name
     and new.platform = old.platform
     and new.submitted_at = old.submitted_at
     and new.publish_ok = old.publish_ok
  then
    return new;
  end if;

  raise exception 'reviews: sales update may only change sort_order (id=%)', old.id;
end;
$$;

create trigger reviews_sales_sort_whitelist_trg
  before update on public.reviews
  for each row execute function public.reviews_sales_sort_whitelist();

-- ---------------------------------------------------------------------------
-- 5. Helper: is_org_sales_or_above()
-- ---------------------------------------------------------------------------

-- Alongside is_org_admin() (0005) and current_org_id() (0001): true for
-- owner, admin, or sales. Every P6 RLS policy that grants the
-- sales/marketing module write access is scoped through this helper rather
-- than repeating the role list inline.
create or replace function public.is_org_sales_or_above()
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
      and role in ('owner', 'admin', 'sales')
  );
$$;

revoke all on function public.is_org_sales_or_above() from public;
grant execute on function public.is_org_sales_or_above() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------------

alter table public.marketing_assets            enable row level security;
alter table public.post_drafts                 enable row level security;
alter table public.post_draft_assets           enable row level security;
alter table public.post_targets                enable row level security;
alter table public.campaign_log                enable row level security;
alter table public.social_providers            enable row level security;
alter table public.social_provider_credentials enable row level security;

-- marketing_assets / post_drafts / post_draft_assets / post_targets: full
-- read/write to sales-or-above within their own organization. This is the
-- sales/marketing module's own working set — no admin-only carve-out is
-- needed beyond what is_org_sales_or_above() already grants an admin.
create policy marketing_assets_all_sales
  on public.marketing_assets for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

create policy post_drafts_all_sales
  on public.post_drafts for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

create policy post_draft_assets_all_sales
  on public.post_draft_assets for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

create policy post_targets_all_sales
  on public.post_targets for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- campaign_log: select + insert only, both org-scoped. Append-only — no
-- update or delete policy exists for any role, so RLS's default-deny-on-
-- absent-policy makes the log immutable to every authenticated client
-- (mirrors audit_log, 0001).
create policy campaign_log_select_sales
  on public.campaign_log for select
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above());

create policy campaign_log_insert_sales
  on public.campaign_log for insert
  to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- job_photos: new select policy for sales. No consent filter — sales
-- browses all photos to judge marketing value; the consent gate applies at
-- the point an asset enters a draft (post_draft_assets_consent_check_trg
-- above), not at browse time.
create policy job_photos_select_sales
  on public.job_photos for select
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- reviews: new select policy for sales, restricted to publish_ok = true —
-- the review library's read path. This did not exist before P6; P5 left
-- reviews at admin-only-select + anon-insert-only.
create policy reviews_select_sales
  on public.reviews for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and public.is_org_sales_or_above()
    and publish_ok = true
  );

-- reviews: new update policy for sales/owner, paired with the
-- reviews_sales_sort_whitelist_trg trigger above which restricts a
-- non-admin update to the sort_order column only.
create policy reviews_update_sort_sales
  on public.reviews for update
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- social_providers: admin-only for writes, mirroring payment_providers_admin_all
-- (0010) exactly.
create policy social_providers_admin_all
  on public.social_providers for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- social_providers: new, select-only, to sales-or-above. The composer needs
-- to read `enabled` to decide whether to offer the API path at all (AC-4
-- requires zero Graph calls and the UI stating unavailability when OFF); the
-- payment_providers admin-only precedent doesn't give sales any read path,
-- so this second, narrower policy is required. Safe because this table
-- never carries a secret — those live in social_provider_credentials, which
-- has no authenticated-role policy at all (see below).
create policy social_providers_select_sales
  on public.social_providers for select
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above());

-- social_provider_credentials: RLS enabled, no policies for any role. With
-- RLS enabled, the absence of a policy is a denial, so this table is
-- unreachable from any authenticated or anon client; only the meta-publish
-- Edge Function's service-role key (which bypasses RLS entirely) can read or
-- write it.
