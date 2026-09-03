-- 0039_issue_estimate_token_rpc.sql
-- RECONSTRUCTION MIGRATION: issue_estimate_token(p_job_id uuid) is ALREADY
-- LIVE on the hosted Supabase DB (confirmed working via call sites below);
-- its CREATE FUNCTION body was never committed to any migration file.
-- This reconstructs that already-live RPC in-repo so the source is
-- version-controlled. Written as `create or replace function`, so it is a
-- safe no-op / refresh against the hosted DB where the function already
-- exists, and still produces a working function on a fresh/local DB.
--
-- Matches the plan at E:\Jeff\.claude\plans\composed-stargazing-gray.md,
-- Increment 0a.
--
-- Call sites (both invoke identically, expecting a single token string):
--   app/apps/mobile/src/lib/admin-finance-repos.ts:1958
--     const { data, error } = await supabase.rpc('issue_estimate_token', { p_job_id: jobId });
--     const token = data as string;
--     -> `${supabaseUrl}/functions/v1/estimate-resolve?token=${token}`
--   app/apps/mobile/src/lib/field-tech-repos.ts:860
--     identical shape (admin and field-tech share issueShareLink()).
--
-- Behavior reconstructed from the call sites plus the estimate_tokens table
-- (0037_estimate_tokens.sql: id, job_id, token, expires_at, created_at — no
-- organization_id column; org-scoping is indirect via job_id -> jobs.organization_id):
--   * Takes p_job_id uuid.
--   * Resolves the job's organization_id and rejects (raises) if the calling
--     user's org (public.current_org_id()) does not own the job, or if the
--     job does not exist — org-scoped consistent with other RPCs/policies in
--     this codebase (see estimate_tokens_admin_all policy, same file).
--   * Generates a random opaque token string and inserts an estimate_tokens
--     row (job_id, token, expires_at) with a bounded expiry.
--   * Returns the token as text — the sole value the call sites consume.
--   * SECURITY DEFINER + `set search_path = ''` (house style — see
--     0035_admin_time_off_blackout.sql) so it can insert into
--     estimate_tokens despite that table's admin-only RLS policy, while the
--     org-ownership check above still gates who may call it successfully.
--
-- Apply after 0037_estimate_tokens.

create or replace function public.issue_estimate_token(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $
declare
  v_org_id uuid;
  v_token  text;
begin
  select organization_id into v_org_id
  from public.jobs
  where id = p_job_id;

  if v_org_id is null then
    raise exception 'issue_estimate_token: job % not found', p_job_id;
  end if;

  if v_org_id <> public.current_org_id() then
    raise exception 'issue_estimate_token: job % does not belong to the caller''s organization', p_job_id;
  end if;

  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');

  insert into public.estimate_tokens (job_id, token, expires_at)
  values (p_job_id, v_token, now() + interval '14 days');

  return v_token;
end;
$;
