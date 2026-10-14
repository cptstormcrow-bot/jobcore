---BUILD REPORT---
# Build Report: #0013 Payroll card, Time off retired from admin, Calendar Blackouts (sand)
Date: 2026-10-13 | Project: jobcore | Branch: jobcore-role-landing-0.1.3 | Tier: A

## Request
On screen #0013 add Payroll and remove Time off from both the Overview and the menu. Admin Time off functions live on Calendar: add a Blackouts button, show every scheduled blackout, per-tech checkbox (default on). Use the sand color scheme for buttons and backgrounds. Clarification: the field-tech Time off screen (31) stays so techs can flag unavailable days; it is restyled sand.

## What changed
1. modules/admin-finance/src/domain/overview-cards.ts + __assertions__/overview-cards.assert.ts: Payroll card added (goTop 'payroll'), Time off card and pendingTimeOff subtitle removed. Assertion passes 7/7.
2. modules/admin-finance/src/screens/AdminFinanceRoot.tsx: Time off menu entry and pendingTimeOff wiring removed; timeOffQueue subView kept (unlinked only). Calendar gains sand "Blackouts"/"Hide Blackouts" toggle (testID calendar-blackouts-toggle), sand "Add Blackout" (calendar-add-blackout), and a per-tech checkbox panel (calendar-blackout-tech-<id>) driven by a hidden-tech set, so default is on, including new techs.
3. apps/mobile/app/(tabs)/calendar.tsx: same buttons, hidden-tech set and panel; Add Blackout routes to /m/admin-finance.
4. packages/ui/src/index.ts: exports ./sand (SAND_BG, SAND_TEXT, sandButtonStyle, sandButtonTextStyle, SandButton).
5. modules/field-tech/src/screens/TimeOff.tsx: five SandButtons, SAND_BG on container and sheet; no logic change.
6. packages/ui/src/walkthrough/help-content.ts: three stale Time off references fixed (Rule 31).
Kept, not deleted: TimeOffQueueScreen, BlackoutEditorScreen, BlackoutRangeModal, BlackoutTimeOffList, TimeOffTechCalendar, blackout-calendar-logic.ts, data/time-off-repo.ts. Generated files (admin-finance/dist, docs/snapshots/v0.4.0) not hand-edited.

## Verification
- overview-cards.assert: 7/7 pass.
- Mobile tsc exit 0. Admin-finance tsc reports modules/admin-finance/src/domain/estimate-layout.ts(98,15) TS2532, pre-existing (no diff on that file), not ours.
- Dev server 8081 loads the sign-in page with no console errors.
- NOT performed: in-browser UI verification of #0013, Calendar Blackouts and field-tech Time off. 8081 needs sign-in and credentials were not entered.

## Forward contracts:
- timeOffQueue subView is kept and in HAMBURGER_IDS but unlinked from Overview/menu; its files are retained for shared blackout infrastructure.
- field-tech DateRangeCalendar.tsx re-export shim of @jobcore/ui is untouched.
- BLACKOUT_WEEK_VIEW_KEY (shared by #0047 and #0056) is untouched.
- Optional Payroll step in walkthrough-content.ts not done.
- Rule 41 lineage check, 2026-10-13: prior open contracts are the shim, techNameById, the shared week-view key, help-card hunks in mixed files, migrations 0080-0085 and the 0.4.0 release reconcile. None is resolvable by this change and none needs Jeff's input; the shim and week-view key contracts are honored (not altered).

## Deviations / Defects
- Rule 30: Nestor appended the packages/ui/src/index.ts export via a Bash echo.
- Spot/Nestor blocked twice on CRLF-only files (AdminFinanceRoot.tsx, TimeOff.tsx) and once on a description-style anchor; each fixed with literal/\r\n anchors and expectedCount.
- Pre-existing tsc error estimate-layout.ts(98,15) TS2532 is not caused by this change.
- Browser/UI verification not performed (sign-in required).

## Test plan:
Declined by Jeff at closeout (Rule 43, "No, close out now"). Self-check caveat: UI behavior has only type-check and assertion evidence, no visual verification.

## DEFERRED
none
