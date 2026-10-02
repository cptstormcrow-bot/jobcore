---
classification: sdassemblypros/jobcore
comments: "Jobcore — Supabase foundation (P1 · S3)"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/README.md
tags: [sdassemblypros, jobcore]
---
# Jobcore — Supabase foundation (P1 · S3)

SQL only. No Supabase **client** lives here — `src/lib/supabase.ts` (with the Expo SecureStore
storage adapter) is S4's work, not S3's.

**A hosted Supabase project now exists** (ref `vogkxkcceahtwyovpxsg`). All thirteen migrations
(`migrations/0001_foundation.sql` through `migrations/0013_rls_fixes.sql`) live in `supabase/migrations/` and have been applied to
it, the four auth users have been created, and `seed.hosted.sql` has been applied (`public.profiles`
holds 4 rows). Both hosted RLS suites have been run against it and both passed — but that coverage
is limited to `0001_foundation` and `0004_scheduling`; the newer RLS-bearing migrations (`0005` money,
`0008` field-tech-jobs, `0012` marketing) do not yet have hosted test suites, which is tracked as
separate follow-on work.

## Files

| File | Purpose |
|------|---------|
| `migrations/` | All schema migrations (`migrations/0001_foundation.sql` onward), applied in filename order. Root-level copies no longer exist. Notable: `migrations/0001_foundation.sql` (types, tables, `current_org_id()` helper, RLS), `migrations/0002_profiles_role_column_guard.sql` (closes the self-escalation gap that 4.4 below probes), `migrations/0003_invitations_and_signup.sql` (invitations + signup trigger), `migrations/0004_scheduling.sql` (P2 scheduling core) |
| `seed.hosted.sql` | Prepared hosted variant of `seed.sql` — `auth.users` insert block removed, the four seed uuids substituted globally; apply this instead of `seed.sql` against a hosted project |
| `tests/0001_foundation_rls.hosted.test.sql` | Hosted variant of `tests/0001_foundation_rls.test.sql`, carrying the real auth uuids in place of the placeholder ids |
| `tests/0004_scheduling_rls.hosted.test.sql` | Hosted variant of `tests/0004_scheduling_rls.test.sql`, carrying the real auth uuids in place of the placeholder ids |
| `seed.sql` | One organization with all three modules enabled + one user per role, plus 9 services, 31 service areas (real San Diego County community rows per Master Spec §4), 6 customers, 4 leads, 5 jobs, 3 job assignments |
| `tests/0001_foundation_rls.test.sql` | Foundation assertions — `audit_log` immutability (5.3 / 5.4 below) and the profiles recursion canary. Wrapped in `begin; … rollback;` |
| `tests/0004_scheduling_rls.test.sql` | Scheduling assertions — org isolation (3.1 / 3.5) and a tech seeing only their own assigned jobs (AC-7). Wrapped in `begin; … rollback;` |

## Apply order

Order is not cosmetic — each step depends on the previous one existing.

1. **`migrations/0001_foundation.sql`** — creates the enum, the three tables, the `security definer` helper, and
   enables RLS. Run it first; `seed.sql` inserts into tables it creates.
2. **`migrations/0002_profiles_role_column_guard.sql`** — revokes `update (role)` from `authenticated`. A
   column-level `REVOKE` can only be issued against a column that exists, so it must follow 0001.
3. **`migrations/0003_invitations_and_signup.sql`** — the `invitations` table and the `on_auth_user_created`
   trigger. Depends on `public.user_role` and `public.current_org_id()` from 0001.
   **Apply this before creating any auth user below** — the trigger only provisions profiles for
   users created *after* it exists.
4. **Create the four auth users.**
   - *Local dev (`supabase start`)*: skip this step. `seed.sql` inserts the `auth.users` rows itself.
   - *Hosted project*: create four users via the Auth dashboard or the Auth Admin API
     (`owner@` / `admin@` / `tech@` / `sales@sdassemblypro.com`), then replace the four
     `00000000-0000-4000-8000-0000000001NN` ids **globally across the whole file** (every section, not
     just §2/§3 — the tech id `...0103` also appears in §8 `jobs.assigned_tech_id` and §9
     `job_assignments.tech_id`) with the real UUIDs and **delete the `insert into auth.users` block** —
     direct writes to `auth.users` are not supported against a hosted project. This has already been
     done: `seed.hosted.sql` is the prepared hosted variant with the auth.users block removed and all
     four uuids substituted globally — apply that file instead of `seed.sql` on a hosted project, and
     leave `seed.sql` untouched for local dev.
5. **`migrations/0004_scheduling.sql`** — the P2 scheduling core. Depends on `public.organizations` and
   `public.current_org_id()` from 0001; must follow 0003 (no ordering dependency on 0002).
6. **`seed.sql`** — org, then profiles, then the scheduling data (services, service areas,
   customers, leads, jobs, job assignments). Re-runnable (`on conflict do nothing`). Leads insert with `converted_job_id` set to null; a
   guarded `update` placed after the jobs section sets the one real link, because
   `leads.converted_job_id` references `jobs(id)` and the forward reference cannot be satisfied
   while the leads section runs.
7. **`tests/*.test.sql`** — run last, after the seed. Each file asserts against the seed identifiers
   and rolls itself back, so the database is unchanged either way.

Migrations live in `supabase/migrations/` and apply in filename order. All migrations through
`migrations/0026_close_out_write_rpc.sql` have been applied to the hosted project (ref
`vogkxkcceahtwyovpxsg`). Files `0001`-`0013` were applied in order per each file's own "apply after"
header.

Two gaps in the numbering are known and resolved: `migrations/0022_close_out_failures.sql` and
`migrations/0026_close_out_write_rpc.sql` each carry a header comment naming a dependency (`0021`, `0025`
respectively) that never existed on disk or in git history — resolved as apply-after-previous-in-chain.

`migrations/0027_beta_test_source.sql` was applied after `migrations/0026_close_out_write_rpc.sql` via the same
`supabase db query --file <path> --linked` command, to fix a `jobs_source_check` violation
discovered during live verification of Spawn Test Jobs.

Applied via the Supabase CLI: `npx -y supabase@latest db query --file <path> --linked` (not `db push`
or `db execute`, which do not apply to this repo's non-timestamped `supabase/migrations/*.sql` file layout).
`migrations/0019_time_off_auto_decide.sql` required a workaround to apply: its dollar-quoted function bodies use a
bare `$` delimiter (`as $ ... $;`) instead of the conventional `$tag$`, which the CLI's `db query --file`
Management-API path mis-parses as a syntax error. It was applied from a scratchpad copy with the bare
`$` swapped to `$body$` (semantically identical dollar-quoting) — the tracked source file on disk was
never modified. No other file in `0014`-`0026` carries this pattern.

Applying `seed.sql` before step 4 on a hosted project fails on the `profiles.id → auth.users(id)`
foreign key. That failure is correct behavior, not a bug in the seed.

## Test protocol — AC-3 / AC-4 / AC-5

Run each as the named user (an authenticated session, **not** the service role — the service role
bypasses RLS entirely and will make every check below pass vacuously).

### Automated assertions — `tests/`

The checks below are also encoded as runnable SQL under `tests/`, so they can be executed as a suite
instead of by hand:

| Test file | Covers |
|-----------|--------|
| `tests/0001_foundation_rls.test.sql` | 5.2 (append still permitted), 5.3, 5.4, and the recursion smoke test — from both an owner and a tech session |
| `tests/0004_scheduling_rls.test.sql` | 3.1, 3.5, and AC-7 (a tech sees only their assigned jobs) |
| `tests/0013_rls_fixes_rls.test.sql` | jobs_select_org (supersedes 0004's AC-7/AC-7b/AC-7c under the stricter is_org_sales_or_above() policy), jobs_update_org (net-new — admin-only update, no prior local suite covered this policy), reviews_insert_anon (supersedes 0010's AC-RV-2/AC-RV-2b/AC-RV-2c under the new job_exists_in_org() SECURITY DEFINER helper) |

Each file opens `begin;`, sets `role authenticated` plus `request.jwt.claims` per block, raises an
exception naming the failed criterion on any mismatch, and closes `rollback;`. The same service-role
warning applies: run them as an authenticated session or every assertion passes vacuously.

Both suites have been executed against the hosted project and both passed. On a hosted project, run
the `.hosted.test.sql` variants (which carry the real auth uuids), not the placeholder-id originals.

`tests/0013_rls_fixes_rls.test.sql` / `.hosted.test.sql` has NOT yet been executed against the
hosted project (tooling blocked as of `.crib/a3-verify-unblock-brief.md`); treat as a manual/deferred
verification step until that's resolved.

No dedicated suite exists (or is needed) for `0002_profiles_role_column_guard` — already covered by
`0001_foundation_rls.test.sql`'s AC-4.4. `0006_job_service_area` and `0009_idempotency_keys` add no
RLS policies (service-role-only internal tables) and need no suite either.

### AC-3 — tenant isolation

| # | As | Do | Expect |
|---|----|----|--------|
| 3.1 | `owner@` | `select * from organizations` | exactly 1 row (SD Assembly Pros) |
| 3.2 | `tech@` | `select * from profiles` | 4 rows — the whole org roster, needed for job assignment |
| 3.3 | any | `select public.current_org_id()` | the seeded org id |
| 3.4 | `owner@` | insert a second org, then re-run 3.1 as `owner@` | insert **denied** (no client INSERT policy on `organizations`); org provisioning is service-role |
| 3.5 | service role | insert org B + a profile in org B; then as `owner@` re-run 3.1 | still exactly 1 row — org B is invisible |

3.5 is the real isolation test. 3.1–3.3 only prove the helper resolves; they cannot fail from
cross-tenant leakage when only one org exists.

### AC-4 — role enforcement

| # | As | Do | Expect |
|---|----|----|--------|
| 4.1 | `tech@` | `update organizations set name = 'x'` | 0 rows affected — only `owner` may update the org |
| 4.2 | `owner@` | `update organizations set name = 'SD Assembly Pros'` | 1 row affected |
| 4.3 | `tech@` | `update profiles set full_name = 'Renamed' where id = <tech id>` | 1 row — self-edit is allowed to every role |
| 4.4 | `tech@` | `update profiles set role = 'owner' where id = <tech id>` | denied — `0002` revokes `update (role)` from `authenticated`; the error is a *permission* error, not 0 rows |
| 4.5 | `sales@` | `update profiles set full_name='x' where id = <tech id>` | 0 rows — not self, not admin |
| 4.6 | `admin@` | same as 4.5 | 1 row — `profiles_update_admin` |
| 4.7 | `admin@` | insert a profile with `organization_id` = another org's id | denied by `WITH CHECK` |

### AC-5 — audit log is append-only

| # | As | Do | Expect |
|---|----|----|--------|
| 5.1 | `tech@` | insert an audit row with `actor_id = auth.uid()` | succeeds |
| 5.2 | `tech@` | insert an audit row with `actor_id` = another user's id | denied — `WITH CHECK` forces self-attribution |
| 5.3 | `tech@` | `update audit_log set action='x'` | 0 rows — no UPDATE policy exists, and under RLS the absence of a policy is a denial |
| 5.4 | `tech@` | `delete from audit_log` | 0 rows — same reason |
| 5.5 | service role | `delete from audit_log where created_at < now() - interval '1 year'` | succeeds — retention is deliberately a service-role job |

### Recursion smoke test

If `migrations/0001_foundation.sql` is ever edited so a `profiles` policy reads `profiles` **inline** instead of
through `current_org_id()`, step 3.2 will fail with
`infinite recursion detected in policy for relation "profiles"`. That error is the canary for having
broken the `security definer` indirection; it is why every policy is expressed through the helper.

## Closed gap — self-service role escalation (4.4)

`profiles_update_self` permits a user to update their own row, and its `WITH CHECK` constrains `id`
and `organization_id` but **not `role`** — as written, a `tech` could promote themselves. Postgres
RLS cannot express a per-column check, so the fix lives one layer down in the privilege system:
`migrations/0002_profiles_role_column_guard.sql` issues a column-level `revoke update (role) on public.profiles
from authenticated`. Column privileges are checked *before* RLS, so the write is refused regardless
of what any policy would have permitted.

Role changes are therefore service-role or admin-portal operations only. Test 4.4 above still exists
as the regression probe: if it ever starts succeeding, 0002 was not applied.

## Signup provisioning (0003)

There is no self-serve signup. An owner/admin creates an `invitations` row from the admin portal;
when that person signs up, the `on_auth_user_created` trigger matches the invitation by
lower-cased email, inserts the profile with the invited org and role, and stamps `consumed_at`.
`handle_new_user()` is `security definer` with `search_path = ''` for the same reason as
`current_org_id()` — the new user satisfies none of the insert policies, and an elevated function
must not inherit a caller-controlled resolution path.

### Uninvited signup — `signup_attempts`

An address with no pending invitation still becomes an `auth.users` row: the trigger returns `new`
rather than raising, because a `raise exception` inside an AFTER INSERT trigger rolls the auth user
back and Supabase surfaces only a raw "Database error saving new user" — nothing an admin can act
on later. Instead the trigger writes one `signup_attempts` row (`user_id`, `email`, `attempted_at`)
so an admin can see who tried and extend a real invitation.

`signup_attempts` has RLS enabled and **deliberately no policies**. It has no `organization_id` —
an unmatched signup belongs to no org — so there is no tenant predicate to write, and under RLS the
absence of a policy is a denial. The table is therefore opaque to every authenticated client and is
read with the service role only, the same shape as `audit_log`'s missing UPDATE/DELETE policies.
`handle_new_user()` can still insert into it because `security definer` runs as the owner.

**Client contract:** a signed-in user with no `profiles` row is the orphan state. `current_org_id()`
returns NULL for them and every policy denies, so the app must detect the missing profile at session
start and route to an explanatory screen — not an empty dashboard.

Verify after applying: sign up an invited address and confirm the profile lands with the invited
org + role and the invitation is stamped consumed; then sign up an *uninvited* address and confirm
the auth user exists, **no** `profiles` row was created, and exactly one `signup_attempts` row is
present for that user id.

## Edge Functions

### price-sheet-current
Public price feed for the current published price sheet per organization. Reads via the service-role client only (price_sheets_admin_all / price_sheet_rates_admin_all RLS is admin-only in every direction, so no anon/authenticated read path exists). Deploy REQUIRES --no-verify-jwt (verify_jwt = false) — see functions/price-sheet-current/DEPLOY.md.

### handoff-resolve
Token-based payment-handoff resolution API for the review/handoff flow (GET /:token, POST /:token/providers/:providerId/handoff). Service-role client only, no Supabase auth session. Deploy REQUIRES --no-verify-jwt (verify_jwt = false) — see functions/handoff-resolve/DEPLOY.md.
| `migrations/0046_job_plan_tasks.sql` | applied 2026-09-05 — Adds job_plan_tasks table (per-job catalog task list, live-linked to service_tasks) and extends service_tasks with estimated_minutes, rate, category, active columns. |
