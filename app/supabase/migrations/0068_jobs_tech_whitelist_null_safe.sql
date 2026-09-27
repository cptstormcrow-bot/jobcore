-- Migration 0068: NULL-safe field-tech update whitelist
--
-- 0008_field_tech_jobs_rls.sql defines public.jobs_tech_update_whitelist() using
-- `new.col = old.col` comparisons across the 14 whitelisted columns. Standard SQL
-- equality (`=`) yields NULL when either side is NULL, so on a job where a
-- whitelisted column is legitimately NULL on both old and new rows (e.g.
-- customer_id IS NULL, or scheduled_end/description IS NULL), the AND chain
-- never evaluates to true and control falls through to `raise` — rejecting a
-- field tech's otherwise-legitimate status-only update.
--
-- This migration swaps every comparison in the chain to `is not distinct from`
-- (NULL-safe equality: NULL IS NOT DISTINCT FROM NULL is true), fixing the
-- false-rejection case. Behavior is otherwise unchanged: the same 14 columns
-- in the same order, the same is_org_admin() early return, the same raise
-- exception text, invoker security (no security definer), and search_path
-- pinned to ''. This is a `create or replace` only — the trigger object from
-- 0008 is untouched and keeps pointing at this function.

create or replace function public.jobs_tech_update_whitelist()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_org_admin() then
    return new;
  end if;

  if new.id is not distinct from old.id
     and new.organization_id is not distinct from old.organization_id
     and new.customer_id is not distinct from old.customer_id
     and new.service_id is not distinct from old.service_id
     and new.source is not distinct from old.source
     and new.payer is not distinct from old.payer
     and new.attach_timing is not distinct from old.attach_timing
     and new.requested_window is not distinct from old.requested_window
     and new.scheduled_start is not distinct from old.scheduled_start
     and new.scheduled_end is not distinct from old.scheduled_end
     and new.address is not distinct from old.address
     and new.description is not distinct from old.description
     and new.assigned_tech_id is not distinct from old.assigned_tech_id
     and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;

  raise exception 'jobs: tech update may only change status, en_route_at, in_progress_at, completed_at (id=%)', old.id;
end;
$$;
