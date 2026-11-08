-- 0139_lead_intake.sql
-- Website lead intake (jobcore-job-v1). DRAFTED, NOT PUSHED - waits on Jeff.
-- 1. leads gets lead_id (the website's own id, unique per org = idempotency) plus
--    zip / service_area / ingress_instructions / is_test so conversion can match
--    a service area after the phone call.
-- 2. lead_intake_keys maps a secret key (stored only as a SHA-256 hash) to an org.
--    RLS on, no policies: only the service-role edge function can read it.

alter table public.leads
  add column if not exists lead_id text,
  add column if not exists zip text,
  add column if not exists service_area text,
  add column if not exists ingress_instructions text,
  add column if not exists is_test boolean not null default false;

create unique index if not exists leads_org_lead_id_uidx
  on public.leads (organization_id, lead_id)
  where lead_id is not null;

create table if not exists public.lead_intake_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key_hash text not null unique,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lead_intake_keys enable row level security;
-- Intentionally no policies: service role only.

comment on table public.lead_intake_keys is
  'Website lead intake secret keys (SHA-256 hex of the key). Add a row with: insert into lead_intake_keys(organization_id,key_hash,label) values (<org>, encode(digest(''<secret>'',''sha256''),''hex''), ''wordpress'');';
