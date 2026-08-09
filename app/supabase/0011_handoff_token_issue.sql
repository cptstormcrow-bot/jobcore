-- Jobcore P5.S5 — handoff token issuance
-- Apply after 0010.

-- ---------------------------------------------------------------------------
-- 1. issue_handoff_token(p_job_id uuid) returns text
-- ---------------------------------------------------------------------------

-- Issues a signed, expiring, single-job-scoped handoff token for p_job_id and
-- returns the raw token text (the caller builds the QR-encodable URL from
-- it; see modules/payment-review/src/domain/handoff.ts). Inserts a row into
-- public.handoff_tokens (0010) with organization_id resolved from
-- public.current_org_id() — never taken from the caller — job_id, the
-- generated token, and expires_at = now() + interval '4 hours'.
--
-- The token itself is built from two gen_random_uuid() values concatenated
-- and hyphen-stripped rather than pgcrypto's gen_random_bytes()/encode(),
-- because no migration through 0010 declares `create extension pgcrypto`
-- and gen_random_uuid() is already used unconditionally by every table's
-- `id` default in this schema (built into Postgres core, no extension
-- needed) — this avoids introducing a new extension dependency for one
-- function. 32 bytes of underlying randomness (two v4 UUIDs) matches the
-- entropy gen_random_bytes(24) would have provided.
--
-- security definer, stable search_path, and full schema-qualification
-- follow the same rationale as public.is_org_admin() (0001) and
-- public.publish_price_sheet() (0005): the function needs to read
-- current_org_id() and write handoff_tokens (RLS on that table is
-- admin-only per 0010's handoff_tokens_admin_all policy) on behalf of
-- whichever authenticated caller is permitted to issue a handoff for the
-- job, without granting that caller direct table access. The explicit
-- org-id check below (v_job.organization_id <> current_org_id()) is the
-- same belt-and-suspenders scoping publish_price_sheet() applies before
-- writing.
create or replace function public.issue_handoff_token(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job   public.jobs;
  v_token text;
begin
  select *
  into v_job
  from public.jobs
  where id = p_job_id;

  if not found then
    raise exception 'issue_handoff_token: job not found (id=%)', p_job_id;
  end if;

  if v_job.organization_id <> public.current_org_id() then
    raise exception 'issue_handoff_token: job does not belong to caller organization (id=%)', p_job_id;
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.handoff_tokens (organization_id, job_id, token, expires_at)
  values (v_job.organization_id, v_job.id, v_token, now() + interval '4 hours');

  return v_token;
end;
$$;

revoke all on function public.issue_handoff_token(uuid) from public;
grant execute on function public.issue_handoff_token(uuid) to authenticated;
