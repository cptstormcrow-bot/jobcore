-- Jobcore — Estimate share-link tokens (Wave 2)
-- DOCUMENTATION MIGRATION: estimate_tokens is ALREADY LIVE on the hosted
-- Supabase DB (created out-of-band, no prior committed migration file).
-- This file documents that already-live schema in-repo; it does not
-- originate it. Written guarded/idempotent (`create table if not exists`)
-- so it is a safe no-op against the hosted DB, and still produces the
-- correct schema on a fresh/local DB.
--
-- Structural sibling: public.handoff_tokens (0010_payment_review.sql,
-- ~line 52) — same signed/expiring/single-job-scoped token-issuance
-- pattern. CONFIRMED DIFFERENCE: estimate_tokens has NO revoked_at column
-- (handoff_tokens does) — do not add one here.
--
-- Column evidence: app/supabase/functions/estimate-resolve/index.ts
-- resolveToken() — `select("job_id, expires_at").eq("token", token)`
-- against estimate_tokens, then `new Date(data.expires_at)` for expiry
-- comparison. id/token/created_at columns inferred from the same
-- signed-token-table pattern as handoff_tokens; no evidence of a
-- separate used_at column anywhere in the resolver or call sites, so none
-- is added.
--
-- Apply after 0036_job_estimates.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.estimate_tokens (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs (id) on delete cascade,
  token            text not null unique,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);

create index if not exists estimate_tokens_job_id_idx
  on public.estimate_tokens (job_id);
create index if not exists estimate_tokens_token_idx
  on public.estimate_tokens (token);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.estimate_tokens enable row level security;

-- estimate_tokens: admin-only. Originally drafted to mirror
-- handoff_tokens_admin_all (0010_payment_review.sql) with a direct
-- organization_id predicate, but the live table has NO organization_id
-- column (confirmed via hosted-DB introspection) — estimate_tokens scopes
-- to an organization only indirectly, through job_id -> jobs.organization_id
-- (public.jobs.organization_id, see 0004_scheduling.sql). This join-through-
-- parent RLS shape has no existing sibling elsewhere in this repo (confirmed
-- via grep of app/supabase/*.sql for the same exists-select-from-jobs
-- predicate) — it is original to this migration, not a mirror of precedent.
-- No anon/tech select policy exists on this table by design — a token is
-- validated server-side by the estimate-resolve Edge Function running under
-- the service role (bypasses RLS entirely), never through client-side RLS,
-- since the customer holding the share link has no authenticated session at
-- all.
drop policy if exists estimate_tokens_admin_all on public.estimate_tokens;
create policy estimate_tokens_admin_all
  on public.estimate_tokens for all
  to authenticated
  using (
    public.is_org_admin()
    and exists (
      select 1 from public.jobs
      where jobs.id = estimate_tokens.job_id
        and jobs.organization_id = public.current_org_id()
    )
  )
  with check (
    public.is_org_admin()
    and exists (
      select 1 from public.jobs
      where jobs.id = estimate_tokens.job_id
        and jobs.organization_id = public.current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. issue_estimate_token RPC — signature-only (body undiscovered)
-- ---------------------------------------------------------------------------
--
-- Call sites (app/apps/mobile/src/lib/admin-finance-repos.ts:1957 and
-- app/apps/mobile/src/lib/field-tech-repos.ts:860) invoke this RPC:
--
--   supabase.rpc('issue_estimate_token', { p_job_id: jobId })
--     -> returns a single token string (`data as string`), consumed as
--        `${supabaseUrl}/functions/v1/estimate-resolve?token=${token}`
--
-- No CREATE FUNCTION body for issue_estimate_token exists anywhere under
-- app/supabase/*.sql. Per Rule 20 (verify before asserting) this migration
-- does NOT invent one. The function is confirmed live on the hosted DB
-- (the call sites work against production), but its SQL body needs to be
-- located (e.g. via `supabase db dump` / pg_proc introspection against the
-- hosted DB) or reconstructed and committed as a follow-up migration.
-- Expected shape based on call-site usage and the estimate_tokens table
-- above: a SECURITY DEFINER function taking p_job_id uuid, resolving
-- organization_id from the job, generating a random token string,
-- inserting an estimate_tokens row with a bounded expires_at, and
-- returning the token text.
