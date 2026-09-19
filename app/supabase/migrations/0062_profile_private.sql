-- 0062_profile_private.sql — admin-only private employee fields (screen 06: s6-2 SSN, s6-3 Emergency Contact).
-- Stores ONLY the last 4 SSN digits. A full SSN is never accepted, stored, or logged anywhere.
create table public.profile_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ssn_last4 char(4) check (ssn_last4 is null or ssn_last4 ~ '^[0-9]{4}$'),
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);
comment on table public.profile_private is 'Admin-only private employee fields. Readable/writable only by org admins (RLS).';
comment on column public.profile_private.ssn_last4 is 'Last four SSN digits only (digits, exactly 4). Never a full SSN.';
comment on column public.profile_private.emergency_contact_name is 'Employee emergency contact name.';
comment on column public.profile_private.emergency_contact_phone is 'Employee emergency contact phone.';
create index profile_private_org_idx on public.profile_private (organization_id);
alter table public.profile_private enable row level security;
create policy profile_private_admin_all on public.profile_private
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());
