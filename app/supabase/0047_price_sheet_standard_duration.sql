-- 0047: price_sheet_standard_duration (T21)
-- Org-scoped singleton table holding a baseline/standard job duration on the
-- price sheet, used as a comparison standard against real price-sheet-sourced
-- job durations. Resolves Jeff's requirement: "an Hour trip is a standard to
-- measure against the others, on the price sheet."
--
-- Deliberately a dedicated table, not a column on price_sheets (would freeze
-- the standard to publish-time of a specific sheet version) and not a column
-- on organizations (blurs module boundaries between org settings and price
-- sheet domain), and not a sentinel row on service_tasks.
--
-- One row per organization (organization_id is itself the primary key).
-- standard_minutes defaults to 60 (the "1 hour" baseline).
--
-- This migration deliberately sidesteps the known price_sheet_rates.task_id
-- gap; that is a pre-existing, separate defect and is out of scope here.

create table public.price_sheet_standard_duration (
  organization_id  uuid primary key references public.organizations (id) on delete cascade,
  standard_minutes integer not null default 60 check (standard_minutes > 0),
  updated_at       timestamptz not null default now()
);

create or replace function public.set_price_sheet_standard_duration_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists price_sheet_standard_duration_set_updated_at on public.price_sheet_standard_duration;
create trigger price_sheet_standard_duration_set_updated_at
  before update on public.price_sheet_standard_duration
  for each row
  execute function public.set_price_sheet_standard_duration_updated_at();

alter table public.price_sheet_standard_duration enable row level security;

create policy price_sheet_standard_duration_select_admin on public.price_sheet_standard_duration
  for select
  using (organization_id = public.current_org_id() and public.is_org_admin());

create policy price_sheet_standard_duration_insert_admin on public.price_sheet_standard_duration
  for insert
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy price_sheet_standard_duration_update_admin on public.price_sheet_standard_duration
  for update
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

insert into public.price_sheet_standard_duration (organization_id, standard_minutes)
select id, 60
from public.organizations
on conflict (organization_id) do nothing;
