import type { JobcoreModule } from '@jobcore/module-sdk';
import type { Ctx, Job } from '@jobcore/core';
import { router } from 'expo-router';
import { transitionJob } from './domain/transition';
import { AdminFinanceRoot } from './screens/AdminFinanceRoot';
import { getModuleSession } from './lib/module-session';
import { getModulePorts } from './lib/module-ports';
import { submitEstimate } from './flows/submit-estimate';
import { approveEstimate } from './flows/approve-estimate';

// Re-exported so the host (apps/mobile) can inject the session (P3e.1a) without
// a deep import into this package's internal file layout. See
// `./lib/module-session.ts` for the seam's full contract.
export type { ModuleSession } from './lib/module-session';
export { setModuleSession, clearModuleSession } from './lib/module-session';

/**
 * Assembles the `Ctx` this module's transition-driving flows need to call
 * `transitionJob`: `role` comes from the injected session (real role, never
 * a hardcoded stand-in like `payment-review/src/index.ts`'s scaffold
 * `role: 'admin'`), and `now` is the current-time closure. `hasPaymentRecord`
 * (needed for `completed -> paid`, which is office-only) is supplied by
 * callers as a pre-resolved synchronous boolean closure — a Promise-returning
 * probe reads as `false` via `readSyncProbe`, never awaited here.
 */
export function buildTransitionCtx(): Ctx {
  const session = getModuleSession();

  return {
    role: session ? session.role : 'admin',
    now: () => new Date().toISOString(),
  };
}

/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * displayName / requiredRoles / navEntries are NOT specified by 00-MASTER-SPEC.md
 * or 01-P1-foundation.md. These values are a documented assumption chosen so that
 * all four seeded roles resolve to DIFFERENT nav sets (P1 AC-3) and a tech sees no
 * Admin entry (P1 verification step 2).
 */
export const adminFinanceModule: JobcoreModule = {
  id: 'admin-finance',
  displayName: 'Admin & Finance',
  requiredRoles: ['owner', 'admin'],
  routes: [{ path: 'admin-finance', component: AdminFinanceRoot }],
  navEntries: [{ icon: 'stats-chart', label: 'Admin & Finance', order: 10 }],
  jobActions: [
    { id: 'view-price-sheet', label: 'View Price Sheet' },
    { id: 'add-pay-period-note', label: 'Add Pay Period Note' },
    {
      id: 'close-out-and-mark-paid',
      label: 'Close Out & Mark Paid',
      onInvoke: async (job: Job) => {
        // Distinct id from payment-review's own 'mark-paid' (jobActions ids
        // are not checked for uniqueness across modules — Workstream D
        // deregisters that one; until then both are live).
        //
        // `closeOutJob` (flows/close-out-job.ts) needs `calendarEvents`
        // (CalendarEventRepository) plus a resolved `compensationPolicy` and
        // active price-sheet `rates` on its `CloseOutJobDeps`. None of the
        // three have a resolution path yet: `ModulePorts`
        // (lib/module-ports.ts) has no `calendarEvents` field (field-tech's
        // `ModulePorts` does — this module's never mirrored it, and
        // `assign-job.ts`/`qualify-lead.ts` share the same gap), and no
        // repository anywhere resolves a tech's `CompensationPolicy` or a
        // price sheet's rate rows. Failing fast here with a descriptive
        // error is the honest option — fabricating a fake calendar-event
        // repository or a placeholder policy/rates would silently corrupt
        // the commission write `closeOutJob` performs unconditionally.
        throw new Error(
          `close-out-and-mark-paid: cannot close out job ${job.id} yet — ` +
            "ModulePorts has no calendarEvents (CalendarEventRepository) field, and " +
            'no repository resolves a CompensationPolicy or active price-sheet rate rows. ' +
            'These are prerequisites for flows/close-out-job.ts\'s closeOutJob(), not ' +
            'introduced by this jobAction registration.',
        );
      },
    },
    // Folded in from the retired payment-review module (Workstream D).
    // Renamed from payment-review's own `mark-paid` id to avoid a future
    // collision now that both actions live in the same module's jobActions
    // array. Same transition: `transitionJob(job, 'paid', ctx)`, but `ctx`
    // comes from this module's own `buildTransitionCtx()` (real injected
    // `session.role`), not payment-review's hardcoded `role: 'admin'`
    // scaffold.
    {
      id: 'admin-finance-mark-paid',
      label: 'Mark Paid',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        await transitionJob(job, 'paid', ctx);
      },
    },
    {
      id: 'schedule',
      label: 'Schedule',
      onInvoke: (job: Job) => {
        router.push('/job/' + job.id + '?panel=schedule');
      },
    },
    {
      id: 'submit-estimate',
      label: 'Submit Estimate',
      visibleWhen: (job: Job) => job.status === 'new' || job.status === 'qualified',
      onInvoke: async (job: Job) => {
        const estimate = await getModulePorts().estimates.getForJob(job.id);
        if (!estimate) return;
        await submitEstimate(estimate, {
          estimates: getModulePorts().estimates,
          ctx: buildTransitionCtx(),
          now: () => new Date().toISOString(),
        });
      },
    },
    {
      id: 'approve-estimate',
      label: 'Approve Estimate',
      visibleWhen: (job: Job) => job.status === 'new' || job.status === 'qualified',
      onInvoke: async (job: Job) => {
        const estimate = await getModulePorts().estimates.getForJob(job.id);
        if (!estimate) return;
        await approveEstimate(estimate, 'approved', {
          estimates: getModulePorts().estimates,
          ctx: buildTransitionCtx(),
          now: () => new Date().toISOString(),
        });
      },
    },
  ],
  migrations: ['0005_money.sql', '0006_job_service_area.sql', '0010_payment_review.sql', '0014_job_planning.sql'],
};

export default adminFinanceModule;
