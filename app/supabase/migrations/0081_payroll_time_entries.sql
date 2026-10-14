-- Jobcore - migration 0081: payroll time entries and timesheet RPCs
--
-- payroll_time_entries: one row per punch / manual entry (multiple per day are
-- allowed). The CLIENT supplies id (uuid) so an offline replay is idempotent:
-- the app treats a 23505 on the primary key as success.
-- submit_timesheet / approve_timesheet / reject_timesheet move a week of rows
-- through draft -> submitted -> approved | rejected.

begin;

-- A) payroll_time_entries -----------------------------------------------------
create table if not exists public.payroll_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  minutes integer not null check (minutes between 0 and 1440),
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'clock')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  notes text,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_time_entries_clock_order
    check (clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at)
);

create index if not exists payroll_time_entries_org_user_date_idx
  on public.payroll_time_entries (organization_id, user_id, work_date);

create index if not exists payroll_time_entries_org_status_date_idx
  on public.payroll_time_entries (organization_id, status, work_date);

-- B) updated_at trigger -------------------------------------------------------
create or replace function public.payroll_time_entries_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payroll_time_entries_touch_updated_at on public.payroll_time_entries;
create trigger payroll_time_entries_touch_updated_at
  before update on public.payroll_time_entries
  for each row execute function public.payroll_time_entries_touch_updated_at();

-- C) Row level security -------------------------------------------------------
alter table public.payroll_time_entries enable row level security;

drop policy if exists payroll_time_entries_select_own_or_admin on public.payroll_time_entries;
create policy payroll_time_entries_select_own_or_admin on public.payroll_time_entries
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (user_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists payroll_time_entries_insert_own on public.payroll_time_entries;
create policy payroll_time_entries_insert_own on public.payroll_time_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
    and status = 'draft'
  );

drop policy if exists payroll_time_entries_update_own on public.payroll_time_entries;
create policy payroll_time_entries_update_own on public.payroll_time_entries
  for update to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
    and status in ('draft', 'rejected')
  )
  with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
    and status in ('draft', 'rejected')
    and approved_by is null
    and approved_at is null
  );

drop policy if exists payroll_time_entries_delete_own on public.payroll_time_entries;
create policy payroll_time_entries_delete_own on public.payroll_time_entries
  for delete to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
    and status in ('draft', 'rejected')
  );

drop policy if exists payroll_time_entries_admin_all on public.payroll_time_entries;
create policy payroll_time_entries_admin_all on public.payroll_time_entries
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- D) submit_timesheet ---------------------------------------------------------
create or replace function public.submit_timesheet(
  p_week_start date,
  p_week_end date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_end is null
     or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;

  update public.payroll_time_entries
     set status = 'submitted',
         submitted_at = now(),
         rejection_reason = null
   where user_id = auth.uid()
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status in ('draft', 'rejected');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- E) approve_timesheet --------------------------------------------------------
create or replace function public.approve_timesheet(
  p_user_id uuid,
  p_week_start date,
  p_week_end date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_org_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_end is null
     or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;

  update public.payroll_time_entries
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now()
   where user_id = p_user_id
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status = 'submitted';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- F) reject_timesheet (kick back: returns the week to the tech for editing) ----
create or replace function public.reject_timesheet(
  p_user_id uuid,
  p_week_start date,
  p_week_end date,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_org_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_end is null
     or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;

  update public.payroll_time_entries
     set status = 'rejected',
         rejection_reason = p_reason,
         approved_by = null,
         approved_at = null
   where user_id = p_user_id
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status in ('submitted', 'approved');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- F2) withdraw_timesheet (tech pulls back a submitted week; approved untouched) -
create or replace function public.withdraw_timesheet(
  p_week_start date,
  p_week_end date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_end is null
     or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;

  update public.payroll_time_entries
     set status = 'draft',
         submitted_at = null
   where user_id = auth.uid()
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status = 'submitted';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- F3) delete_timesheet (admin only; any status) -------------------------------
create or replace function public.delete_timesheet(
  p_user_id uuid,
  p_week_start date,
  p_week_end date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_org_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_week_start is null or p_week_end is null
     or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;

  delete from public.payroll_time_entries
   where user_id = p_user_id
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- G) Grants -------------------------------------------------------------------
revoke all on table public.payroll_time_entries from anon, public;
grant select, insert, update, delete on table public.payroll_time_entries to authenticated;

revoke execute on function public.submit_timesheet(date, date) from public, anon;
grant execute on function public.submit_timesheet(date, date) to authenticated;

revoke execute on function public.approve_timesheet(uuid, date, date) from public, anon;
grant execute on function public.approve_timesheet(uuid, date, date) to authenticated;

revoke execute on function public.reject_timesheet(uuid, date, date, text) from public, anon;
grant execute on function public.reject_timesheet(uuid, date, date, text) to authenticated;

revoke execute on function public.withdraw_timesheet(date, date) from public, anon;
grant execute on function public.withdraw_timesheet(date, date) to authenticated;

revoke execute on function public.delete_timesheet(uuid, date, date) from public, anon;
grant execute on function public.delete_timesheet(uuid, date, date) to authenticated;

revoke all on function public.payroll_time_entries_touch_updated_at() from public, anon;

commit;
