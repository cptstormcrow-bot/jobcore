---
status: COMPLETE
classification: plans/jobcore-typecheck-and-field-tech-drift
comments: "Jobcore — TypeScript Typecheck Fixes + Field-Tech Architecture Drift"
origin: .claude/plans/jobcore-typecheck-and-field-tech-drift.md
tags: [plans, jobcore-typecheck-and-field-tech-drift]
---

# Jobcore — TypeScript Typecheck Fixes + Field-Tech Architecture Drift

## Context

`npm run typecheck` (root `tsc --build --verbose` from `Jobcore/app`) currently fails across two
unrelated domains:

1. **22 "possibly undefined" diagnostics** in `modules/admin-finance` and `modules/sales-marketing`,
   all downstream of the same root cause: `noUncheckedIndexedAccess` (set in `tsconfig.base.json:10`,
   inherited by every module) makes `T[]`/`Record<string, T>` indexed access return `T | undefined`.
   These are pre-existing test/UI files that were written before the flag's implications were fully
   threaded through, not new regressions.
2. **A field-tech ports-layer bug plus an import-boundary violation**, introduced by two bulk commits
   (`1c216bd`, `615f5bf`) that were never run through `tsc` before landing: a copy-pasted interface name
   in `module-ports.ts` that doesn't match the real export, a missing aggregator function that mobile
   expects to exist, and a UI constant that crossed the module→module import boundary instead of living
   in `packages/ui` where cross-module UI code belongs.

Both domains are pure type-level / wiring fixes — no runtime behavior changes, no exported signatures
change except the one new `packages/ui` export. Fixing them clears `npm run typecheck` to 0 errors.

A third area (mobile Android/EAS build tooling) surfaced during exploration but is **out of scope**
here — see Part C.

---

## Part A — TypeScript Strictness Fixes

Root cause for all four clusters: `noUncheckedIndexedAccess`. Fixes follow the repo's existing idiom —
grep-confirmed **zero uses of the non-null assertion (`!`) anywhere in `modules/`**. Narrowing is always
either `assert.ok()` (Node's `assert/strict`, in test files) or an `=== undefined` early-return guard
(in production files). All four fixes below match one of those two patterns already in use elsewhere in
the same file or sibling files — no new idiom introduced.

The four clusters are mutually independent (different files, no shared symbols). Recommended order is
purely for clean incremental verification: 1 → 2 (admin-finance, then verify that module) → 4 → 3
(sales-marketing, then verify that module).

### Cluster 1 — `modules/admin-finance/src/money/__assertions__/payout-freeze.assert.ts`

Line 45 (`const frozenLine = result.value.lines[0];`) feeds 10 unguarded accesses at lines 61-67 and
70-72. Insert `assert.ok(frozenLine);` immediately after line 45, before the snapshot spread at line 50.
`assert` is already imported at line 14. Matches the existing idiom in `intake-sync.assert.ts:65` and
`rollup.assert.ts:19x` in the same directory.

### Cluster 2 — `modules/admin-finance/src/reporting/__assertions__/group-by.assert.ts`

Two test blocks (`bySource`, `byAttachTiming`) access `groups.<key>` at ~lines 60-74 without narrowing.

**Fix the 4 call sites, not the production return types.** For each access, extract into a local and
guard it:
```ts
const webGroup = groups.web;
assert.ok(webGroup);
// ...use webGroup instead of groups.web in the assert.deepEqual call
```
Apply to `groups.web` / `groups.unknown` (bySource test) and `groups.same_day` / `groups.unknown`
(byAttachTiming test). `byStatus`'s test (lines 40-58) needs no change — `JobStatus` is a closed union
(`packages/core/src/index.ts:57-75`, mirrors a Postgres enum), so indexed access on it doesn't get the
`| undefined` widening.

**Why not retype `bySource`/`byAttachTiming` in `group-by.ts` instead:** those two fields are
deliberately `Record<string, Job[]>` (open keys) because `source`/`attachTiming` are genuinely open-ended
free text with no DB/enum backing — this is documented "honest-unknown discipline" in the source file
itself, unlike `JobStatus` which is a real closed union. `Object.entries()` — the only way the sole
consumer (`ReportsScreen.tsx`) reads these — always returns `[string, V][]` regardless of the source
Record's key type, so retyping would change nothing for that consumer. Guarding the two test call sites
is the correct, minimal fix; the production type is left alone.

### Cluster 3 — `modules/sales-marketing/src/screens/Composer.tsx`

`PLATFORM_GUIDANCE` (lines 52-61) is currently `ReadonlyArray<{platform, label, maxCaptionChars,
aspectRatio}>` — an open array with exactly 2 literal elements. This feeds errors at line 107
(`PLATFORM_GUIDANCE[0].platform` — property access plus a `useState<string>` initializer mismatch) and
at lines 322-345 (`guidance = PLATFORM_GUIDANCE.find(...) ?? PLATFORM_GUIDANCE[0]` plus 3 downstream
property accesses on `guidance`).

Fix at the source: extract the inline object shape into a named `PlatformGuidance` interface, then retype
`PLATFORM_GUIDANCE` as a **fixed 2-tuple**: `readonly [PlatformGuidance, PlatformGuidance]`. Under
`noUncheckedIndexedAccess`, indexed access at a literal in-range index on a tuple type does not get the
`| undefined` widening that open-array indexed access always gets — so this single retype closes the gap
at its source and cascades to fix every downstream site with no further code changes. `PLATFORM_GUIDANCE`
is module-private (no `export`), so this has zero effect on `ComposerProps` or `Composer`'s exported
signature; the `.map()` at line 336 is unaffected (tuples satisfy `ReadonlyArray` iteration).

### Cluster 4 — `modules/sales-marketing/src/screens/ReviewLibrary.tsx`

Line 92 (`const target = reviews[targetIndex];`) feeds 2 unguarded accesses at lines 96-97
(`target.sortOrder`, `target.id`). Insert immediately after line 92, before the `getModulePorts()` call:
```ts
if (target === undefined) {
  return;
}
```
Matches this file's own preceding bounds-check style and the repo-wide `=== undefined` idiom.

### Verification — Part A

```bash
npx tsc --build modules/admin-finance --verbose      # after Clusters 1-2
npx tsc --build modules/sales-marketing --verbose     # after Clusters 3-4
npm run typecheck                                      # full repo, from Jobcore/app
```
Success: all 22 diagnostics across the four files above disappear; full-repo `npm run typecheck` reports
0 errors; no new diagnostics appear anywhere else (expected, since none of these fixes touches an
exported type or function signature).

---

## Part B — Field-Tech Ports Drift + Import-Boundary Violation

Root cause: `1c216bd` and `615f5bf` (2026-08-09/10 bulk P4/P6/P7 commits) were never run through `tsc`
before landing.

### Bug 1 — wrong interface name in `modules/field-tech/src/lib/module-ports.ts`

The file imports and types its `jobs` field as `JobRepository`, but the real export from
`modules/field-tech/src/data/ports.ts:531-534` is `TechJobRepository`. A same-named-but-different
`JobRepository` genuinely exists in `modules/admin-finance/src/data/ports.ts:141` — the evident
copy-paste source of the error. Fix: rename `JobRepository` → `TechJobRepository` in the import list
(lines 19-23) and the `jobs` field type (line 27). Single-point fix, grep-confirmed no other references.

### Bug 2 — missing `buildFieldTechPorts` aggregator in `apps/mobile/src/lib/field-tech-repos.ts`

`apps/mobile/app/m/[moduleId].tsx` already imports and calls `buildFieldTechPorts`, but it doesn't exist
yet — the file only has the 5 individual factory functions (`createChecklistRepository`,
`createJobPhotoRepository`, `createTimeOffRepository`, `createJobNoteRepository`,
`createTechJobRepository`). Fix: add near line 45,
`import type { ModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';`, then append
after line 437 a `buildFieldTechPorts(): ModulePorts` function that assembles the 5 existing factories
1:1 into the `ModulePorts` shape. `[moduleId].tsx` needs no change — its existing call starts resolving
once this export exists.

### Bug 5 — import-boundary violation: relocate `job-status-colors.ts` to `packages/ui`

`modules/field-tech/src/screens/DayList.tsx:21` imports `JOB_STATUS_COLORS` from
`apps/mobile/src/lib/job-status-colors.ts` — a module reaching into `apps/mobile`, which the
project-reference graph (`composite: true` + `references`) forbids in the opposite direction and which
is architecturally backwards regardless (shared UI constants belong in `packages/ui`, not in the mobile
app shell).

Fix:
- **New file** `packages/ui/src/job-status-colors.ts`: a `Record<JobStatus, string>` map (13 entries, one
  per `JobStatus` value) built from the existing `colors.*` tokens in `packages/ui/src/tokens`, mirroring
  the current `apps/mobile/src/lib/job-status-colors.ts` content.
- `packages/ui/src/index.ts`: add `export * from './job-status-colors';` after the existing 9 exports.
- `packages/ui/package.json`: add `"dependencies": { "@jobcore/core": "*" }` (currently only has
  `peerDependencies`) — precedent: `packages/module-sdk/package.json`.
- `packages/ui/tsconfig.json`: add `"references": [{ "path": "../core" }]` (currently has none) — this is
  not optional; without it a composite-project import of `packages/core`'s `JobStatus` type trips a
  TS6307-class project-reference-boundary error, independent of whether `paths` would otherwise resolve
  the import. Precedent: `packages/module-sdk/tsconfig.json`.
- Update the import line in all 4 confirmed real importers to `from '@jobcore/ui'`:
  `modules/field-tech/src/screens/DayList.tsx:21` (this closes the boundary violation itself),
  `apps/mobile/src/components/JobDetail.tsx:9`, `apps/mobile/src/components/WeekView.tsx:6`,
  `apps/mobile/app/(tabs)/calendar.tsx:8`.
- Delete `apps/mobile/src/lib/job-status-colors.ts` plus its 3 stray tracked build artifacts (`.js`,
  `.d.ts`, `.d.ts.map`) — accidentally git-tracked compiled output from `615f5bf`, confirmed isolated to
  this one file via `git ls-files`.

### Follow-up — explicitly out of scope: `modules/admin-finance/src/components/TechColumn.tsx`

`chipVariant()` (lines 54-56) implements a deliberately coarser 2-bucket status grouping than
`JOB_STATUS_COLORS`'s 13-entry map — this reads as an intentional, different semantic model, not a
reduced duplicate that should be unified. Recommendation: leave as-is here and flag it separately as a
product/design question (does admin-finance's coarser grouping still match the current status set?)
rather than folding a UI-semantics decision into this typecheck/drift fix.

### Verification — Part B

```bash
npm run typecheck   # from Jobcore/app
```
Success criteria: no TS2305 in `module-ports.ts`; no TS7006 implicit-any in `DayList.tsx` /
`FieldJobDetail.tsx`; no "cannot find name `buildFieldTechPorts`"; `packages/ui` builds cleanly; zero
remaining matches for the old `apps/mobile/src/lib/job-status-colors` import path anywhere in
`modules/` or `apps/mobile`; the new export appears in `packages/ui/dist`.

---

## Part C — Mobile Android Build Tooling (reference only, not in scope)

Explored for completeness but deliberately not designed here — it's an already-tracked, mostly
manual/human-gated setup process, not a code-design task. Sequencing: Workstream A (Supabase
schema/RLS/migrations) must close before Workstream B (Android EAS Build, 7 phases) begins; Phase 7
(physical-device sideload) explicitly needs Jeff hands-on. Existing DRAFT plans:
`jobcore-supabase-current-then-mobile-build.md` and
`jobcore-workstream-a-closure-then-workstream-b-android.md`. No action from this plan.

---

## Overall Verification

Parts A and B touch disjoint files and are independent — do in either order, or interleave. After both:

```bash
npm run typecheck:clean   # tsc --build --clean, only if a stale .tsbuildinfo masks re-checking
npm run typecheck         # tsc --build --verbose, from Jobcore/app — must report 0 errors
```

Final gate: 0 errors repo-wide, with no new diagnostics introduced in `packages/*`, `modules/field-tech`,
or `apps/mobile` beyond what Part B fixes — expected structurally, since no fix in either part changes an
exported type or function signature except the one new `@jobcore/ui` export.
