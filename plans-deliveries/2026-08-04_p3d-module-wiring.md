---BUILD REPORT---

# Jobcore P3 — P3-d admin-finance module wiring: ports, module session seam, root screen, manifest fill

Tier: A
Goal slug: `jobcore-p3-admin-finance`
Plan of record: `E:\Jeff\.claude\plans\jobcore-p3d-module-wiring.md`
Spec of record: `Jobcore\03-P3-admin-finance.md`
Commit: 705613f — feat(admin-finance): P3-d module wiring - ports, module session seam, root screen, manifest fill (4 files changed, 376 insertions(+), 41 deletions(-))
Files: `app/modules/admin-finance/src/{data/ports.ts, lib/module-session.ts, screens/AdminFinanceRoot.tsx, index.ts}`; ledger of record `handoff/P3-SLICE-LEDGER.md` rows P3d.1-P3d.6

This group is fully UNGATED (no Supabase dependency).

## What changed

`705613f` lands the admin/finance module's wiring layer (P3d.1 through P3d.6), covering ports, a module-local session seam, the module's one root screen, and the manifest fill:

- `app/modules/admin-finance/src/data/ports.ts` — CREATED, 148 lines. `JobRow` snake_case wire shape mirroring every core `Job` field, with `status` typed `string` because wire data is untrusted. `toJob(row: JobRow): Job` maps snake_case to camelCase and is FAIL-CLOSED on unknown status via a module-local `JOB_STATUSES` readonly tuple plus a throw — no `as JobStatus` cast; mirrors `toProfile`/`toOrganization` in `apps/mobile/src/lib/session.tsx`. `JobSchedulingPatch = Partial<Pick<Job,'assignedTechId'|'scheduledStart'|'scheduledEnd'|'requestedWindow'>>` so `{status: ...}` is a TS excess-property error — AC-4 mechanism 1. `JobRepository` (`listForOrganization`, `getById`, `patchScheduling`) has NO status-write method. Also `PriceSheetRepository` (`listForOrganization`, `getActive`) and `PayPeriodRepository` (`listForOrganization`, `getById`). Interfaces plus mapper only — no implementation, sqlite, fetch, fixtures, or React. Money imports use the extensionless relative form (`../money/types`, `../money/rollup`) as the loader shim requires.
- `app/modules/admin-finance/src/lib/module-session.ts` — CREATED, 54 lines. Exports `ModuleSession {org, role, userId}`, `setModuleSession`, `getModuleSession`, `clearModuleSession` over a private module-level holder. Substring "status" appears 0 times — the AC-4 grep-trap fix.
- `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx` — CREATED, 167 lines. The ONE route. Every prop optional (`AdminFinanceRootProps {jobs?, priceSheets?, payPeriods?}`) because the host renders `<Screen />` with no props — module-sdk's `ModuleRoute.component` is a bare `ComponentType`, see `app/apps/mobile/app/m/[moduleId].tsx:52-58`. Internal state-driven sub-view switcher (overview, jobs), NOT a navigator: `route.path` is never read. UI imports `Card`, `ListItem`, `Button`, `EmptyState`, `LoadingState`, `ErrorState`, `colors`, `spacing`, `radius`. `EmptyState` when session is null or no port is injected; `LoadingState` while pending; `ErrorState` on rejection when a port IS injected (`listForOrganization(session.org.id)` inside `useEffect`). Read-only — never writes job status. No import from `apps/mobile`, `@jobcore/module-sdk`, or `../money/`. No new dependency.
- `app/modules/admin-finance/src/index.ts` — EDITED, 61 -> 26 lines. Manifest filled: `routes [{path:'admin-finance', component: AdminFinanceRoot}]`, `navEntries [{icon:'stats-chart', label:'Admin & Finance', order:10}]`, `jobActions` `view-price-sheet` + `add-pay-period-note`, `migrations ['0005_money.sql','0006_job_service_area.sql']`. Removed the `AdminFinanceScreen` placeholder component, its `StyleSheet` block, and the now-unused React / react-native / `@jobcore/ui` imports. The pinned-module-id warning comment (ids are pinned byte-for-byte to `supabase/seed.sql` `organizations.enabled_modules`) was preserved. `hooks` and `settings` deliberately omitted as out of scope. File stays `.ts` (no JSX), which is why the screen is imported rather than defined inline.

### Architectural decision — module-local injection

P3d.2 uses MODULE-LOCAL INJECTION — a host-side `setModuleSession` call over a private holder — rather than a module-sdk context bridge or an app-side wiring edit. Rationale: `apps/mobile/src/lib/session.tsx` cannot be imported by a module without a dependency cycle, and module-sdk exports NO session or context helper. This keeps the dependency edge one-way, adds zero `apps/mobile` and zero `packages/*` changes, and keeps the group ungated. Consequence: until a host injects, `getModuleSession()` returns null and the screen renders its empty state — the same behaviour `jobs.tsx` has today.

### Status — P3d.7: headless half DONE, device half DEFERRED

Slice P3d.7 = P2d.4a folded in as P3-d's closing verification, per Jeff's explicit instruction and his selected split: automatable half now, device half handed to him as a written procedure.

HEADLESS HALF: DONE. New file `app/modules/admin-finance/src/data/__assertions__/replay.assert.ts`, 160 lines. Covers `replayQueue` from `packages/core`: all-succeed 3/0, all-fail 0/2, mixed 1/1, empty 0/0, and send-ordering. Uses in-memory fakes for send/markDone/markFailed. It does NOT import `offline-db.ts` or `expo-sqlite`.

`app/package.json` `"test"` script widened by appending one glob: `modules/admin-finance/src/data/__assertions__/*.assert.ts`.

Results: `npm test` 10/10 passing (5 money + 5 replay), TEST_EXIT=0; `npx tsc --noEmit -p modules/admin-finance` TC_EXIT=0.

DEVICE HALF: DEFERRED, explicitly NOT PASSED. It is the manual procedure in `Jobcore\handoff\P2D-AIRPLANE-MODE-TEST.md` (110 lines), handed to Jeff to run; his PASS/FAIL will be recorded into the ledger and this report afterward. Nothing is marked PASSED that was not observed.

Rationale (recon-established): `apps/mobile/src/lib/offline-db.ts` L7 statically imports `expo-sqlite` and `getOfflineDb` takes no injectable DB, so the sqlite queue cannot be exercised headlessly. But `replayPending` contains no replay/conflict logic — it delegates to `replayQueue` in `app/packages/core/src/offline/replay.ts`. So the headless assertion targets the real logic with zero re-implementation, and sqlite persistence/durability legitimately belongs to the device half.

## Verification

All commands run from `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app`.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck >/tmp/tc.log 2>&1; echo "TYPECHECK_EXIT=$?"` | TYPECHECK_EXIT=0; `grep -i "error" /tmp/tc.log` -> no output. `tsc --build --verbose` rebuilt exactly two projects, `modules/admin-finance` and `apps/mobile`, confirming the new files are in the build graph and consumed downstream rather than orphaned. PASS |
| Lint | `npm run lint >/tmp/lint.log 2>&1; echo "LINT_EXIT=$?"` | LINT_EXIT=0, clean. PASS |
| AC-3 static half | `grep -rn "admin-finance" apps/mobile/app apps/mobile/src` | Exactly one hit, `apps/mobile/src/modules.ts:12`. PASS |
| AC-4 | `grep -rn "status *=" modules/admin-finance --exclude-dir=dist` | No matches (exit 1 = PASS). PASS |
| AC-10 / spec verification step 8 | `grep -rn "sdassemblypro\|GTM-\|G-93R" modules/admin-finance` | No matches (exit 1 = PASS). PASS |

## Forward contracts

1. `getModuleSession()` returns null until a host calls `setModuleSession` — a later slice or phase MUST add that host-side wiring in `apps/mobile`, or the screen permanently renders its empty state.
2. The three repository interfaces in `data/ports.ts` are declarations only; a later slice owes concrete implementations.
3. P3d.7 (the P2d.4a closing verification): headless half has landed (`replay.assert.ts` under `modules/admin-finance/src/data/__assertions__/*.assert.ts`, picked up by the npm test glob, inheriting the permanent inline data-URL `--experimental-loader` shim plus Node >=22.6 type stripping). The device half is outstanding and owes Jeff's observed PASS/FAIL before P2d.4a can close.
4. The `replay.assert.ts` relative-source import (`../../../../../packages/core/src/offline/replay`) must revert to the `@jobcore/core` package specifier once the `packages/core` dist extension defect (Deviation 7) is fixed.

## Deviations / Defects

1. **OPEN.** Ledger row P3d.1's citation `state-machine.ts:202-220` is WRONG. The real file is `app/packages/core/src/state-machine.ts:202-225`. No module-local state machine exists and none was built. Design unchanged; the row text needs correcting.
2. **RESOLVED — corrected before dispatch.** The spec's real AC-4 grep is `grep -rn "status *=" modules/admin-finance` (`03-P3-admin-finance.md:152-153`), NOT `status ===` as the ledger row rationale implies. Design unchanged; the row rationale and the P3d.5 command needed correcting, and were.
3. **OPEN (mechanical necessity, not a design defect).** The AC-4 sweep must pass `--exclude-dir=dist` because a compiled `dist/rollup.assert.js` exists and would otherwise produce false hits.
4. **RESOLVED — self-caught process defect.** The first typecheck run was `npm run typecheck 2>&1 | tail -30; echo "TYPECHECK_EXIT=$?"`, so `$?` reported `tail`'s status, not npm's — that "exit 0" was not evidence. Re-run redirecting to a file before echoing `$?`, which produced the true TYPECHECK_EXIT=0 recorded above.
5. **RESOLVED — Rule 29-B command is authoritative.** Measurement discrepancy: Nestor reported `index.ts` at 27 lines; `(Get-Content '<path>').Count` returned 26. Resolved in favour of the Rule 29-B command — 26 is authoritative.
6. **OPEN.** A new foreign untracked entry, `jobcore-mobile-build-toolchain.md`, appeared at the Jobcore repo root this session. It is NOT in the checkpoint's authorized-foreign list (which names only the five `app/supabase/*` entries), so it was treated as foreign and left entirely untouched.
7. **OPEN (pre-existing, newly exposed).** `packages/core`'s compiled `dist` output emits extensionless ESM re-exports (e.g. `./clocks`), so a runtime value-import of `@jobcore/core` throws `ERR_MODULE_NOT_FOUND` — reproducible after a clean `npx tsc --build`. Not caused by this change; `replay.assert.ts` is the first assertion file in the repo to import a *value* from the package (`rollup.assert.ts` uses `import type` only, which strip-types erases, so no package was ever loaded at runtime before). Fixing `packages/core`'s emitted extensions is OUTSIDE the authorized P3-d file set and affects a shared package — NOT done, left open for Jeff's authorization.
8. **OPEN (workaround consequence of #7).** `replay.assert.ts` imports `replayQueue` via the extensionless relative source path `../../../../../packages/core/src/offline/replay` rather than the `@jobcore/core` package specifier, so the test bypasses the package boundary. `import type` still points at `@jobcore/core`. This is a test-only accommodation for deviation 7 and should be reverted to the package specifier once 7 is fixed.

---BUILD REPORT---
</content>
