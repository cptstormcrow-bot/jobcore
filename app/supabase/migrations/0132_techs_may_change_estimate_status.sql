-- 0132: Jeff's order 2026-11-08 - a tech may submit AND approve an estimate (and move it back).
-- Replaces the 0126 gate function; same trigger. Status is no longer admin-only.
-- Still admin-only for a tech: every OTHER column of an approved estimate (lines, terms,
-- totals). A tech may change status and contingencies (plus updated_by / updated_at) on any
-- estimate. Additive, no data change. Jeff can re-tighten this later by restoring 0126.

create or replace function public.job_estimates_status_role_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.is_org_sales_or_above() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- UPDATE
  if old.status = 'approved' then
    -- Tech may change status and contingencies only; anything else stays admin-only.
    if (to_jsonb(new) - 'status' - 'contingencies' - 'updated_by' - 'updated_at')
       = (to_jsonb(old) - 'status' - 'contingencies' - 'updated_by' - 'updated_at') then
      return new;
    end if;
    raise exception 'job_estimates: only an admin may change an approved estimate (job_id=%)', old.job_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;
