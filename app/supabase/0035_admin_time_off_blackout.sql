-- 0035_admin_time_off_blackout.sql
-- Admin-initiated blackouts: an org admin can create a time_off_requests row
-- on behalf of a tech (a "blackout"), using the same first-come-first-served
-- auto-decide logic as a tech's own self-service request. created_by_admin_id
-- records who initiated it (null for tech self-service) and is checked by
-- decide_time_off_request() to prevent a tech from self-granting admin
-- authorization by supplying the column directly.
--
-- A new reverse trigger, deny_job_assignment_on_time_off(), closes the other
-- direction: inserting a job_assignments row is rejected if the tech already
-- has an approved time-off/blackout overlapping the job's scheduled dates.

alter table public.time_off_requests
  add column created_by_admin_id uuid null references auth.users (id) on delete set null;

comment on column public.time_off_requests.created_by_admin_id is
  'Set when this row was created by an org admin as a blackout on another tech''s calendar. Null for a tech''s own self-service request.';

create or replace function public.decide_time_off_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_conflict boolean;
  v_full_name text;
begin
  if new.created_by_admin_id is not null and not public.is_org_admin() then
    raise exception 'Only an org admin may set created_by_admin_id';
  end if;

  select exists (
    select 1
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where ja.tech_id = new.tech_id
      and j.organization_id = new.organization_id
      and j.scheduled_start is not null
      and j.scheduled_end is not null
      and j.scheduled_start::date <= new.end_date
      and j.scheduled_end::date >= new.start_date
  ) into v_conflict;

  if v_conflict then
    new.status := 'denied';
    return new;
  end if;

  new.status := 'approved';

  select full_name into v_full_name
  from public.profiles
  where id = new.tech_id;

  insert into public.calendar_events (
    organization_id, job_id, kind, title, description, event_time, created_by
  ) values (
    new.organization_id,
    null,
    'time_off',
    coalesce(v_full_name, 'Tech') || ' -- time off',
    new.reason,
    new.start_date::timestamptz,
    new.tech_id
  );

  return new;
end;
$;

create or replace function public.deny_job_assignment_on_time_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_conflict boolean;
begin
  select exists (
    select 1
    from public.time_off_requests t
    join public.jobs j on j.id = new.job_id
    where t.tech_id = new.tech_id
      and t.status = 'approved'
      and j.scheduled_start is not null
      and j.scheduled_end is not null
      and t.start_date <= j.scheduled_end::date
      and t.end_date >= j.scheduled_start::date
  ) into v_conflict;

  if v_conflict then
    raise exception 'Cannot assign job: technician has approved time off/blackout in this date range';
  end if;

  return new;
end;
$;

drop trigger if exists deny_job_assignment_on_time_off on public.job_assignments;
create trigger deny_job_assignment_on_time_off
  before insert on public.job_assignments
  for each row
  execute function public.deny_job_assignment_on_time_off();
