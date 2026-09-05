---BUILD REPORT---

# Leads screen with New Lead, Edit Lead, and Create Job (lead → qualify)

Date: 2026-09-04
Project: jobcore
Branch: jobcore-job-detail-action-buttons
Tier: A
Commit: pending — filled by closeout commit

## Goal
Jeff (verbatim): "In Jobcore, Admin&Finance Overview, there is a card under Leads called "New Leads" that creates a new lead. That is exactly what I want *moved to the top of the Leads screen, with a list of the created and waiting leads below it to act on and that you can drill into the Lead edit screen. I also need a Create Job button in the Lead edit screen so that the admin can turn it into a job to assign."

## Decisions locked
Edit screen exposes all fields as editable with Save via a new `update(leadId, patch)` lead port; Create Job follows "Qualify, then create" by reusing `qualifyLead` (creates the customer + job in `'qualified'` status and marks the lead converted; requires an address and preferred date); the waiting list below the New Lead entry point shows all unconverted leads newest-first via `selectInboxLeads`, keeping the "Needs info" pill; data bugs found along the way were fixed in this same change.

## Implementation summary
10 slices all DONE.
- S1 `app/modules/admin-finance/src/data/lead-repo.ts` (new) + `app/modules/admin-finance/src/data/__assertions__/lead-repo.assert.ts` (new): Supabase lead adapter with snake_case↔camelCase mapping on reads and writes, plus `update`.
- S2 `app/modules/admin-finance/src/data/ports.ts`: `update(leadId: string, patch: LeadPatch): Promise<Lead>` added to the lead port.
- S3 `app/apps/mobile/src/lib/admin-finance-repos.ts`: wires `update`.
- S4 `app/modules/admin-finance/src/screens/QualifyScreen.tsx`: `disabled?: boolean` prop (AxisPicker.tsx unchanged).
- S5 `app/modules/admin-finance/src/domain/intake-normalize.ts` + its assert file, `app/modules/admin-finance/src/fixtures/raw-leads.ts`, `app/modules/admin-finance/src/domain/lead.ts`: source default changed 'direct' → 'website' to match DB constraint `leads_source_check` (website|costco|ikea|owm, migration 0022); `DEFAULT_AXIS_VALUES.source` is the single source of truth.
- S6 `app/modules/admin-finance/src/screens/LeadCreateScreen.tsx`: source picker limited to constraint values, consumes `DEFAULT_AXIS_VALUES`.
- S7 `app/modules/admin-finance/src/screens/LeadInboxScreen.tsx`: `onCreateLead` prop, 'New Lead' button at top, title 'Leads'.
- S8 `app/modules/admin-finance/src/screens/LeadEditScreen.tsx` (new, 245 lines): all-fields editor, Save, Create Job button.
- S9 `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`: sub-view wiring leadInbox → leadCreate/leadEdit → qualify; 'New Lead' row removed from Overview Leads card.
- S10 docs: `docs/intake-contract.md`, `00-MASTER-SPEC.md`, `sdassembly-scheduling-app.md`, `app/docs/fragments/03-ch3.html`, `app/docs/jobcore-basics-admin-finance.html`.

## Verification gates (Rule 29-B, all run from `app/`)
- `npm test` → pass 101 / fail 5 (the 5 are pre-existing `ERR_MODULE_NOT_FOUND` `.js.ts` imports in `packages/core/src/offline/__assertions__/*.assert.ts`).
- `npm run typecheck` → exit 2, 4 errors, all pre-existing from in-flight uncommitted work: `apps/mobile/app/job/[jobId].tsx` lines 159 & 344 (`JobFormValues`); `admin-finance-repos.ts` line 783 (`getInvestigatorTechId`); line 1453 (`listForJob`) — confirmed via git diff.
- `git diff --stat` over the slice set: 15 files changed, 275 insertions(+), 82 deletions(-), excluding 3 new untracked files.
- grep: zero `'direct'` literals remaining in admin-finance src.

## Files changed
Modified (M):
- app/modules/admin-finance/src/data/ports.ts
- app/apps/mobile/src/lib/admin-finance-repos.ts
- app/modules/admin-finance/src/screens/QualifyScreen.tsx
- app/modules/admin-finance/src/domain/intake-normalize.ts
- app/modules/admin-finance/src/domain/lead.ts
- app/modules/admin-finance/src/fixtures/raw-leads.ts
- app/modules/admin-finance/src/screens/LeadCreateScreen.tsx
- app/modules/admin-finance/src/screens/LeadInboxScreen.tsx
- app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx
- docs/intake-contract.md
- 00-MASTER-SPEC.md
- sdassembly-scheduling-app.md
- app/docs/fragments/03-ch3.html
- app/docs/jobcore-basics-admin-finance.html

New (untracked, NEW):
- app/modules/admin-finance/src/data/lead-repo.ts
- app/modules/admin-finance/src/data/__assertions__/lead-repo.assert.ts
- app/modules/admin-finance/src/screens/LeadEditScreen.tsx

Diffstat (git diff --stat over the slice set): 15 files changed, 275 insertions(+), 82 deletions(-), excluding 3 new untracked files.

Forward contracts:
- FC1: On-device Expo walk of Leads → New Lead → Edit → Create Job (device-gated, cannot run here).
- FC2: Queued offline `lead.create` payloads written before this change carry camelCase keys; replay against the new adapter should be checked once a device queue exists.

## Rule 41 honored-contracts statement
Prior open lineage forward contracts (job-detail-restyle FC1 eas build/on-device; field-tech Expo smoke check, assert runner, eas-build FC, RLS suite) are all hardware/device-gated and not resolvable in this session; left open, unchanged.

## Deviations / Defects
1. DEV1: Workflow slices S5/S6/S10 were blocked by a wrong plan-file path in their prompts; completed by direct Nestor redispatch.
2. DEV2: S9/Verify used the Desktop plan mirror instead of the canonical plan path.
3. DEV3: 5 pre-existing offline assert failures, not fixed (out of scope).
4. DEV4: 4 pre-existing typecheck errors from in-flight uncommitted restyle work, not fixed (out of scope).
5. DEV5: In-flight uncommitted hunks ride along in ports.ts, admin-finance-repos.ts, LeadCreateScreen.tsx because the commit is by whole-file pathspec.
6. DEV6: S11 live DB constraint check not performed: installed Supabase CLI has no `db query` subcommand (`--project-ref`/`--linked` also unknown). Relied on migration 0022 DDL for `leads_source_check`.

## Next (closeout order remaining)
Themis ledger reconciliation → git-audit/commit proposal → memory updates. No `/ground` on JobCore. Delivered by reporting the path in chat (JobCore convention); no Desktop copy.

---END BUILD REPORT---
