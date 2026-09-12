-- Jobcore — Close-Outs: itemized customer-contact history (phone/text/email/other) recorded per job.

-- ---------------------------------------------------------------------------
-- 1. job_contact_log
-- ---------------------------------------------------------------------------

-- Append-only log of customer-contact attempts made during closeout (calls,
-- texts, emails). contacted_by is nullable since the acting profile may not
-- always be resolvable at write time; created_at is the authoritative
-- ordering column, same idiom as other insert-only logs in this codebase.
create table public.job_contact_log (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id),
  job_id          uuid not null references public.jobs (id),
  contact_type    text not null,
  note            text,
  contacted_by    uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  constraint job_contact_log_contact_type_check
    check (contact_type in ('phone', 'text', 'email', 'other'))
);

create index job_contact_log_job_id_idx on public.job_contact_log (job_id);

alter table public.job_contact_log enable row level security;

-- Org members may read their own organization's contact-log rows.
create policy job_contact_log_select_org
  on public.job_contact_log for select
  to authenticated
  using (organization_id = public.current_org_id());

-- Office roles (owner/admin) may insert new contact-log entries. Insert-only,
-- audit-style log — no update or delete policy is added (mirrors audit_log).
create policy job_contact_log_insert_admin
  on public.job_contact_log for insert
  to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_admin());
