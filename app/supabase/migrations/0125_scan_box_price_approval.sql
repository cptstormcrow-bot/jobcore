-- 0125: scan-from-box last-minute adds (Job Overview #0081, Price sheet #0019).
-- A tech (or admin) scans/types a box SKU on a job. A known SKU adds the price-sheet
-- task. An unknown SKU adds a last-minute Assembly task whose proposed price is
-- 'pending' until HQ (an org admin) approves it; approval also publishes the task to
-- the active price sheet. Also lets techs resolve a SKU to a price-sheet row.
-- Additive only; existing rows keep price_status null (= firm, nothing to approve).

alter table public.job_plan_tasks
  add column if not exists price_status text,
  add column if not exists price_approved_by uuid,
  add column if not exists price_approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_price_status_check') then
    alter table public.job_plan_tasks add constraint job_plan_tasks_price_status_check
      check (price_status is null or price_status in ('pending', 'approved'));
  end if;
end $$;

-- Same columns as 0122 plus sku, so a scan can match a box to a price-sheet row.
drop function if exists public.price_sheet_lookup();
create function public.price_sheet_lookup()
returns table (
  id uuid,
  name text,
  category text,
  estimated_minutes integer,
  rate numeric,
  task_number bigint,
  details text,
  materials text,
  sku text
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.name, st.category, st.estimated_minutes, st.rate,
         st.task_number, st.details, st.materials, st.sku
    from public.service_tasks st
   where st.organization_id = public.current_org_id()
     and st.active
     and auth.uid() is not null
   order by st.name;
$$;

revoke all on function public.price_sheet_lookup() from public;
grant execute on function public.price_sheet_lookup() to authenticated;

-- HQ approval: fixes the price (optionally overriding the proposed one), marks the
-- task approved and publishes it to the price sheet. Admin only.
create or replace function public.approve_task_price(p_task_id uuid, p_price numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.job_plan_tasks%rowtype;
begin
  if not public.is_org_admin() then
    raise exception 'admin only';
  end if;
  select * into t from public.job_plan_tasks
   where id = p_task_id and organization_id = public.current_org_id();
  if not found then
    raise exception 'task not found';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'price must not be negative';
  end if;
  update public.job_plan_tasks
     set price = coalesce(p_price, price),
         price_status = 'approved',
         price_approved_by = auth.uid(),
         price_approved_at = now()
   where id = t.id;
  return public.publish_assembly_task(t.id);
end;
$$;

revoke all on function public.approve_task_price(uuid, numeric) from public;
grant execute on function public.approve_task_price(uuid, numeric) to authenticated;
