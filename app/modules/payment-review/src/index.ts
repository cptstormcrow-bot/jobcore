/**
 * payment-review module registration (P5.S2 scaffold; P5.S4 wires the real
 * `hasPaymentRecord` probe).
 *
 * Mirrors `modules/field-tech/src/index.ts`'s registration shape: this file
 * assembles the `JobcoreModule` object and exports it — the host is the sole
 * caller of `registerModule`. `requiredRoles`/`routes`/`navEntries`/
 * `jobActions` remain S2 placeholders; screens and providers land in later
 * slices.
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JobcoreModule } from '@jobcore/module-sdk';
import type { Ctx, Job } from '@jobcore/core';

import { transitionJob } from './domain/transition';
import { hasSettledPaymentForJob, type SupabaseSelectClient } from './data/ports';

/**
 * Injection seam for the Supabase client `hasSettledPaymentForJob` queries.
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
 * Placeholder root screen for the payment-review route. Real screens
 * (handoff QR view, provider confirmation, review capture) are S3+ work.
 */
function PaymentReviewRoot(): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(Text, null, 'Payment & Review'),
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

/**
 * Assembles the `Ctx` a jobAction's `onInvoke` needs to call `transitionJob`.
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
 * displayName / requiredRoles / navEntries follow field-tech's pattern:
 * a documented placeholder assumption for this scaffold slice, not a spec
 * value. owner/admin see this module; a tech does not, since the
 * payment/review handoff flow in this slice is admin-facing configuration
 * only.
 */
export const paymentReviewModule: JobcoreModule = {
  id: 'payment-review',
  displayName: 'Payment & Review',
  requiredRoles: ['owner', 'admin'],
  routes: [{ path: 'payment-review', component: PaymentReviewRoot }],
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
