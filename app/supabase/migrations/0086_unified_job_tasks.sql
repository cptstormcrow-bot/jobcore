-- Jobcore - migration 0086: unified job task list
--
-- One task list per job (price-sheet tasks and misc tasks), parent/child jobs,
-- one-open-job-per-customer guard, spawn_customer_job RPC, two summary views,
-- and an idempotent backfill.
--
-- Idempotent where practical: safe to re-run. Not applied by the author.

begin;

-- ---------------------------------------------------------------------------
-- 1. job_plan_tasks
-- ---------------------------------------------------------------------------

alter table public.job_plan_tasks
  alter column service_task_id drop not null;

alter table public.job_plan_tasks
  add column if not exists kind text not null default 'price_sheet',
  add column if not exists title text,
  add column if not exists billing text not null default 'flat',
  add column if not exists estimated_minutes integer,
  add column if not exists sort_order integer not null default 0,
  add column if not exists status text not null default 'planned',
  add column if not exists source text not null default 'plan',
  add column if not exists spawned_job_id uuid references public.jobs (id) on delete set null,
  add column if not exists source_task_id uuid references public.job_plan_tasks (id) on delete set null;

alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_kind_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_kind_check
  check (kind in ('price_sheet', 'misc'));
alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_price_sheet_service_task_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_price_sheet_service_task_check
  check (kind <> 'price_sheet' or service_task_id is not null);
alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_billing_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_billing_check
  check (billing in ('flat', 'hourly'));
alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_misc_hourly_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_misc_hourly_check
  check (kind <> 'misc' or billing = 'hourly');
alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_status_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_status_check
  check (status in ('planned', 'done', 'deferred'));
alter table public.job_plan_tasks drop constraint if exists job_plan_tasks_source_check;
alter table public.job_plan_tasks add constraint job_plan_tasks_source_check
  check (source in ('plan', 'prem', 'estimate', 'description', 'spawn'));

create index if not exists job_plan_tasks_spawned_job_id_idx
  on public.job_plan_tasks (spawned_job_id) where spawned_job_id is not null;
create index if not exists job_plan_tasks_source_task_id_idx
  on public.job_plan_tasks (source_task_id) where source_task_id is not null;

-- BEFORE INSERT: snapshot title/minutes from the price sheet. Security definer
-- because techs cannot read service_tasks under its RLS. Misc rows are hourly.
create or replace function public.job_plan_tasks_fill_from_service_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.service_task_id is not null then
    select coalesce(nullif(new.title, ''), st.name),
           coalesce(new.estimated_minutes, st.estimated_minutes)
      into new.title, new.estimated_minutes
      from public.service_tasks st
     where st.id = new.service_task_id;
  end if;
  if new.kind = 'misc' then
    new.billing := 'hourly';
  end if;
  return new;
end;
$$;

drop trigger if exists job_plan_tasks_fill_trg on public.job_plan_tasks;
create trigger job_plan_tasks_fill_trg
  before insert on public.job_plan_tasks
  for each row execute function public.job_plan_tasks_fill_from_service_task();

-- RLS: sales read/write (0012 idiom), assigned techs insert/update/delete
-- (select already granted by job_plan_tasks_select_tech in 0046).
drop policy if exists job_plan_tasks_all_sales on public.job_plan_tasks;
create policy job_plan_tasks_all_sales
  on public.job_plan_tasks for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_sales_or_above())
  with check (organization_id = public.current_org_id() and public.is_org_sales_or_above());

drop policy if exists job_plan_tasks_insert_tech on public.job_plan_tasks;
create policy job_plan_tasks_insert_tech
  on public.job_plan_tasks for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
       where ja.job_id = job_plan_tasks.job_id
         and ja.tech_id = auth.uid()
    )
  );

drop policy if exists job_plan_tasks_update_tech on public.job_plan_tasks;
create policy job_plan_tasks_update_tech
  on public.job_plan_tasks for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
       where ja.job_id = job_plan_tasks.job_id
         and ja.tech_id = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
       where ja.job_id = job_plan_tasks.job_id
         and ja.tech_id = auth.uid()
    )
  );

drop policy if exists job_plan_tasks_delete_tech on public.job_plan_tasks;
create policy job_plan_tasks_delete_tech
  on public.job_plan_tasks for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.job_assignments ja
       where ja.job_id = job_plan_tasks.job_id
         and ja.tech_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. jobs: name, parent_job_id (admin-only for techs)
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists name text,
  add column if not exists parent_job_id uuid references public.jobs (id) on delete set null;

create index if not exists jobs_parent_job_id_idx
  on public.jobs (parent_job_id) where parent_job_id is not null;

-- Whitelist: 0079 body (itself 0068 verbatim) plus name/parent_job_id in the
-- must-stay-unchanged list.
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
     and new.name is not distinct from old.name
     and new.parent_job_id is not distinct from old.parent_job_id
  then
    return new;
  end if;

  raise exception 'jobs: tech update may only change status, en_route_at, in_progress_at, completed_at, contacted_at (id=%)', old.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. job_estimate_line_items.job_plan_task_id
-- ---------------------------------------------------------------------------

alter table public.job_estimate_line_items
  add column if not exists job_plan_task_id uuid
    references public.job_plan_tasks (id) on delete set null;

create index if not exists job_estimate_line_items_job_plan_task_id_idx
  on public.job_estimate_line_items (job_plan_task_id) where job_plan_task_id is not null;

-- ---------------------------------------------------------------------------
-- 4. One open job per customer
-- ---------------------------------------------------------------------------

create or replace function public.jobs_one_open_per_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open_id uuid;
  v_open_number integer;
begin
  if new.customer_id is null
     or new.status::text not in ('new', 'qualified', 'scheduled', 'assigned',
                                 'accepted', 'en_route', 'in_progress', 'needs_reschedule')
  then
    return new;
  end if;

  select j.id, j.job_number into v_open_id, v_open_number
    from public.jobs j
   where j.customer_id = new.customer_id
     and j.id <> new.id
     and j.status::text in ('new', 'qualified', 'scheduled', 'assigned',
                            'accepted', 'en_route', 'in_progress', 'needs_reschedule')
   order by j.created_at
   limit 1;

  if v_open_id is not null then
    raise exception 'customer_has_open_job'
      using errcode = 'P0001',
            detail = v_open_id::text || '|' || v_open_number::text;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_one_open_per_customer_trg on public.jobs;
create trigger jobs_one_open_per_customer_trg
  before insert or update of customer_id, status on public.jobs
  for each row execute function public.jobs_one_open_per_customer();

-- Pre-existing duplicates are tolerated; list them.
do $$
declare
  r record;
begin
  for r in
    select j.customer_id, count(*) as open_jobs,
           string_agg('#' || j.job_number::text, ', ' order by j.job_number) as numbers
      from public.jobs j
     where j.customer_id is not null
       and j.status::text in ('new', 'qualified', 'scheduled', 'assigned',
                              'accepted', 'en_route', 'in_progress', 'needs_reschedule')
     group by j.customer_id
    having count(*) > 1
  loop
    raise notice 'customer % already has % open jobs: %', r.customer_id, r.open_jobs, r.numbers;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. spawn_customer_job
-- ---------------------------------------------------------------------------

create or replace function public.spawn_customer_job(
  p_source_job uuid,
  p_task_ids uuid[],
  p_title text
)
returns table (id uuid, job_number integer, name text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_src public.jobs%rowtype;
  v_cust_name text;
  v_new_id uuid;
  v_name text;
begin
  select * into v_src from public.jobs where jobs.id = p_source_job;
  if not found then
    raise exception 'source job not found';
  end if;

  select c.name into v_cust_name from public.customers c where c.id = v_src.customer_id;
  v_name := left(coalesce(v_src.name, v_cust_name, '') || ' — ' || p_title, 60);

  insert into public.jobs (
    organization_id, customer_id, service_id, source, payer, attach_timing,
    address, ingress_instructions, permit_status, parking_available, rooms,
    panel_info, considerations, service_area_id, status, parent_job_id, name
  )
  values (
    v_src.organization_id, v_src.customer_id, v_src.service_id, v_src.source,
    v_src.payer, v_src.attach_timing, v_src.address, v_src.ingress_instructions,
    v_src.permit_status, v_src.parking_available, v_src.rooms, v_src.panel_info,
    v_src.considerations, v_src.service_area_id, 'new', v_src.id, v_name
  )
  returning jobs.id into v_new_id;

  insert into public.job_plan_tasks (
    organization_id, job_id, service_task_id, quantity, notes, kind, title,
    billing, estimated_minutes, sort_order, status, source, source_task_id
  )
  select t.organization_id, v_new_id, t.service_task_id, t.quantity, t.notes,
         t.kind, t.title, t.billing, t.estimated_minutes, t.sort_order,
         'planned', 'spawn', t.id
    from public.job_plan_tasks t
   where t.job_id = p_source_job
     and t.id = any (p_task_ids);

  update public.job_plan_tasks
     set spawned_job_id = v_new_id
   where job_id = p_source_job
     and id = any (p_task_ids);

  return query
    select j.id, j.job_number, j.name from public.jobs j where j.id = v_new_id;
end;
$$;

revoke all on function public.spawn_customer_job(uuid, uuid[], text) from public;
grant execute on function public.spawn_customer_job(uuid, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Views
-- ---------------------------------------------------------------------------

create or replace view public.customer_project_history_v
with (security_invoker = true) as
select
  c.id as customer_id,
  c.organization_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  (select count(*) from public.jobs j where j.customer_id = c.id) as job_count,
  (select max(j.completed_at) from public.jobs j
    where j.customer_id = c.id and j.completed_at is not null) as last_completed_at,
  (select j.id from public.jobs j
    where j.customer_id = c.id
      and j.status::text in ('new', 'qualified', 'scheduled', 'assigned',
                             'accepted', 'en_route', 'in_progress', 'needs_reschedule')
    order by j.created_at desc limit 1) as open_job_id,
  (select j.job_number from public.jobs j
    where j.customer_id = c.id
      and j.status::text in ('new', 'qualified', 'scheduled', 'assigned',
                             'accepted', 'en_route', 'in_progress', 'needs_reschedule')
    order by j.created_at desc limit 1) as open_job_number,
  (select array_agg(t.title order by t.created_at)
     from public.job_plan_tasks t
     join public.jobs j on j.id = t.job_id
    where j.customer_id = c.id and t.status = 'deferred') as deferred_task_titles,
  (select max(s.called_back_at)
     from public.sales_callback_status s
     join public.jobs j on j.id = s.job_id
    where j.customer_id = c.id) as last_callback_at,
  (select max(l.created_at)
     from public.job_contact_log l
     join public.jobs j on j.id = l.job_id
    where j.customer_id = c.id) as last_contact_at
from public.customers c;

create or replace view public.job_task_summary_v
with (security_invoker = true) as
select
  t.job_id,
  count(*) as task_count,
  array_agg(t.title order by t.sort_order, t.created_at) as task_titles
from public.job_plan_tasks t
group by t.job_id;

grant select on public.customer_project_history_v to authenticated;
grant select on public.job_task_summary_v to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Backfill (idempotent, guarded by source / existing links)
-- ---------------------------------------------------------------------------

-- 7a. Existing price-sheet rows: fill title (and minutes) from the catalog.
update public.job_plan_tasks t
   set title = st.name,
       estimated_minutes = coalesce(t.estimated_minutes, st.estimated_minutes)
  from public.service_tasks st
 where st.id = t.service_task_id
   and t.title is null;

-- 7b. room_work entries -> misc/prem tasks.
insert into public.job_plan_tasks
  (organization_id, job_id, kind, title, billing, source, status, sort_order)
select i.organization_id, i.job_id, 'misc',
       trim(both ' :' from coalesce(e.value->>'room', '') || ': ' || coalesce(e.value->>'work', '')),
       'hourly', 'prem', 'planned', (e.ord - 1)::int
  from public.job_investigations i
 cross join lateral jsonb_array_elements(coalesce(i.room_work, '[]'::jsonb))
       with ordinality as e(value, ord)
 where trim(both ' :' from coalesce(e.value->>'room', '') || ': ' || coalesce(e.value->>'work', '')) <> ''
   and not exists (
     select 1 from public.job_plan_tasks x
      where x.job_id = i.job_id
        and x.source = 'prem'
        and x.title = trim(both ' :' from coalesce(e.value->>'room', '') || ': ' || coalesce(e.value->>'work', ''))
   );

-- 7c. Manual estimate lines (labor/other, not yet linked) -> misc/estimate.
do $$
declare
  r record;
  v_task_id uuid;
begin
  for r in
    select li.id, li.organization_id, li.job_id, li.description
      from public.job_estimate_line_items li
     where li.job_plan_task_id is null
       and li.kind in ('labor', 'other')
  loop
    insert into public.job_plan_tasks
      (organization_id, job_id, kind, title, billing, source, status)
    values (r.organization_id, r.job_id, 'misc', r.description, 'hourly', 'estimate', 'planned')
    returning id into v_task_id;

    update public.job_estimate_line_items
       set job_plan_task_id = v_task_id
     where id = r.id;
  end loop;
end;
$$;

-- 7d. jobs.description -> misc/description, only for jobs with zero tasks.
insert into public.job_plan_tasks
  (organization_id, job_id, kind, title, billing, source, status)
select j.organization_id, j.id, 'misc',
       left(trim(regexp_replace(j.description, '^\s*Service:\s*', '', 'i')), 200),
       'hourly', 'description', 'planned'
  from public.jobs j
 where j.description is not null
   and trim(regexp_replace(j.description, '^\s*Service:\s*', '', 'i')) <> ''
   and not exists (select 1 from public.job_plan_tasks x where x.job_id = j.id);

commit;
