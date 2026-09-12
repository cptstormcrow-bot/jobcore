-- Jobcore P1 — S3 forward contract #4 / S4 forward contract #8
-- Closes the self-role-escalation gap: profiles_update_self (0001_foundation.sql)
-- lets a user update their own profile row, and RLS has no column granularity —
-- USING/WITH CHECK can gate which rows an update touches, never which columns.
-- That means profiles_update_self alone permits
--   update profiles set role = 'owner' where id = auth.uid()
-- Column-level GRANT/REVOKE is a separate, older Postgres mechanism that
-- composes with RLS rather than replacing it: RLS filters rows, this filters
-- columns, and both are enforced on the same statement.
--
-- Effect: no authenticated-role client can UPDATE profiles.role, full stop —
-- profiles_update_admin included, since column privileges apply above RLS
-- regardless of which policy would otherwise allow the row. Role changes
-- become a service-role-only operation (Supabase Studio / dashboard), which
-- bypasses standard grants and RLS entirely.

revoke update (role) on public.profiles from authenticated;
