-- Techs may schedule jobs assigned to them (Jeff 2026-11-06, unified calendar).
-- Row access is unchanged: jobs_update_tech (0008) only lets a tech update jobs they are
-- assigned to through job_assignments. This trigger body is 0086 verbatim except that
-- scheduled_start and scheduled_end are no longer in the must-stay-unchanged list.
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
     and new.address is not distinct from old.address
     and new.description is not distinct from old.description
     and new.assigned_tech_id is not distinct from old.assigned_tech_id
     and new.created_at is not distinct from old.created_at
     and new.name is not distinct from old.name
     and new.parent_job_id is not distinct from old.parent_job_id
  then
    return new;
  end if;

  raise exception 'jobs: tech update may only change status, schedule, en_route_at, in_progress_at, completed_at, contacted_at (id=%)', old.id;
end;
$$;
