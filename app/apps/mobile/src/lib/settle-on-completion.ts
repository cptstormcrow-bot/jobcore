// When a job is completed with an approved estimate whose payment balance is already zero,
// move it straight to 'paid'. Best-effort: never throws (completion has already succeeded).
import type { Ctx, Job } from '@jobcore/core';
import { balanceCents, invoiceTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import { computeTotals } from '../../../../modules/admin-finance/src/domain/estimate-layout';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { buildAdminFinancePorts, createJobRepository } from './admin-finance-repos';

export async function markPaidIfSettled(role: string, job: Job): Promise<boolean> {
  try {
    const ports = buildAdminFinancePorts();
    const est = await ports.estimates.getForJob(job.id);
    if (!est || est.status !== 'approved') {
      return false;
    }
    const payments = await ports.payments.listForJob(job.id);
    const items = await ports.estimates.listLineItems(job.id);
    const workCents = items.length > 0 ? Math.round(computeTotals(items, []).total * 100) : invoiceTotalCents(est);
    if (payments.length === 0 || balanceCents(workCents, payments) > 0) {
      return false;
    }
    const ctx: Ctx = { role: role as Ctx['role'], now: () => new Date().toISOString(), hasPaymentRecord: () => true };
    await transitionJob(job, 'paid', ctx);
    await createJobRepository().updateStatus(job.id, 'paid');
    return true;
  } catch {
    return false;
  }
}
