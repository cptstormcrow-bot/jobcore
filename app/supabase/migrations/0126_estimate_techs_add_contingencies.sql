-- 0126: a tech may add contingencies (add-ons such as the upstairs fee) to an APPROVED estimate.
-- Everything else on an approved estimate stays admin-only (0093/0102 gate): status, lines,
-- terms, totals. Only the contingencies column (plus updated_by / updated_at) may differ.
-- Replaces the 0102 gate function; same trigger. Additive, no data change. NOT pushed.

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
    if new.status = 'approved' then
      raise exception 'job_estimates: only an admin may create an approved estimate (job_id=%)', new.job_id
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'approved' then
    -- Tech add-on: only contingencies (and the audit stamps) changed, status stays approved.
    if new.status = 'approved'
       and (to_jsonb(new) - 'contingencies' - 'updated_by' - 'updated_at')
           = (to_jsonb(old) - 'contingencies' - 'updated_by' - 'updated_at') then
      return new;
    end if;
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
