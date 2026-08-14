/**
 * sales-marketing module registration (P6).
 *
 * Mirrors `modules/field-tech/src/index.ts`'s layering: this file only
 * assembles the `JobcoreModule` object and exports it — the host
 * (`apps/mobile/src/modules.ts`) is the sole caller of `registerModule`,
 * exactly as it is for `fieldTechModule`/`adminFinanceModule`.
 *
 * Supersedes the P1 placeholder (`SalesMarketingScreen`). Wires in the real
 * `SalesMarketingRoot` (`./screens/SalesMarketingRoot`), which composes
 * Review Library / Pitch Picker / Composer / Reporting as tabs, following
 * field-tech's direct-import pattern.
 */

import type { JobcoreModule } from '@jobcore/module-sdk';

import { SalesMarketingRoot } from './screens/SalesMarketingRoot';

/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * requiredRoles gates sales-marketing to sales, admin, and owner — a tech
 * sees no Sales & Marketing entry, mirroring field-tech's role-gating
 * approach (P1 AC-3 / verification step 2).
 */
export const salesMarketingModule: JobcoreModule = {
  id: 'sales-marketing',
  displayName: 'Sales & Marketing',
  requiredRoles: ['sales', 'admin', 'owner'],
  routes: [{ path: 'sales-marketing', component: SalesMarketingRoot }],
  navEntries: [{ icon: 'megaphone', label: 'Sales & Marketing', order: 30 }],
  migrations: [],
};

export default salesMarketingModule;
