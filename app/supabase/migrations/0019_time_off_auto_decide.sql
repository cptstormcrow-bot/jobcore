-- 0019_time_off_auto_decide.sql
-- Time-off requests become non-discretionary: first tech to claim a date range
-- gets it. A BEFORE INSERT trigger checks the requesting tech's existing job
-- assignments for a date-window conflict and sets status directly -- there is
-- no admin approve/deny step. An approved request acts as a "blackout" on that
-- tech's calendar; cancel_time_off_request() lets the tech release it early so
-- another request (their own, or effectively the date itself) can be reused.

-- 1. Extend the status vocabulary to include 'cancelled'.
alter table public.time_off_requests
  drop constraint if exists time_off_requests_status_check;
alter table public.time_off_requests
  add constraint time_off_requests_status_check
  check (status in ('pending', 'approved', 'denied', 'cancelled'));

-- 2. Table comment: replace the stale admin-approval description.
comment on table public.time_off_requests is
  'Tech-submitted time-off windows. Status is decided automatically at insert '
  'by decide_time_off_request(): approved unless the tech already has a job '
  'assignment overlapping the requested dates, in which case denied. There is '
  'no admin approve/deny step -- first come, first served. A tech may cancel '
  'their own approved/pending request via cancel_time_off_request(), which '
  'frees the date for a later request.';

-- 3. Auto-decide trigger function.
-- security definer is REQUIRED: the trigger reads job_assignments/jobs across
-- the requesting tech's own assignments (already permitted) and writes a
-- calendar_events row on approval, which must succeed regardless of the
-- inserting tech's own calendar_events grants.
create or replace function public.decide_time_off_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflict boolean;
  v_full_name text;
begin
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
$$;

drop trigger if exists time_off_requests_decide on public.time_off_requests;
create trigger time_off_requests_decide
  before insert on public.time_off_requests
  for each row
  execute function public.decide_time_off_request();

-- 4. Let a tech see their own time-off calendar events (job_id is null for these).
create policy calendar_events_select_own_time_off
  on public.calendar_events for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and kind = 'time_off'
    and created_by = auth.uid()
  );

-- 5. Cancel-existing RPC. Tech-callable on their own row only; admin already
-- has full access via time_off_requests_admin_all so no separate admin path
-- is needed.
-- security definer is REQUIRED: cancelling must succeed even though the
-- ordinary UPDATE path for a tech's own row is not otherwise granted by RLS.
create or replace function public.cancel_time_off_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.time_off_requests%rowtype;
begin
  select * into v_row
  from public.time_off_requests
  where id = p_request_id
    and tech_id = auth.uid()
    and organization_id = public.current_org_id();

  if not found then
    raise exception 'time off request not found or not owned by caller';
  end if;

  if v_row.status = 'cancelled' then
    return;
  end if;

  update public.time_off_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id;

  insert into public.calendar_events (
    organization_id, job_id, kind, title, description, event_time, created_by
  ) values (
    v_row.organization_id,
    null,
    'time_off_cancelled',
    (select coalesce(full_name, 'Tech') from public.profiles where id = v_row.tech_id) || ' -- time off cancelled',
    v_row.reason,
    now(),
    v_row.tech_id
  );
end;
$$;

grant execute on function public.cancel_time_off_request(uuid) to authenticated;

