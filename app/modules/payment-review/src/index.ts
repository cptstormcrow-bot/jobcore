/**
 * payment-review module registration (retired; payment review lives under Admin & Finance → Payments; P5.S2 scaffold; P5.S4 wires the real
 * `hasPaymentRecord` probe).
 *
 * Mirrors `modules/field-tech/src/index.ts`'s registration shape: this file
 * assembles the `JobcoreModule` object and exports it — the host is the sole
 * caller of `registerModule`. `requiredRoles`/`routes`/`navEntries`/
 * `jobActions` remain S2 placeholders; screens and providers land in later
 * slices.
 */

import * as React from 'react';
import { LoadingState } from '@jobcore/ui';
import type { JobcoreModule } from '@jobcore/module-sdk';
import type { Ctx, Job } from '@jobcore/core';

import { transitionJob } from './domain/transition';
import { hasSettledPaymentForJob, type SupabaseSelectClient } from './data/ports';
import { ReconciliationView } from './screens/ReconciliationView';

/**
 * Injection seam for the Supabase client `hasSettledPaymentForJob` queries
 * (module retired; payment review lives under Admin & Finance → Payments).
 * Optional-shaped like `module-session.ts`'s session getter (no module has
 * a real Supabase client wired into this module yet — that lands with the
 * real screens, S3+) — `getSupabaseClient` returns `null` rather than
 * throwing, and `buildTransitionCtx`'s `hasPaymentRecord` fails closed
 * (returns `false`) when it is unset, matching `readSyncProbe`'s
 * fail-closed discipline in `state-machine.ts`.
 */
let currentClient: SupabaseSelectClient | null = null;

/** Injection point for the host. The ONLY function that may write `currentClient`. */
export function setSupabaseClient(client: SupabaseSelectClient | null): void {
  currentClient = client;
}

function getSupabaseClient(): SupabaseSelectClient | null {
  return currentClient;
}

/**
 * Root screen for the payment-review route: renders the real
 * `ReconciliationView` once a Supabase client has been injected via
 * `setSupabaseClient`, falling back to `@jobcore/ui`'s `LoadingState`
 * before that.
 */
function PaymentReviewScreen(): React.ReactElement {
  const client = getSupabaseClient();
  if (client === null) {
    return React.createElement(LoadingState);
  }
  return React.createElement(ReconciliationView, { client });
}

/**
 * Assembles the `Ctx` a jobAction's `onInvoke` needs to call `transitionJob`
 * (module retired; payment review lives under Admin & Finance → Payments).
 * Mirrors field-tech's `buildTransitionCtx` shape: no `module-session`/
 * `module-ports` wiring exists for this module yet (that lands with the
 * real screens), so `hasSubmittedStartChecklist`/`hasAfterPhotos`/
 * `hasQualityNotes` remain fixed stand-ins. `hasPaymentRecord` (P5.S4) is
 * the real probe: a partner-paid job (`job.payer !== 'customer'`) skips the
 * payment requirement entirely (P5 acceptance criteria 1-2), matching
 * field-tech's own `hasPaymentRecord` wiring in
 * `modules/field-tech/src/index.ts`; a customer-paid job is satisfied only
 * by a `payments` row in `('confirmed', 'manual_confirmed')`, queried via
 * `hasSettledPaymentForJob` (`./data/ports.ts`).
 */
function buildTransitionCtx(): Ctx {
  return {
    role: 'admin',
    now: () => new Date().toISOString(),
    hasSubmittedStartChecklist: async () => true,
    hasAfterPhotos: async () => true,
    hasQualityNotes: async () => true,
    hasPaymentRecord: async (job: Job) => {
      if (job.payer !== 'customer') {
        return true;
      }
      const client = getSupabaseClient();
      if (client === null) {
        return false;
      }
      return hasSettledPaymentForJob(client, job.id);
    },
  };
}

/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * Module retired; payment review lives under Admin & Finance → Payments.
 *
 * displayName / requiredRoles / navEntries follow field-tech's pattern:
 * a documented placeholder assumption for this scaffold slice, not a spec
 * value. owner/admin saw this module while active; a tech did not, since the
 * payment/review handoff flow in this slice is admin-facing configuration
 * only.
 */
export const paymentReviewModule: JobcoreModule = {
  id: 'payment-review',
  displayName: 'Payment & Review',
  requiredRoles: ['owner', 'admin'],
  routes: [{ path: 'payment-review', component: PaymentReviewScreen }],
  navEntries: [{ icon: 'card', label: 'Payment & Review', order: 30 }],
  jobActions: [
    {
      id: 'mark-paid',
      label: 'Mark Paid',
      onInvoke: async (job: Job) => {
        const ctx = buildTransitionCtx();
        await transitionJob(job, 'paid', ctx);
      },
    },
  ],
  migrations: ['0010_payment_review.sql'],
};

export default paymentReviewModule;
