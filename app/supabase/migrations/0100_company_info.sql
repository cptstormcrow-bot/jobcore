-- Jobcore - migration 0100: org Company Info (name, address, license, phone)
-- One row per org. Members read; admins write. NOT applied live yet.

begin;

create table if not exists public.company_info (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  name text not null default '',
  address text not null default '',
  license_number text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.company_info enable row level security;

drop policy if exists company_info_select_org on public.company_info;
create policy company_info_select_org on public.company_info
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists company_info_admin_insert on public.company_info;
create policy company_info_admin_insert on public.company_info
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists company_info_admin_update on public.company_info;
create policy company_info_admin_update on public.company_info
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

commit;
