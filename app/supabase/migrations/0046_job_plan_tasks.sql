-- 0046: job_plan_tasks (per-job task list built from service_tasks catalog)
-- Adds estimated_minutes/rate/category/active metadata to service_tasks, then
-- creates job_plan_tasks joining jobs to service_tasks with quantity/notes,
-- org-admin full access and tech read access limited to assigned jobs.
alter table public.service_tasks
  add column if not exists estimated_minutes integer,
  add column if not exists rate numeric(10, 2),
  add column if not exists category text,
  add column if not exists active boolean not null default true;

create table public.job_plan_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete cascade,
  service_task_id  uuid not null references public.service_tasks (id) on delete restrict,
  quantity         numeric not null default 1,
  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  constraint job_plan_tasks_quantity_check check (quantity > 0)
);

create index job_plan_tasks_job_id_idx on public.job_plan_tasks (job_id);
create index job_plan_tasks_organization_id_idx on public.job_plan_tasks (organization_id);
create index job_plan_tasks_service_task_id_idx on public.job_plan_tasks (service_task_id);

alter table public.job_plan_tasks enable row level security;

create policy job_plan_tasks_admin_all on public.job_plan_tasks
  for all
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy job_plan_tasks_select_tech on public.job_plan_tasks
  for select
  using (
    exists (
      select 1 from public.job_assignments
      where job_assignments.job_id = job_plan_tasks.job_id
        and job_assignments.tech_id = auth.uid()
    )
  );
