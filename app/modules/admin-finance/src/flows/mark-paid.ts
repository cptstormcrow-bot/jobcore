/**
 * "Mark Paid" job action body, extracted verbatim from `index.ts`'s
 * `admin-finance-mark-paid` `onInvoke` so it is reachable without importing
 * expo-router / `.tsx` screens. No behaviour change.
 */
import type { Ctx, Job } from '@jobcore/core';
import { transitionJob } from '../domain/transition';
import { SETTLED_PAYMENT_STATUSES } from '../data/ports';
import type { JobRepository, PaymentsRepository } from '../data/ports';

export type MarkPaidPorts = {
  payments: Pick<PaymentsRepository, 'listForJob'>;
  jobs: Pick<JobRepository, 'updateStatus'>;
};

export async function markJobPaid(job: Job, ports: MarkPaidPorts, baseCtx: Ctx): Promise<void> {
  const ps = await ports.payments.listForJob(job.id);
  const settled =
    job.payer !== 'customer' || ps.some((p) => SETTLED_PAYMENT_STATUSES.includes(p.status));
  const ctx: Ctx = { ...baseCtx, hasPaymentRecord: () => settled };
  await transitionJob(job, 'paid', ctx);
  await ports.jobs.updateStatus(job.id, 'paid');
}
