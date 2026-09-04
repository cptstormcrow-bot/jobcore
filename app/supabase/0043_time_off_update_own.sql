-- 0043_time_off_update_own.sql
-- Lets a tech edit their own pending/approved time-off request (start/end
-- dates and reason) without going through cancel + re-create. Modeled
-- directly on cancel_time_off_request() (0019_time_off_auto_decide.sql):
-- same ownership check, same security-definer justification, same
-- unlinked calendar_events audit-row pattern. A row created by an admin
-- as a blackout (created_by_admin_id is not null, see
-- 0035_admin_time_off_blackout.sql) may not be edited by the tech.

-- security definer is REQUIRED: updating must succeed even though the
-- ordinary UPDATE path for a tech's own row is not otherwise granted by
-- RLS, and the calendar_events audit insert must succeed regardless of
-- the calling tech's own calendar_events grants.
create or replace function public.update_time_off_request(
  p_request_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $
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

  if v_row.status in ('cancelled', 'denied') then
    raise exception 'only pending or approved time off can be edited';
  end if;

  if v_row.created_by_admin_id is not null then
    raise exception 'admin-created time off cannot be edited by the tech';
  end if;

  update public.time_off_requests
  set start_date = p_start_date,
      end_date = p_end_date,
      reason = p_reason,
      updated_at = now()
  where id = p_request_id;

  insert into public.calendar_events (
    organization_id, job_id, kind, title, description, event_time, created_by
  ) values (
    v_row.organization_id,
    null,
    'time_off_updated',
    (select coalesce(full_name, 'Tech') from public.profiles where id = v_row.tech_id) || ' -- time off updated',
    p_reason,
    p_start_date::timestamptz,
    v_row.tech_id
  );
end;
$;

grant execute on function public.update_time_off_request(uuid, date, date, text) to authenticated;
