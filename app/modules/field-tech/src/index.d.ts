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
import type { JobcoreModule } from '@jobcore/module-sdk';
import { DayList } from './screens/DayList';
import { StartChecklist } from './screens/StartChecklist';
import { Completion } from './screens/Completion';
import { Greeting } from './screens/Greeting';
import { TimeOff } from './screens/TimeOff';
import { Earnings } from './screens/Earnings';
import { FieldJobDetail } from './screens/FieldJobDetail';
export type { ModuleSession } from './lib/module-session';
export { setModuleSession, clearModuleSession } from './lib/module-session';
export type { ModulePorts } from './lib/module-ports';
export { setModulePorts } from './lib/module-ports';
export type { DayListProps } from './screens/DayList';
export { DayList, StartChecklist, Completion, Greeting, TimeOff, Earnings, FieldJobDetail };
/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * displayName / requiredRoles / navEntries are NOT specified by 00-MASTER-SPEC.md
 * or 01-P1-foundation.md. These values are a documented assumption chosen so that
 * all four seeded roles resolve to DIFFERENT nav sets (P1 AC-3) and a tech sees no
 * Admin entry (P1 verification step 2). Preserved unchanged from the P1 placeholder.
 */
export declare const fieldTechModule: JobcoreModule;
export default fieldTechModule;
//# sourceMappingURL=index.d.ts.map