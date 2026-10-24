-- 0102_estimate_totals_sync.sql
-- Keep the Estimate header totals in step with its line items in the DATABASE.
--
-- WHAT: AFTER INSERT OR UPDATE OR DELETE trigger on
-- public.job_estimate_line_items (FOR EACH ROW). It recomputes, for the
-- affected job (both jobs when an UPDATE moves a line to another job), the
-- header columns on public.job_estimates:
--   materials_cost / labor_cost / other_cost = sum of round(quantity * unit_cost, 2)
--   per kind ('material' / 'labor' / 'other'), 0 when none;
--   total_cost = materials + labor + other + the contingencies total, where the
--   contingencies total is the sum of `price` over elements of the header's
--   `contingencies` jsonb array whose `applies` is JSON true and whose `price`
--   is a JSON number (null / non-array contingencies count as 0).
-- This mirrors computeTotals in modules/admin-finance/src/domain/estimate-layout.ts.
-- No header row for the job = nothing happens (the trigger never inserts one).
-- updated_at is bumped explicitly: 0036 has no updated_at trigger.
--
-- WHY: the invoice reads job_estimates.total_cost. The $20 'Materials not moved
-- upstairs fee' line added from the field-tech Complete Job screen must change
-- the invoice total without any client-side math.
--
-- GATE BYPASS: 0093's job_estimates_status_role_gate blocks a tech from updating
-- an APPROVED header (42501). The recompute UPDATE must pass, so that function
-- is re-created below (same body as 0093, the latest definition; no later
-- migration redefines it) with a pg_trigger_depth() guard as its first
-- statement.
--
-- SECURITY NOTE: the depth guard lets ANY depth-2 header update through, not
-- only this recompute. A direct user UPDATE runs the gate at depth 1 and is
-- still checked; the recompute fired from sync_estimate_totals runs it at
-- depth 2 and passes. pg_trigger_depth() is not user-settable (unlike a custom
-- GUC). Also: the trigger recomputes on EVERY line change, including admin
-- edits after approval, and a tech's line insert can change an approved
-- header's totals. A security read is wanted before push.
--
-- NO BACKFILL: existing headers stay as they are until one of their lines
-- changes.
--
-- Idempotent (create or replace + drop trigger if exists). No data changes.
-- APPLIED to the live project 2026-10-23 via supabase db push (Jeff's go; pushed together with 0100 and 0101).

-- ---------------------------------------------------------------------------
-- 1. Gate function: allow nested (depth > 1) header updates
-- ---------------------------------------------------------------------------

create or replace function public.job_estimates_status_role_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A direct user UPDATE runs this gate at trigger depth 1 and is still
  -- checked below. The header recompute fired from sync_estimate_totals runs
  -- it at depth 2 and passes. pg_trigger_depth() cannot be set by a user
  -- (unlike a custom GUC), so a client cannot fake it.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- 2. Recompute function
-- ---------------------------------------------------------------------------

create or replace function public.sync_estimate_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job uuid;
begin
  -- Affected job(s): NEW for insert/update, OLD for delete, and OLD as well
  -- when an UPDATE moved the line to a different job.
  for v_job in
    select distinct j
    from (
      select case when tg_op = 'DELETE' then old.job_id else new.job_id end as j
      union all
      select old.job_id where tg_op = 'UPDATE' and old.job_id is distinct from new.job_id
    ) s
    where j is not null
  loop
    update public.job_estimates e
    set materials_cost = t.m,
        labor_cost     = t.l,
        other_cost     = t.o,
        total_cost     = round(t.m + t.l + t.o + c.ct, 2),
        updated_at     = now()
    from (
      select
        coalesce(sum(round(li.quantity * li.unit_cost, 2)) filter (where li.kind = 'material'), 0) as m,
        coalesce(sum(round(li.quantity * li.unit_cost, 2)) filter (where li.kind = 'labor'), 0)    as l,
        coalesce(sum(round(li.quantity * li.unit_cost, 2)) filter (where li.kind = 'other'), 0)    as o
      from public.job_estimate_line_items li
      where li.job_id = v_job
    ) t,
    lateral (
      select coalesce(sum((el ->> 'price')::numeric), 0) as ct
      from public.job_estimates h,
           jsonb_array_elements(
             case when jsonb_typeof(h.contingencies) = 'array'
                  then h.contingencies else '[]'::jsonb end
           ) el
      where h.job_id = v_job
        and jsonb_typeof(el) = 'object'
        and el -> 'applies' = 'true'::jsonb
        and jsonb_typeof(el -> 'price') = 'number'
    ) c
    where e.job_id = v_job;
  end loop;

  return null; -- AFTER trigger: return value ignored
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger
-- ---------------------------------------------------------------------------

drop trigger if exists job_estimate_line_items_sync_totals_trg on public.job_estimate_line_items;
create trigger job_estimate_line_items_sync_totals_trg
  after insert or update or delete on public.job_estimate_line_items
  for each row execute function public.sync_estimate_totals();

notify pgrst, 'reload schema';
