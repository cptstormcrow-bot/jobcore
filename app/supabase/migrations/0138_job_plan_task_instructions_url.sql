-- 0138: Instructions URL on every Job Details task (uber 220).
-- 0137 put the link on the price-sheet catalog (service_tasks). Misc, hourly and
-- unlinked tasks have no catalog row, so the link now also lives on the task row
-- itself. Linked rows are backfilled from the catalog. Nullable text, normalized
-- by the app on save. Techs already read job_plan_tasks, so no RPC change.

alter table public.job_plan_tasks
  add column if not exists instructions_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_instructions_url_len_check') then
    alter table public.job_plan_tasks add constraint job_plan_tasks_instructions_url_len_check
      check (instructions_url is null or char_length(instructions_url) <= 2000);
  end if;
end $$;

-- Backfill linked rows from the catalog (needs 0137 first).
update public.job_plan_tasks t
   set instructions_url = st.instructions_url
  from public.service_tasks st
 where t.service_task_id = st.id
   and t.instructions_url is null
   and st.instructions_url is not null;

-- Assign: a new task row linked to the catalog starts with the catalog's link.
create or replace function public.job_plan_tasks_default_instructions_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.instructions_url is null and new.service_task_id is not null then
    select st.instructions_url into new.instructions_url
      from public.service_tasks st where st.id = new.service_task_id;
  end if;
  return new;
end;
$$;

drop trigger if exists job_plan_tasks_default_instructions_url on public.job_plan_tasks;
create trigger job_plan_tasks_default_instructions_url
  before insert on public.job_plan_tasks
  for each row execute function public.job_plan_tasks_default_instructions_url();

-- Publish / approve: the task's link goes up to the price sheet (approve calls publish).
create or replace function public.publish_assembly_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.job_plan_tasks%rowtype;
  v_service uuid;
  v_new uuid;
begin
  if not public.is_org_admin() then
    raise exception 'admin only';
  end if;
  select * into t from public.job_plan_tasks
   where id = p_task_id and organization_id = public.current_org_id();
  if not found then
    raise exception 'task not found';
  end if;
  if t.task_type is distinct from 'assembly' then
    raise exception 'only Assembly tasks publish to the price sheet';
  end if;
  if t.service_task_id is not null then
    if t.instructions_url is not null then
      update public.service_tasks set instructions_url = t.instructions_url
       where id = t.service_task_id and instructions_url is null;
    end if;
    return t.service_task_id;
  end if;
  select st.service_id into v_service from public.service_tasks st
   where st.organization_id = public.current_org_id() limit 1;
  v_new := gen_random_uuid();
  insert into public.service_tasks
    (id, organization_id, service_id, name, sku, price_cents, estimated_minutes,
     details, category, active, instructions_url)
  values
    (v_new, public.current_org_id(), coalesce(v_service, gen_random_uuid()), t.title,
     t.sku, round(coalesce(t.price, 0) * 100)::integer, t.estimated_minutes,
     t.notes, 'Assembly', true, t.instructions_url);
  update public.job_plan_tasks
     set service_task_id = v_new, kind = 'price_sheet', billing = 'flat'
   where id = t.id;
  return v_new;
end;
$$;
revoke all on function public.publish_assembly_task(uuid) from public;
grant execute on function public.publish_assembly_task(uuid) to authenticated;
