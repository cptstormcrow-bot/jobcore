-- 0079 — offline replay support (0.4.0)

-- 1. Idempotency key for replayed contact-log inserts (partial unique index:
--    legacy rows keep client_id null).
alter table public.job_contact_log add column if not exists client_id uuid;
create unique index if not exists job_contact_log_client_id_key
  on public.job_contact_log (client_id) where client_id is not null;

-- 2. Tech update whitelist: 0068 body verbatim. The function lists the columns
--    that must stay UNCHANGED for a tech; every unlisted column (status,
--    en_route_at, in_progress_at, completed_at, contacted_at, ...) is
--    therefore already tech-writable. contacted_at is deliberately NOT in the
--    unchanged list, so it is allowed. The trigger from 0008 is untouched.
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
  then
    return new;
  end if;

  raise exception 'jobs: tech update may only change status, en_route_at, in_progress_at, completed_at, contacted_at (id=%)', old.id;
end;
$$;

-- 3. Replay-safe checklist submit.
create or replace function public.submit_checklist_instance(
  p_instance_id uuid,
  p_items jsonb,
  p_submitted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_org_id uuid;
begin
  select ci.job_id, ci.organization_id into v_job_id, v_org_id
    from public.checklist_instances ci
   where ci.id = p_instance_id;
  if v_job_id is null then
    raise exception 'instance not found';
  end if;

  if not exists (
    select 1 from public.job_assignments ja
     where ja.job_id = v_job_id
       and ja.tech_id = auth.uid()
  ) then
    raise exception 'not assigned';
  end if;

  insert into public.checklist_items
    (id, organization_id, instance_id, label, is_checked, value, occurred_at)
  select coalesce((e->>'id')::uuid, gen_random_uuid()),
         v_org_id,
         p_instance_id,
         e->>'label',
         (e->>'is_checked')::boolean,
         e->>'value',
         (e->>'occurred_at')::timestamptz
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as e
  on conflict (id) do nothing;

  update public.checklist_instances
     set submitted_at = coalesce(submitted_at, p_submitted_at)
   where id = p_instance_id;
end;
$$;

revoke all on function public.submit_checklist_instance(uuid, jsonb, timestamptz) from public;
grant execute on function public.submit_checklist_instance(uuid, jsonb, timestamptz) to authenticated;
