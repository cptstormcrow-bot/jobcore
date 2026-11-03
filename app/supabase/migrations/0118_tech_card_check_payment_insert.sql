-- Jobcore - migration 0118: let a tech record a CARD or CHECK payment on their own job
-- Widens 0112 (cash only) to every manual method; techs collect all payment types (Jeff 2026-11-02).
-- Same constraints otherwise: assigned job, manual provider, manual_confirmed, confirmed by the caller.
-- NOT applied live yet.

begin;

drop policy if exists payments_insert_tech_cash on public.payments;
drop policy if exists payments_insert_tech_manual on public.payments;
create policy payments_insert_tech_manual
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
    and method in ('cash', 'card', 'check')
    and status = 'manual_confirmed'
    and provider_id = 'manual'
    and confirmed_by = auth.uid()
  );

commit;
