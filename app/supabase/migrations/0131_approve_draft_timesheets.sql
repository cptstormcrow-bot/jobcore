-- 0131: let an admin approve a week that was never submitted.
-- approve_timesheet used to approve only status = 'submitted', so hours a tech
-- (or the admin) had entered but not submitted could never reach a payroll run.
-- Now draft and submitted entries are approved; rejected entries stay rejected
-- until the tech fixes and resubmits them.

create or replace function public.approve_timesheet(p_user_id uuid, p_week_start date, p_week_end date)
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
  if p_week_start is null or p_week_end is null or p_week_end < p_week_start or p_week_end - p_week_start > 6 then
    raise exception 'invalid week range' using errcode = '22023';
  end if;
  update public.payroll_time_entries
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where user_id = p_user_id
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status in ('draft', 'submitted');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.approve_timesheet(uuid, date, date) from public, anon;
grant execute on function public.approve_timesheet(uuid, date, date) to authenticated;
