-- 0094_task_unity.sql
-- Task unity — NOT APPLIED, held for Jeff's explicit go.
-- Adds unit/area/materials_note + content_updated_at to job_plan_tasks, links
-- estimate lines to service tasks and origin lines, links planning photos to
-- plan tasks, and adds save_estimate_line_to_price_sheet(). Idempotent.
-- Precedents: 0086 (job_plan_tasks cols, trigger style), 0063 (length checks),
-- 0036 (job_estimate_line_items; unit price column is unit_cost).
begin;

-- 1. job_plan_tasks
alter table public.job_plan_tasks
  add column if not exists unit text,
  add column if not exists area text,
  add column if not exists materials_note text,
  add column if not exists content_updated_at timestamptz not null default now();

-- 2. job_estimate_line_items
alter table public.job_estimate_line_items
  add column if not exists service_task_id uuid references public.service_tasks (id) on delete set null,
  add column if not exists origin_line_item_id uuid references public.job_estimate_line_items (id) on delete set null,
  add column if not exists unit text,
  add column if not exists area text,
  add column if not exists materials_note text,
  add column if not exists task_snapshot_at timestamptz not null default now();

-- 3. job_planning_photos
alter table public.job_planning_photos
  add column if not exists job_plan_task_id uuid references public.job_plan_tasks (id) on delete set null;

-- 4. Length checks (null allowed)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_unit_len_check'
                   and conrelid = 'public.job_plan_tasks'::regclass) then
    alter table public.job_plan_tasks add constraint job_plan_tasks_unit_len_check
      check (unit is null or char_length(unit) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_area_len_check'
                   and conrelid = 'public.job_plan_tasks'::regclass) then
    alter table public.job_plan_tasks add constraint job_plan_tasks_area_len_check
      check (area is null or char_length(area) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_plan_tasks_materials_note_len_check'
                   and conrelid = 'public.job_plan_tasks'::regclass) then
    alter table public.job_plan_tasks add constraint job_plan_tasks_materials_note_len_check
      check (materials_note is null or char_length(materials_note) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_estimate_line_items_unit_len_check'
                   and conrelid = 'public.job_estimate_line_items'::regclass) then
    alter table public.job_estimate_line_items add constraint job_estimate_line_items_unit_len_check
      check (unit is null or char_length(unit) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_estimate_line_items_area_len_check'
                   and conrelid = 'public.job_estimate_line_items'::regclass) then
    alter table public.job_estimate_line_items add constraint job_estimate_line_items_area_len_check
      check (area is null or char_length(area) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_estimate_line_items_materials_note_len_check'
                   and conrelid = 'public.job_estimate_line_items'::regclass) then
    alter table public.job_estimate_line_items add constraint job_estimate_line_items_materials_note_len_check
      check (materials_note is null or char_length(materials_note) <= 2000);
  end if;
end;
$$;

-- 5. Indexes
create index if not exists job_estimate_line_items_service_task_id_idx
  on public.job_estimate_line_items (service_task_id) where service_task_id is not null;
create index if not exists job_estimate_line_items_origin_line_item_id_idx
  on public.job_estimate_line_items (origin_line_item_id) where origin_line_item_id is not null;
create index if not exists job_planning_photos_job_plan_task_id_idx
  on public.job_planning_photos (job_plan_task_id) where job_plan_task_id is not null;
-- Non-unique: live duplicates unknown.
create index if not exists service_tasks_org_lower_name_idx
  on public.service_tasks (organization_id, lower(btrim(name)));

-- 6. Touch trigger for content_updated_at
create or replace function public.job_plan_tasks_touch_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quantity is distinct from old.quantity
     or new.notes is distinct from old.notes
     or new.estimated_minutes is distinct from old.estimated_minutes
     or new.title is distinct from old.title
     or new.billing is distinct from old.billing
     or new.service_task_id is distinct from old.service_task_id
     or new.unit is distinct from old.unit
     or new.area is distinct from old.area
     or new.materials_note is distinct from old.materials_note then
    new.content_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists job_plan_tasks_touch_content_trg on public.job_plan_tasks;
create trigger job_plan_tasks_touch_content_trg
  before update on public.job_plan_tasks
  for each row execute function public.job_plan_tasks_touch_content();

-- 7. Backfill (idempotent). Existing lines keep the now() snapshot default.
update public.job_estimate_line_items l
   set service_task_id = t.service_task_id
  from public.job_plan_tasks t
 where l.job_plan_task_id = t.id
   and l.service_task_id is null
   and t.service_task_id is not null;

-- 8. Save an estimate line to the price sheet (never updates an existing service_tasks row)
create or replace function public.save_estimate_line_to_price_sheet(p_line_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line   public.job_estimate_line_items%rowtype;
  v_key    text;
  v_task   uuid;
  v_svc    uuid;
begin
  select * into v_line from public.job_estimate_line_items where id = p_line_id;
  if not found then
    raise exception 'estimate line % not found', p_line_id;
  end if;

  if not (public.is_org_admin() and v_line.organization_id = public.current_org_id()) then
    raise exception 'only an org admin can save a line to the price sheet';
  end if;

  v_key := lower(btrim(v_line.description));

  select st.id into v_task
    from public.service_tasks st
   where st.organization_id = v_line.organization_id
     and lower(btrim(st.name)) = v_key
   order by st.created_at, st.id
   limit 1;

  if v_task is not null then
    update public.job_estimate_line_items set service_task_id = v_task where id = v_line.id;
    return v_task;
  end if;

  if v_line.service_task_id is not null then
    select st.service_id into v_svc from public.service_tasks st where st.id = v_line.service_task_id;
  end if;

  if v_svc is null then
    select s.id into v_svc
      from public.services s
     where s.organization_id = v_line.organization_id and s.name = 'Estimate Additions'
     order by s.created_at, s.id
     limit 1;
    if v_svc is null then
      insert into public.services (organization_id, name)
      values (v_line.organization_id, 'Estimate Additions')
      returning id into v_svc;
    end if;
  end if;

  insert into public.service_tasks (organization_id, service_id, name, rate, price_cents, active, category)
  values (v_line.organization_id, v_svc, btrim(v_line.description), v_line.unit_cost,
          round(v_line.unit_cost * 100)::integer, true, 'Estimate-added')
  returning id into v_task;

  update public.job_estimate_line_items set service_task_id = v_task where id = v_line.id;
  return v_task;
end;
$$;

revoke all on function public.save_estimate_line_to_price_sheet(uuid) from public, anon;
grant execute on function public.save_estimate_line_to_price_sheet(uuid) to authenticated;

commit;

-- 9.
notify pgrst, 'reload schema';
