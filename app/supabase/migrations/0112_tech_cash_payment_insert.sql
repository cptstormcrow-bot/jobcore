-- Jobcore - migration 0112: let a tech record a CASH payment on their own job
-- Additive INSERT policy on payments. Admins keep payments_admin_all.
-- Constrains every column the client sets (provider, status, method, confirmer).
-- NOT applied live yet.

begin;

drop policy if exists payments_insert_tech_cash on public.payments;
create policy payments_insert_tech_cash
  on public.payments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = payments.job_id
        and ja.tech_id = auth.uid()
    )
    and method = 'cash'
    and status = 'manual_confirmed'
    and provider_id = 'manual'
    and confirmed_by = auth.uid()
  );

commit;
