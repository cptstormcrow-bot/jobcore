/**
 * Compile-time module registration — the ONLY file in apps/mobile permitted to
 * name a specific module. (01-P1-foundation.md verification step 5 greps
 * apps/mobile/src for the three module ids; any hit outside this file is a
 * broken plug-in contract.)
 *
 * Imported for side effects exactly once, from app/_layout.tsx. Adding a module
 * is a build: a new workspace package plus one line here. Enabling one is a
 * config change: organizations.enabled_modules.
 */
import { registerModule } from '@jobcore/module-sdk';
import { adminFinanceModule } from '@jobcore/admin-finance';
import { fieldTechModule } from '@jobcore/field-tech';
import { salesMarketingModule } from '@jobcore/sales-marketing';
import { paymentReviewModule } from '@jobcore/payment-review';

registerModule(adminFinanceModule);
registerModule(fieldTechModule);
registerModule(salesMarketingModule);
registerModule(paymentReviewModule);
