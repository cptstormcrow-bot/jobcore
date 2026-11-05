-- 0122: price_sheet_lookup (Prem Checklist #0061 item search).
-- Techs cannot read service_tasks (admin-only RLS, 0032), but Jeff decided on
-- 2026-11-05 that a tech may see an item's name, rate, Details and Materials
-- (techs take cash/checks and need the price). A security definer RPC exposes
-- exactly those columns for active items in the caller's own organization,
-- so the table's admin-only policy stays untouched (no price_cents, no cost).

create or replace function public.price_sheet_lookup()
returns table (
  id uuid,
  name text,
  category text,
  estimated_minutes integer,
  rate numeric,
  task_number bigint,
  details text,
  materials text
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.name, st.category, st.estimated_minutes, st.rate,
         st.task_number, st.details, st.materials
    from public.service_tasks st
   where st.organization_id = public.current_org_id()
     and st.active
     and auth.uid() is not null
   order by st.name;
$$;

revoke all on function public.price_sheet_lookup() from public;
grant execute on function public.price_sheet_lookup() to authenticated;
