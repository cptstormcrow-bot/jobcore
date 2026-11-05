-- 0124: task types on job_plan_tasks (Prem Checklist #0061 Tasks).
-- Each task may carry a type: assembly (flat price, SKU for instruction-video
-- lookup), handyman (hourly rate x expected time + materials), appliance
-- (hourly rate x expected time + parts) or contractor (contact + license).
-- Additive only; existing rows keep task_type null. Also gives service_tasks a
-- sku column and an admin-only RPC that publishes an Assembly task into the
-- active price sheet (#0019).

alter table public.job_plan_tasks
  add column if not exists task_type text,
  add column if not exists sku text,
  add column if not exists price numeric(10, 2),
  add column if not exists hourly_rate numeric(10, 2),
  add column if not exists extras_cost numeric(10, 2),
  add column if not exists contractor_name text,
  add column if not exists contractor_contact text,
  add column if not exists contractor_license text;

alter table public.service_tasks
  add column if not exists sku text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_task_type_check') then
    alter table public.job_plan_tasks add constraint job_plan_tasks_task_type_check
      check (task_type is null or task_type in ('assembly', 'handyman', 'appliance', 'contractor'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_money_check') then
    alter table public.job_plan_tasks add constraint job_plan_tasks_money_check
      check ((price is null or price >= 0) and (hourly_rate is null or hourly_rate >= 0)
             and (extras_cost is null or extras_cost >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_type_text_len_check') then
    alter table public.job_plan_tasks add constraint job_plan_tasks_type_text_len_check
      check ((sku is null or char_length(sku) <= 80)
             and (contractor_name is null or char_length(contractor_name) <= 200)
             and (contractor_contact is null or char_length(contractor_contact) <= 200)
             and (contractor_license is null or char_length(contractor_license) <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'service_tasks_sku_len_check') then
    alter table public.service_tasks add constraint service_tasks_sku_len_check
      check (sku is null or char_length(sku) <= 80);
  end if;
end $$;

-- Publish an Assembly task into the caller's active price sheet and link it.
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
    return t.service_task_id;
  end if;
  select st.service_id into v_service from public.service_tasks st
   where st.organization_id = public.current_org_id() limit 1;
  v_new := gen_random_uuid();
  insert into public.service_tasks
    (id, organization_id, service_id, name, sku, price_cents, estimated_minutes,
     details, category, active)
  values
    (v_new, public.current_org_id(), coalesce(v_service, gen_random_uuid()), t.title,
     t.sku, round(coalesce(t.price, 0) * 100)::integer, t.estimated_minutes,
     t.notes, 'Assembly', true);
  update public.job_plan_tasks
     set service_task_id = v_new, kind = 'price_sheet', billing = 'flat'
   where id = t.id;
  return v_new;
end;
$$;

revoke all on function public.publish_assembly_task(uuid) from public;
grant execute on function public.publish_assembly_task(uuid) to authenticated;
