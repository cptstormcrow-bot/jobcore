-- Jobcore - migration 0076: job stage tracking
--
-- Adds to public.jobs:
--   * updated_at          - bumped on every UPDATE by a BEFORE UPDATE trigger
--   * contacted_at        - when the customer was first contacted
--   * stage_marks         - map of stage key -> ISO completion stamp
--   * upstream_changed_at - bumped only when an upstream (customer / premises /
--                           scheduling / assignment) column changes
--
-- Idempotent: safe to re-run. No RLS changes: the existing policies on
-- public.jobs already cover these new columns.

begin;

alter table public.jobs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists contacted_at timestamptz,
  add column if not exists stage_marks jsonb not null default '{}'::jsonb,
  add column if not exists upstream_changed_at timestamptz;

-- updated_at trigger (no generic helper exists for jobs, so a dedicated one).
create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_jobs_updated_at();

-- upstream_changed_at trigger: only upstream columns count. stage_marks,
-- contacted_at, updated_at, status and completion bookkeeping are excluded.
create or replace function public.bump_jobs_upstream_changed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.customer_id        is distinct from old.customer_id)
  or (new.service_id         is distinct from old.service_id)
  or (new.service_area_id    is distinct from old.service_area_id)
  or (new.source             is distinct from old.source)
  or (new.payer              is distinct from old.payer)
  or (new.requested_window   is distinct from old.requested_window)
  or (new.scheduled_start    is distinct from old.scheduled_start)
  or (new.scheduled_end      is distinct from old.scheduled_end)
  or (new.address            is distinct from old.address)
  or (new.description        is distinct from old.description)
  or (new.assigned_tech_id   is distinct from old.assigned_tech_id)
  or (new.permit_status      is distinct from old.permit_status)
  or (new.parking_available  is distinct from old.parking_available)
  or (new.rooms              is distinct from old.rooms)
  or (new.panel_info         is distinct from old.panel_info)
  or (new.ingress_instructions is distinct from old.ingress_instructions)
  or (new.house_age_years    is distinct from old.house_age_years)
  then
    new.upstream_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_bump_upstream_changed_at on public.jobs;
create trigger jobs_bump_upstream_changed_at
  before update on public.jobs
  for each row
  execute function public.bump_jobs_upstream_changed_at();

commit;
