/**
 * Development switches for the admin-finance module.
 *
 * DEV_NO_TECH_DISTINCTION — while JobCore is still in development (no real
 * jobs are dispatched yet), every active tech can take any job: the Assignments
 * board's real/test tech filters (test-employee toggle, test-jobs-only) are
 * bypassed. Owner and admin accounts are still never offered as techs.
 *
 * This is a plain constant on purpose, not `__DEV__`: release APKs compile
 * `__DEV__` to false, and the app is tested on device builds.
 *
 * Restore the real/test tech distinction (set false) before real jobs go live — forward contract.
 */
export const DEV_NO_TECH_DISTINCTION = true;
