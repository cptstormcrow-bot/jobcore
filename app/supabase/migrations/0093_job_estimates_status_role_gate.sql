-- 0093_job_estimates_status_role_gate.sql
-- Row 17 ("17 enforced"): enforce estimate-status role gating in the DATABASE.
--
-- WHAT: BEFORE INSERT OR UPDATE trigger on public.job_estimates. A caller who
-- is not owner/admin/sales (i.e. a tech) may move an estimate between draft
-- and submitted, but may not create an approved estimate, move an estimate
-- INTO approved, or change anything on an estimate that is already approved.
-- Owner/admin/sales (is_org_sales_or_above, 0012) are unrestricted, matching
-- the admin matrix in packages/core/src/estimateStatus.ts. auth.uid() is null
-- (service role, migrations, SQL editor) is unrestricted.
--
-- WHY: policy job_estimates_org_all (0036) is FOR ALL and only org-scoped, so
-- until now the role gate lived only in the client (mobile isTechEstimate and
-- the core matrix). Any tech JWT could PATCH status = 'approved' directly.
--
-- OFFLINE REPLAY NOTE: a tech who submitted offline after an admin approved
-- meanwhile now gets SQLSTATE 42501 on replay; the queue classifies that as
-- 'permission' and marks the op failed (terminal), no endless retry.
--
-- Idempotent (create or replace + drop trigger if exists). No data changes.

create or replace function public.job_estimates_status_role_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Service role / migrations / SQL editor: no end user, no gate.
  if auth.uid() is null then
    return new;
  end if;

  -- Owner / admin / sales: full status matrix.
  if public.is_org_sales_or_above() then
    return new;
  end if;

  -- Remaining caller: tech.
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      raise exception 'job_estimates: only an admin may create an approved estimate (job_id=%)', new.job_id
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'approved' then
    raise exception 'job_estimates: only an admin may change an approved estimate (job_id=%)', old.job_id
      using errcode = '42501';
  end if;
  if new.status = 'approved' then
    raise exception 'job_estimates: only an admin may approve an estimate (job_id=%)', old.job_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists job_estimates_status_role_gate_trg on public.job_estimates;
create trigger job_estimates_status_role_gate_trg
  before insert or update on public.job_estimates
  for each row execute function public.job_estimates_status_role_gate();
