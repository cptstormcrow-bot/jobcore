// Ops queued only by the pre-0.4.0 build. That build queued a copy of each save
// AND wrote it straight to the server, so the change already landed when it was
// made. Sending the copy again would duplicate inserts (plan tasks, commissions,
// payout batches) or put back older values, so the row clears with a note.
import { registerOpHandlers, type OpHandler } from './index';

const LEGACY_COPY_OPS = [
  'close_out_failures.recordAttempt',
  'close_out_failures.recordFailure',
  'close_out_failures.resolve',
  'commission.create',
  'customer.saveForJob',
  'job.markBeta',
  'job_photo.add',
  'job_plan_task.add',
  'job_plan_task.remove',
  'payout_batch.persist',
  'price_sheet.apply_publish_plan',
  'price_sheet_area_adjustment.remove',
  'price_sheet_area_adjustment.save',
  'price_sheet_rate.remove',
  'price_sheet_rate.save',
  'reimbursement.approve',
  'reimbursement.reject',
  'service_task.remove',
  'service_task.save',
] as const;

const legacyCopy: OpHandler = async (_payload, ctx) => {
  ctx.note?.('Cleared a copy queued by an older app version; that change was saved when it was made.');
  return { applied: true };
};

registerOpHandlers(Object.fromEntries(LEGACY_COPY_OPS.map((op) => [op, legacyCopy])));
