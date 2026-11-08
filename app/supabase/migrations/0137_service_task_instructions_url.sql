-- 0137: optional Instructions URL per price-sheet task (uber 218).
-- Jeff pastes a link (PDF instructions, .mp4/.mov assembly video, YouTube) on a task;
-- the Job Details task row opens it in the device's own browser. Nullable text,
-- normalized by the app on save. Techs read it through price_sheet_lookup()
-- (service_tasks stays admin-only), so the RPC is recreated with the extra column.

alter table public.service_tasks
  add column if not exists instructions_url text;

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
  instructions_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.id, st.name, st.category, st.estimated_minutes, st.rate,
         st.task_number, st.details, st.materials, st.instructions_url
    from public.service_tasks st
   where st.organization_id = public.current_org_id()
     and st.active
     and auth.uid() is not null
   order by st.name;
$$;

revoke all on function public.price_sheet_lookup() from public;
grant execute on function public.price_sheet_lookup() to authenticated;
