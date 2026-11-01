// When a job is completed with an approved estimate whose payment balance is already zero,
// move it straight to 'paid'. Best-effort: never throws (completion has already succeeded).
// Paying in full never completes a job; completion stays its own step.
import { useEffect, useState } from 'react';
import type { Ctx, Job } from '@jobcore/core';
import { balanceCents, invoiceTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import { computeTotals } from '../../../../modules/admin-finance/src/domain/estimate-layout';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { buildAdminFinancePorts, createJobRepository } from './admin-finance-repos';

// True once payments cover the work total of an approved estimate, whatever the job status.
export async function isJobPaidInFull(jobId: string): Promise<boolean> {
  try {
    const ports = buildAdminFinancePorts();
    const est = await ports.estimates.getForJob(jobId);
    if (!est || est.status !== 'approved') {
      return false;
    }
    const payments = await ports.payments.listForJob(jobId);
    const items = await ports.estimates.listLineItems(jobId);
    const workCents = items.length > 0 ? Math.round(computeTotals(items, []).total * 100) : invoiceTotalCents(est);
    return payments.length > 0 && balanceCents(workCents, payments) <= 0;
  } catch {
    return false;
  }
}

export async function markPaidIfSettled(role: string, job: Job): Promise<boolean> {
  try {
    if (!(await isJobPaidInFull(job.id))) {
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

// Paid-in-full flag for the stage bar; re-checks whenever the job object changes (setJob after a payment).
export function usePaidInFull(job: Job | null): boolean {
  const [paidInFull, setPaidInFull] = useState(false);
  useEffect(() => {
    if (!job?.id) return undefined;
    let cancelled = false;
    void isJobPaidInFull(job.id).then((v) => {
      if (!cancelled) setPaidInFull(v);
    });
    return () => { cancelled = true; };
  }, [job]);
  return paidInFull;
}
