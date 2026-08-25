/**
 * field-tech module registration (P4.S3.8).
 *
 * Full rewrite of the P1 placeholder. Wires in every screen produced by
 * S3.1-S3.7 (DayList, StartChecklist, Completion, Greeting, TimeOff,
 * Earnings, FieldJobDetail), assembles the shared Job Detail `jobActions`
 * (Start / Complete / On-my-way), and declares field-tech's own migrations.
 *
 * Mirrors `modules/admin-finance/src/index.ts`'s layering: this file only
 * assembles the `JobcoreModule` object and exports it — the host
 * (`apps/mobile/src/modules.ts`) is the sole caller of `registerModule`,
 * exactly as it is for `adminFinanceModule`.
 *
 * `jobActions[].onInvoke` closures read `module-ports`/`module-session`
 * (never construct a repository or session locally) and drive any status
 * change exclusively through `domain/transition.ts`'s `transitionJob` —
 * never `applyTransition` directly, per the field-tech ESLint override
 * (S0.4).
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { TabBar } from '@jobcore/ui';
import type { JobcoreModule } from '@jobcore/module-sdk';
import type { Job, Ctx } from '@jobcore/core';

import { DayList } from './screens/DayList';
import { StartChecklist } from './screens/StartChecklist';
import { Completion } from './screens/Completion';
import { Greeting } from './screens/Greeting';
import { TimeOff } from './screens/TimeOff';
import { Earnings } from './screens/Earnings';
import { FieldJobDetail } from './screens/FieldJobDetail';
import { getModuleSession } from './lib/module-session';
import { getModulePorts } from './lib/module-ports';
import { transitionJob } from './domain/transition';

export type { ModuleSession } from './lib/module-session';
export { setModuleSession, clearModuleSession } from './lib/module-session';
export type { ModulePorts } from './lib/module-ports';
export { setModulePorts } from './lib/module-ports';

/**
 * Internal sub-view switcher for the field-tech route, mirroring
 * `AdminFinanceRoot`'s state-driven tab pattern (never a navigator — the
 * host's single `path` segment is the only route entry field-tech owns).
 * `Greeting`/`StartChecklist`/`Completion` are per-job flow steps reached
 * from a job in `DayList`, not top-level tabs, so this switcher only
 * covers the screens that render with no per-job prop: the day's job list
 * and the tech's own time-off requests.
 */
type SubView = 'jobs' | 'timeOff';

function FieldTechRoot(): React.ReactElement {
  const [subView, setSubView] = React.useState<SubView>('jobs');
  const session = getModuleSession();

  if (!session) {
    return React.createElement(
      View,
      { style: styles.screen },
      React.createElement(DayList, null),
    );
  }

  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(TabBar, {
      items: [
        { key: 'jobs', label: 'Jobs' },
        { key: 'timeOff', label: 'Time Off' },
      ],
      activeKey: subView,
      onSelect: setSubView,
    }),
    subView === 'jobs' ? React.createElement(DayList, null) : React.createElement(TimeOff, null),
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

// Re-exported for any caller that needs the individual screens directly
// (e.g. a job-flow navigator wiring Greeting -> StartChecklist -> Completion,
// or a pay-period view wiring Earnings) without a deep import into this
// package's internal file layout.
export { DayList, StartChecklist, Completion, Greeting, TimeOff, Earnings, FieldJobDetail };

/**
 * Assembles the `Ctx` a jobAction's `onInvoke` needs to call `transitionJob`.
 * All four preconditions are wired to this module's own ports, never
 * reimplemented — `canTransition`/`applyTransition` (via `transitionJob`)
 * remain the sole owners of the precondition logic itself.
 */
function buildTransitionCtx(): Ctx {
  const session = getModuleSession();
  const ports = getModulePorts();

  return {
    role: session ? session.role : 'tech',
    now: () => new Date().toISOString(),
    hasSubmittedStartChecklist: async (job: Job) => {
      const instance = await ports.checklist.getInstanceForJob(job.id, 'start');
      return instance !== null && instance.submittedAt !== null;
    },
    hasAfterPhotos: async (job: Job) => {
      const photos = await ports.photos.listForJob(job.id);
      return photos.some((photo) => photo.kind === 'after');
    },
    hasQualityNotes: async (job: Job) => {
      const notes = await ports.notes.listForJob(job.id);
      return notes.some((note) => note.kind === 'quality_notes');
    },
    // field-tech never records a payment record itself; a job whose payer
    // is not the customer satisfies this precondition without one.
    hasPaymentRecord: async (job: Job) => job.payer !== 'customer',
  };
}

/**
 * Persists a `transitionJob` result and logs the transition to the
 * calendar, mirroring admin-finance's `qualify-lead.ts` flow pattern
 * (transition -> persist status -> log calendar event). `getModulePorts()`
 * is safe to call again here — it just returns the already-injected
 * singleton, not a fresh construction.
 */
async function persistTransition(originalJob: Job, transitionedJob: Job): Promise<void> {
  const session = getModuleSession();
  const ports = getModulePorts();
  const techId = session ? session.userId : originalJob.assignedTechId ?? '';

  await ports.jobs.updateStatusAsTech(transitionedJob.id, techId, transitionedJob.status);
  await ports.calendarEvents.logOwnTransition(
    transitionedJob.organizationId,
    transitionedJob.id,
    originalJob.status,
    transitionedJob.status,
  );
}

/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * displayName / requiredRoles / navEntries are NOT specified by 00-MASTER-SPEC.md
 * or 01-P1-foundation.md. These values are a documented assumption chosen so that
 * all four seeded roles resolve to DIFFERENT nav sets (P1 AC-3) and a tech sees no
 * Admin entry (P1 verification step 2). Preserved unchanged from the P1 placeholder.
 */
export const fieldTechModule: JobcoreModule = {
  id: 'field-tech',
  displayName: 'Field Tech',
  requiredRoles: ['owner', 'admin', 'tech'],
  routes: [{ path: 'field-tech', component: FieldTechRoot }],
  navEntries: [{ icon: 'construct', label: 'Field Tech', order: 20 }],
  jobActions: [
    {
      id: 'on-my-way',
      label: 'On my way',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        const transitioned = await transitionJob(job, 'en_route', ctx);
        await persistTransition(job, transitioned);
      },
    },
    {
      id: 'start-job',
      label: 'Start',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        const transitioned = await transitionJob(job, 'in_progress', ctx);
        await persistTransition(job, transitioned);
      },
    },
    {
      id: 'complete-job',
      label: 'Complete',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        const transitioned = await transitionJob(job, 'completed', ctx);
        await persistTransition(job, transitioned);
      },
    },
  ],
  migrations: ['0007_field_tech_tables.sql', '0008_field_tech_jobs_rls.sql'],
};

export default fieldTechModule;
