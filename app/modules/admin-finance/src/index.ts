import type { JobcoreModule } from '@jobcore/module-sdk';
import { AdminFinanceRoot } from './screens/AdminFinanceRoot';

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
  ],
  migrations: ['0005_money.sql', '0006_job_service_area.sql'],
};

export default adminFinanceModule;
