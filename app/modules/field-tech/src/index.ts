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
import { View, StyleSheet, Alert } from 'react-native';
import { router, useRouter } from 'expo-router';
import { AppChrome, Breadcrumb } from '@jobcore/ui';
import type { JobcoreModule } from '@jobcore/module-sdk';
import type { Job, Ctx } from '@jobcore/core';

import { DayList, type DayListProps } from './screens/DayList';
import { StartChecklist } from './screens/StartChecklist';
import { Completion } from './screens/Completion';
import { Greeting } from './screens/Greeting';
import { TimeOff } from './screens/TimeOff';
import { Earnings } from './screens/Earnings';
import { FieldJobDetail } from './screens/FieldJobDetail';
import { Overview } from './screens/Overview';
import { Reviews } from './screens/Reviews';
import { getModuleSession } from './lib/module-session';
import { getModulePorts } from './lib/module-ports';
import { transitionJob } from './domain/transition';

export type { ModuleSession } from './lib/module-session';
export { setModuleSession, clearModuleSession } from './lib/module-session';
export type { ModulePorts } from './lib/module-ports';
export { setModulePorts } from './lib/module-ports';
export type { DayListProps } from './screens/DayList';

/**
 * Internal sub-view switcher for the field-tech route, mirroring
 * `AdminFinanceRoot`'s state-driven tab pattern (never a navigator — the
 * host's single `path` segment is the only route entry field-tech owns).
 * `Greeting`/`StartChecklist`/`Completion` are per-job flow steps reached
 * from a job in `DayList`, not top-level tabs, so this switcher only
 * covers the screens that render with no per-job prop: the day's job list
 * and the tech's own time-off requests.
 */
type SubView = 'overview' | 'jobs' | 'timeOff' | 'reviews';

function FieldTechRoot(): React.ReactElement {
  const router = useRouter();
  const [subView, setSubView] = React.useState<SubView>('overview');
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [selectedTimeOffId, setSelectedTimeOffId] = React.useState<string | undefined>(undefined);
  const session = getModuleSession();

  if (!session) {
    return React.createElement(
      View,
      { style: styles.screen },
      React.createElement(DayList, null),
    );
  }

  if (selectedJobId !== null) {
    return React.createElement(
      View,
      { style: styles.screen },
      React.createElement(Breadcrumb, {
        segments: [
          { label: 'Field Tech', onPress: () => setSelectedJobId(null) },
          { label: 'Job Detail' },
        ],
      }),
      React.createElement(FieldJobDetail, { jobId: selectedJobId }),
    );
  }

  const menuItems = [
    {
      id: 'overview',
      label: 'Overview',
      isActive: subView === 'overview',
      onPress: () => setSubView('overview'),
    },
    {
      id: 'jobs',
      label: 'Jobs',
      isActive: subView === 'jobs',
      onPress: () => {
        setSelectedTimeOffId(undefined);
        setSubView('jobs');
      },
    },
    {
      id: 'timeOff',
      label: 'Time Off',
      isActive: subView === 'timeOff',
      onPress: () => setSubView('timeOff'),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      isActive: subView === 'reviews',
      onPress: () => setSubView('reviews'),
    },
    {
      id: 'loginsSignInOut',
      label: 'Logins/Sign in/out',
      onPress: () => router.push('/account'),
    },
    {
      id: 'configuration',
      label: 'Configuration',
      onPress: () => {},
      submenu: [
        {
          id: 'configSettings',
          label: 'Settings',
          onPress: () => router.push('/config/settings'),
        },
      ],
    },
  ];

  const SUBVIEW_LABELS: Record<SubView, string> = {
    overview: 'Overview',
    jobs: 'Jobs',
    timeOff: 'Time Off',
    reviews: 'Reviews',
  };

  let content: React.ReactElement;
  switch (subView) {
    case 'timeOff':
      content = React.createElement(TimeOff, { initialSelectedId: selectedTimeOffId });
      break;
    case 'reviews':
      content = React.createElement(Reviews, null);
      break;
    case 'jobs':
      content = React.createElement<DayListProps>(DayList, {
        onSelectJob: (job: Job) => setSelectedJobId(job.id),
        onOpenTimeOff: (event) => {
          setSelectedTimeOffId(event.id);
          setSubView('timeOff');
        },
      });
      break;
    case 'overview':
    default:
      content = React.createElement(Overview, null);
      break;
  }

  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(AppChrome, {
      breadcrumbSegments: [{ label: 'Field Tech' }],
      menuItems,
      optionsItems: [],
      titleBar: { title: 'Field Tech', subtitle: SUBVIEW_LABELS[subView] },
    }),
    content,
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
      id: 'accept-job',
      label: 'Accept',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        const transitioned = await transitionJob(job, 'accepted', ctx);
        await persistTransition(job, transitioned);
        if (job.scheduledStart === null) {
          Alert.alert('Not yet scheduled', 'Ask an admin to schedule this job.');
        }
      },
    },
    {
      id: 'start-time',
      label: 'Start Time',
      onInvoke: async (job: Job) => {
        const ports = getModulePorts();
        const entries = await ports.timeEntries.listForJob(job.id);
        const open = entries.find((e) => e.clockOutAt === null);
        if (open) {
          Alert.alert('Already clocked in', 'Stop the current time entry first.');
          return;
        }
        await ports.timeEntries.clockIn(job.id);
      },
    },
    {
      id: 'stop-time',
      label: 'Stop Time',
      onInvoke: async (job: Job) => {
        const ports = getModulePorts();
        const entries = await ports.timeEntries.listForJob(job.id);
        const open = entries.find((e) => e.clockOutAt === null);
        if (!open) {
          Alert.alert('Not clocked in', 'There is no open time entry for this job.');
          return;
        }
        await ports.timeEntries.clockOut(open.id);
      },
    },
    {
      id: 'complete-job',
      label: 'Complete',
      onInvoke: (job: Job) => {
        router.push('/job/' + job.id + '?panel=completion');
      },
    },
    {
      id: 'jobEstimate',
      label: 'Estimate',
      onInvoke: (job: Job) => {
        router.push('/job/' + job.id + '?panel=jobEstimate');
      },
    },
    {
      id: 'jobInvestigation',
      label: 'Investigation',
      onInvoke: (job: Job) => {
        router.push('/job/' + job.id + '?panel=jobInvestigation');
      },
    },
  ],
  migrations: ['0007_field_tech_tables.sql', '0008_field_tech_jobs_rls.sql'],
};

export default fieldTechModule;
