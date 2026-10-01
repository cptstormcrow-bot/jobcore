-- 0073_enable_payment_review_module.sql
-- Enables the payment-review module for every existing organization that does
-- not already have it. The module is registered in apps/mobile/src/modules.ts and
-- resolved via getEnabledModules(org, role), so it only appears once the org's
-- enabled_modules array contains 'payment-review'. Seeds (seed.sql,
-- seed.hosted.sql) were updated in the same change for fresh databases.
-- Idempotent: the WHERE guard skips orgs that already list the module.

update public.organizations
set enabled_modules = array_append(enabled_modules, 'payment-review')
where not ('payment-review' = any(enabled_modules));
