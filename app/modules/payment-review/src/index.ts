/**
 * payment-review module registration.
 *
 * Mirrors `modules/field-tech/src/index.ts`'s registration shape: this file
 * assembles the `JobcoreModule` object and exports it — the host is the sole
 * caller of `registerModule`. payment-review is a read-only reconciliation
 * screen (`ReconciliationView`); it registers no job actions. Mark Paid is
 * owned by admin-finance, not this module.
 */

import * as React from 'react';
import { LoadingState } from '@jobcore/ui';
import type { JobcoreModule } from '@jobcore/module-sdk';

import type { SupabaseSelectClient } from './data/ports';
import { ReconciliationView } from './screens/ReconciliationView';

export type { SupabaseSelectClient };
export { ReconciliationView };
export type { ReconciliationViewProps } from './screens/ReconciliationView';

/**
 * Injection seam for the Supabase client `ReconciliationView` queries.
 * The host (`apps/mobile/app/m/[moduleId].tsx`) injects the client
 * synchronously in render and clears it (`null`) on unmount.
 * Optional-shaped like `module-session.ts`'s session getter —
 * `getSupabaseClient` returns `null` rather than throwing.
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
 * Root screen for the payment-review route: renders the read-only
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
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * displayName / requiredRoles / navEntries follow field-tech's pattern; hideFromSwitcher does not (see below).
 * owner/admin see this module; a tech does not, since the reconciliation
 * screen is admin-facing. No `jobActions`: the host's job menu is
 * hard-wired and admin-finance alone owns Mark Paid.
 */
export const paymentReviewModule: JobcoreModule = {
  id: 'payment-review',
  displayName: 'Payment & Review',
  requiredRoles: ['owner', 'admin'],
  routes: [{ path: 'payment-review', component: PaymentReviewScreen }],
  navEntries: [{ icon: 'card', label: 'Payment & Review', order: 40 }],
  // Reached via Admin Finance → Review; a logo-switcher entry would duplicate it. /m/payment-review still routes.
  hideFromSwitcher: true,
  migrations: ['0010_payment_review.sql'],
};

export default paymentReviewModule;
