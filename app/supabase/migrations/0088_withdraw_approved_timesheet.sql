-- 0088_withdraw_approved_timesheet.sql
-- A Field Tech or Sales user can pull back their OWN submitted OR approved
-- payroll week to draft. Approved weeks clear approved_by / approved_at, the
-- same stamps reject_timesheet clears.
--
-- Why a new migration: 0081_payroll_time_entries.sql is already live, so the
-- change is a `create or replace function` that swaps the body of
-- public.withdraw_timesheet. 0081 is not edited.
--
-- The RLS policy payroll_time_entries_update_own is deliberately UNCHANGED:
-- approved rows still cannot be edited directly. Only this SECURITY DEFINER
-- RPC reopens them.

begin;

-- F2) withdraw_timesheet (tech pulls back a submitted or approved week) --------
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
         submitted_at = null,
         approved_by = null,
         approved_at = null
   where user_id = auth.uid()
     and organization_id = public.current_org_id()
     and work_date between p_week_start and p_week_end
     and status in ('submitted', 'approved');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.withdraw_timesheet(date, date) is
  'Pulls the caller''s own submitted and approved weeks back to draft and clears the approval stamps.';

-- G) Grants (re-stated; idempotent) -------------------------------------------
revoke execute on function public.withdraw_timesheet(date, date) from public, anon;
grant execute on function public.withdraw_timesheet(date, date) to authenticated;

commit;
