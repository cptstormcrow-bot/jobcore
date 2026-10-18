---BUILD REPORT---
# Build report: Leads #0014 + Assignments #0016 — G1 sand buttons, tighter spacing, "Sales & Marketing" nav section

## Request
Give Leads #0014 and Assignments #0016 the G1 sand buttons and tighter spacing, and group Leads under a new "Sales & Marketing" section in the navigation drawer.

## What changed
This report's own commit:
- `app/packages/ui/src/AppChrome.tsx`: optional `section?: string` on MenuActionItem and MenuToggleItem; NavDrawer renders a non-pressable section header Text (styles.sectionHeader) when `section` changes between consecutive items.
- `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`: new `leadInbox` menu item (section 'Sales & Marketing', label 'Leads', goTop('leadInbox')) between Overview and Jobs; no overview screen for the section.
- `app/modules/admin-finance/src/screens/LeadInboxScreen.tsx`: spacing tightened (content.padding md→sm, card.marginBottom md→sm, action.marginBottom sm→xs).
- `docs/snapshots/v0.4.0/_tools/descriptions.json`: #0014 and #0016 summaries updated.
- `handoff/P3-SLICE-LEDGER.md`: +1 screen-notes line dated 2026-10-18.

Already committed earlier in d152b66 (not in this commit): `AssignmentBoardScreen.tsx` G1 buttons + Soonest/Newest sort (assigned dimmed/last), `domain/assignment-pool-sort.ts` + assertion (7 of 7 passing), job tap opens #0041 (`/job/<id>?panel=plan`).

## Verification (2026-10-18)
Type-check passed (tsc -b force build of packages/modules, then tsc -p per project --noEmit). Live check on dev server 8081: drawer shows "Sales & Marketing" header with Leads; Leads spacing visibly tighter; sort buttons present; tapping Job #12 opened `/job/<id>?panel=plan`.

Forward contracts: none

## Deviations / Defects
1. screen-registry.json has no description field, so the description edit went to `docs/snapshots/v0.4.0/_tools/descriptions.json` instead.
2. Snapshots NOT regenerated (generate.mjs not run): the dirty ui-data.json, ui-inventory.html, ui-storyboard.html and screens.json already carry large unexplained churn from other work; regenerating risks mixing it. Consequence: those three generated files are stale for #0014/#0016 until the next intentional regeneration, which will fold in the new descriptions.
3. Assignments code was already committed in d152b66, so this commit contains only the Leads/nav/doc changes.
4. Out of scope and left unstaged (belong to other work): EmployeeInvitationsScreen.tsx, the four snapshot files above, untracked service-tech-gate/ report folder.
5. Not exercised live: the dimmed styling of assigned rows in the pool (covered by assertions + code review only).
6. "Urgency" has no data field; the sort derives it from scheduledStart, requestedWindow and createdAt.

## DEFERRED
none

Test plan: not requested for this change.

Commit/push: No push performed.
