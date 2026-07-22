# Jobcore — Supabase foundation (P1 · S3)

SQL only. No Supabase **client** lives here — `src/lib/supabase.ts` (with the Expo SecureStore
storage adapter) is S4's work, not S3's.

**No live Supabase project exists yet.** Nothing in this directory has been executed against a real
database. Everything below is the protocol to run *once a project is provisioned*; until then all of
S3 is unverified by construction.

## Files

| File | Purpose |
|------|---------|
| `0001_foundation.sql` | Types, tables (`organizations`, `profiles`, `audit_log`), the `current_org_id()` tenancy helper, RLS + every policy |
| `seed.sql` | One organization with all three modules enabled + one user per role |

## Apply order

Order is not cosmetic — each step depends on the previous one existing.

1. **`0001_foundation.sql`** — creates the enum, the three tables, the `security definer` helper, and
   enables RLS. Run it first; `seed.sql` inserts into tables it creates.
2. **Create the four auth users.**
   - *Local dev (`supabase start`)*: skip this step. `seed.sql` inserts the `auth.users` rows itself.
   - *Hosted project*: create four users via the Auth dashboard or the Auth Admin API
     (`owner@` / `admin@` / `tech@` / `sales@sdassemblypro.com`), then replace the four
     `00000000-0000-4000-8000-0000000001NN` ids in `seed.sql` §2/§3 with the real UUIDs and **delete
     the `insert into auth.users` block** — direct writes to `auth.users` are not supported against a
     hosted project.
3. **`seed.sql`** — org, then profiles. Re-runnable (`on conflict do nothing`).

Applying `seed.sql` before step 2 on a hosted project fails on the `profiles.id → auth.users(id)`
foreign key. That failure is correct behavior, not a bug in the seed.

## Test protocol — AC-3 / AC-4 / AC-5

Run each as the named user (an authenticated session, **not** the service role — the service role
bypasses RLS entirely and will make every check below pass vacuously).

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
| 4.4 | `tech@` | `update profiles set role = 'owner' where id = <tech id>` | **must be reviewed — see Known gap below** |
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

If `0001_foundation.sql` is ever edited so a `profiles` policy reads `profiles` **inline** instead of
through `current_org_id()`, step 3.2 will fail with
`infinite recursion detected in policy for relation "profiles"`. That error is the canary for having
broken the `security definer` indirection; it is why every policy is expressed through the helper.

## Known gap — self-service role escalation (4.4)

`profiles_update_self` permits a user to update their own row, and its `WITH CHECK` constrains `id`
and `organization_id` but **not `role`**. As written, a `tech` can in principle promote themselves.
Postgres RLS cannot express a per-column check, so closing this requires either a `BEFORE UPDATE`
trigger that rejects a `role` change unless the caller is owner/admin, or column-level `GRANT`s
revoking `update(role)` from `authenticated`. Deliberately **not** fixed in S3 — it is a schema
addition, and 4.4 above exists to make it fail loudly rather than quietly.
