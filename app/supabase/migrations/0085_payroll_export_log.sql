-- Jobcore - migration 0085: payroll export log and QuickBooks account map
--
-- payroll_export_log: one row per exported (batch, format, canonical hash).
-- source_hash is the CANONICAL export hash from the wage-engine (14 hex chars),
-- NOT payout_lines.source_hash. Insert-only for authenticated (no update/delete).
-- payroll_qb_account_map: one row per organization naming the QuickBooks
-- accounts used by the journal exports. Admin only.

begin;

-- A) payroll_export_log -------------------------------------------------------
create table if not exists public.payroll_export_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_id uuid not null references public.payout_batches (id) on delete cascade,
  format text not null check (format in ('generic_csv', 'qbo_journal_csv', 'iif_journal', 'iif_timeact')),
  source_hash text not null,
  exported_by uuid,
  exported_at timestamptz not null default now(),
  constraint payroll_export_log_batch_format_hash_key unique (batch_id, format, source_hash)
);

create index if not exists payroll_export_log_org_batch_idx
  on public.payroll_export_log (organization_id, batch_id);

alter table public.payroll_export_log enable row level security;

drop policy if exists payroll_export_log_admin_all on public.payroll_export_log;
create policy payroll_export_log_admin_all on public.payroll_export_log
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

revoke all on table public.payroll_export_log from anon, public;
grant select, insert on table public.payroll_export_log to authenticated;

-- B) payroll_qb_account_map ---------------------------------------------------
create table if not exists public.payroll_qb_account_map (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  wages_expense text not null default 'Payroll Expenses',
  reimbursement_expense text not null default 'Reimbursements',
  payroll_payable text not null default 'Payroll Liabilities',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.payroll_qb_account_map enable row level security;

drop policy if exists payroll_qb_account_map_admin_all on public.payroll_qb_account_map;
create policy payroll_qb_account_map_admin_all on public.payroll_qb_account_map
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

revoke all on table public.payroll_qb_account_map from anon, public;
grant select, insert, update on table public.payroll_qb_account_map to authenticated;

commit;
