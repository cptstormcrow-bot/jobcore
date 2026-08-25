---
title: Fix tsc --build TS2307 — wire @jobcore/payment-review into the project-reference graph
**Status:** APPROVED (2026-08-15)
goal_slug: jobcore-fix-tsc-payment-review-references
classification: plans/vivid-wobbling-meerkat
comments: "vivid wobbling meerkat"
origin: .claude/plans/vivid-wobbling-meerkat.md
tags: [plans, vivid-wobbling-meerkat]
---

## Context

`npx tsc --build --verbose` (run from `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app`) fails with:

```
apps/mobile/app/m/[moduleId].tsx(7,69): error TS2307: Cannot find module '@jobcore/payment-review'
apps/mobile/src/modules.ts(15,37): error TS2307: Cannot find module '@jobcore/payment-review'
```

This was found and deliberately left unfixed during the payment-review host-wiring change
([2026-08-14_payment-review-host-wiring.md](.claude/build-reports/jobcore-mvp-completion/2026-08-14_payment-review-host-wiring.md)),
which logged it as a Rule 25 forward contract: `payment-review` has no `tsconfig.json` of its own
(unlike sibling modules `admin-finance`, `field-tech`, `sales-marketing`, each of which has one),
and it isn't listed as a project reference from either the root `tsconfig.json` or
`apps/mobile/tsconfig.json`.

**Correction to the record.** That build report and the checkpoint that followed it both asserted
"the module resolves at runtime/bundle time (Metro) but not under `tsc --build`" — i.e., that this
was a type-checking-only gap. A fresh sweep of the repo shows that assumption doesn't hold:

- No `metro.config.*` or `app.config.*` exists anywhere in `SDAssemblyPros` — only the static
  `apps/mobile/app.json`, which has no resolver/watchFolders/extraNodeModules keys. Metro is
  running on pure default resolution, which depends on npm-workspaces `node_modules/@jobcore/*`
  symlinks.
- `modules/payment-review` has no `package.json`, so npm has nothing to symlink — there is no
  `name` field for a workspace symlink to key off. `apps/mobile/package.json`'s `dependencies`
  list every sibling module by name except `@jobcore/payment-review`, and `package-lock.json` has
  zero references to `payment-review` anywhere (siblings each appear twice — once under
  `packages["modules/<name>"]`, once as a resolved `node_modules/@jobcore/<name>` link entry).

So this is very likely **also a Metro/EAS bundling failure today**, not just a local `tsc` defect
— the same missing wiring that breaks `tsc --build` means there's almost certainly no
`node_modules/@jobcore/payment-review` symlink for Metro to resolve either. Worth fixing before
burning an EAS build, exactly as flagged.

The fix itself is a mechanical pattern-completion: give `payment-review` the same
`package.json`/`tsconfig.json`/reference wiring every sibling module already has. A full read of
all 11 files under `modules/payment-review/src/` confirms its import profile is a strict subset of
the `admin-finance` template (`@jobcore/core`, `@jobcore/module-sdk`, `@jobcore/ui`, `react`,
`react-native`) — no compile-risk surprises.

## Implementation

**1. Create `modules/payment-review/package.json`**, mirroring `modules/admin-finance/package.json`
   / `modules/field-tech/package.json`:
   - `"name": "@jobcore/payment-review"`, `"private": true`, `main`/`types` → `dist/index.js` /
     `dist/index.d.ts`, matching `exports` block, `"scripts": { "build": "tsc --build" }`.
   - `"dependencies": { "@jobcore/core": "*", "@jobcore/module-sdk": "*", "@jobcore/ui": "*" }`.
   - `"peerDependencies": { "react": "18.3.1" }`, `"devDependencies": { "@types/react": "~18.3.12" }`.
   - No `expo-*` extras (that's sales-marketing-specific) — payment-review's source doesn't import any.

**2. Create `modules/payment-review/tsconfig.json`**, byte-identical in shape to
   `modules/admin-finance/tsconfig.json` / `modules/field-tech/tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "composite": true, "outDir": "dist", "rootDir": "src" },
     "include": ["src"],
     "references": [
       { "path": "../../packages/core" },
       { "path": "../../packages/module-sdk" },
       { "path": "../../packages/ui" }
     ]
   }
   ```

**3. Edit `tsconfig.base.json`** — add to `compilerOptions.paths`, alongside the existing sibling
   entries:
   ```json
   "@jobcore/payment-review": ["modules/payment-review/src/index.ts"],
   "@jobcore/payment-review/*": ["modules/payment-review/src/*"]
   ```

**4. Edit root `tsconfig.json`** — add `{ "path": "modules/payment-review" }` to `references`,
   alongside the existing sibling module entries.

**5. Edit `apps/mobile/tsconfig.json`** — add `{ "path": "../../modules/payment-review" }` to
   `references`. This is the direct fix for both reported TS2307 lines.

**6. Edit `apps/mobile/package.json`** — add `"@jobcore/payment-review": "*"` to `dependencies`,
   alongside the other `@jobcore/*` siblings already listed there. Per the Context section above,
   this is required, not optional — without it there's no workspace linkage for Metro either.

**7. Run `npm install` from `Jobcore\app`** to materialize the new workspace: link
   `node_modules/@jobcore/payment-review`, and update `package-lock.json` with the new package and
   dependency entries. This is a local relink only — every dependency payment-review declares
   (`@jobcore/core`, `@jobcore/module-sdk`, `@jobcore/ui`, `react`, `@types/react`) is already
   installed for sibling modules, so no new external packages need fetching.

All writes route through a scribe-hound (Nestor) dispatch per Rule 30 — two new files plus four
small anchored edits, well under Rule 38's slicing threshold, so this runs as a single dispatch
(or a short `Workflow` pipeline with `agentType: 'scribe-hound'` on the write step, per the
JobCore-work convention in memory `feedback-workflow-tool-standard-dispatch.md`), followed by the
verification run below in the same or a following step.

## Verification

Run `npm run typecheck` (== `tsc --build --verbose`) from `Jobcore\app` and confirm:
- Both TS2307 lines are gone.
- `modules/payment-review` builds clean (first time it's ever entered the build graph — the
  Context section's import audit found no red flags, but this is unverified until the real
  compiler runs it).
- No other workspace project regresses (`packages/core`, `packages/module-sdk`, `packages/ui`,
  `modules/admin-finance`, `modules/field-tech`, `modules/sales-marketing`, `apps/mobile` all still
  build clean).

## Close-out paperwork

- Tier-A build report (Rule 8), with Rule 25 `Forward contracts:` and Rule 37
  `## Deviations / Defects` — the latter notes the correction to the prior checkpoint's
  Metro-resolution claim (Rule 20).
- Close the forward contract logged in
  [2026-08-14_payment-review-host-wiring.md](.claude/build-reports/jobcore-mvp-completion/2026-08-14_payment-review-host-wiring.md)
  and update `jobcore-mvp-completion.md`'s tracking line for this item.
- Regenerate `.claude\checkpoints\INDEX.md` per Rule 32.
- Rename this plan file from the auto-assigned `vivid-wobbling-meerkat.md` to a goal-slug name
  (`jobcore-fix-tsc-payment-review-references.md`) via `git mv`, per memory
  `feedback-plan-naming-goal-slug.md` — done as part of the write dispatch, not in Plan Mode.
