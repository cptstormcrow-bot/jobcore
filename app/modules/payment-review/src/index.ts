// JobCore screen #0032 - payment-review - Payment Review
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
import { Redirect } from 'expo-router';
import type { JobcoreModule } from '@jobcore/module-sdk';

import type { SupabaseSelectClient } from './data/ports';
import { ReconciliationView } from './screens/ReconciliationView';

export type { SupabaseSelectClient };
export { ReconciliationView };
export type { ReconciliationViewProps } from './screens/ReconciliationView';

/**
 * Former injection seam for the standalone route's Supabase client. The route
 * now redirects to Admin Finance, so nothing reads the client; the setter stays
 * a no-op so the host (`apps/mobile/app/m/[moduleId].tsx`) keeps compiling.
 */
export function setSupabaseClient(_client: SupabaseSelectClient | null): void {}

/**
 * Root screen for the payment-review route. The standalone route had no app
 * header and no job-number or tech-name lookups, so it redirects to the
 * Admin Finance Review tab (#0089), which renders the same ReconciliationView
 * with the header, the lookups and Open Job.
 */
function PaymentReviewScreen(): React.ReactElement {
  return React.createElement(Redirect, { href: { pathname: '/m/[moduleId]', params: { moduleId: 'admin-finance', view: 'paymentReview' } } });
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
