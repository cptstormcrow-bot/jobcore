---BUILD REPORT---

## Method / Tools
#0057 Job Estimate — round 2 (test-feedback fixes). Tier-A. Date 2026-10-18. Branch jobcore-role-landing-0.1.3. Uncommitted at time of writing; committed right after, no push. Type-check run per memory jobcore-typecheck-test-runner-quirks; browser check on the 8081 dev server.

## Request (Jeff)
Fixes from Jeff's test feedback on round 1: remove ALL-CAPS labels and the "ESTIMATE"/"draft" text; keep the status toggles unmoved; place the Copy estimate link and the Total Estimate beside the toggles; give Materials Onsite a check-mark look with a visible label.

## Changes (files)
- app/modules/admin-finance/src/screens/JobEstimateScreen.tsx: removed ALL-CAPS labels; removed "ESTIMATE"/"draft" text; status toggles (Draft/Submitted/Approved) are content-width and unmoved (statusControlWrap alignSelf flex-start); Copy estimate link button hugs its text (linkRowHug; linkChip paddingHorizontal spacing.md -> spacing.sm); new statusCenterGroup (testID estimate-center-group) in the same row as the toggles, flex:1, centered, holding the link button and the "Total Estimate" label + total; Materials Onsite checkbox uses variant "check" with its own-line visible label "Materials Onsite?" in the left column below the Tracking Number field; removed totalText/linkSlot from the EstimateChrome interface.
- app/apps/mobile/app/job/[jobId].tsx: removed the estimate-tab-center View and tabCenter/tabTotal* styles; tabBarWrap now {}.
- app/packages/ui/src/Checkbox.tsx: added optional accessibilityLabel and variant ('box'|'check', default 'box'); 'check' = bordered box with bold primary-color check glyph. Default behavior unchanged. DefaultTabBar.tsx untouched.

## Findings
- Total/UPS item 1.7 "UPS error" is configuration, not code: the error is `ups-not-configured` (missing UPS credentials). Follow-up candidate: clearer user-facing message.
- "Service Area: Carlsbad" seen by Jeff was the pre-existing line above the checkbox, not a regression.

## Verification
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing`: PASS.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`: PASS (Karen, after Spot's final edit).
- Browser check on 8081 at innerWidth 640: center group sits on the toggles' row, Draft/Approved x-positions (17, 223) equal the desktop baseline, no overlap, no clipping.
- NOT verified: toggle vertical position at a true 520px width; tappability of the group; Payroll and DayList bars (shared DefaultTabBar, unmodified).

## Forward contracts:
none. (If a narrow viewport cannot fit the group beside the toggles, moving it below the toggles is Jeff's call.)

## Deviations / Defects
- Scope extension: packages/ui Checkbox edited (variant + accessibilityLabel), outside the original screen-only scope; needed for the check-mark look.
- Label reversal: Jeff first said "lose the label" (1.4), then asked for "Materials Onsite?" back on its own line; final state has a visible label.
- Main-session direct edits under Rule 30's 200-char carve-out: label text changes, own-line label, tabCenter position tweaks (top 55 / height 44), zIndex 10, interface-line deletion.
- EstimateChrome.linkSlot/totalText removed after a TS2345 (onChrome payload lacked required totalText); fixed by deleting the fields.
- Overlay-then-in-flow reversal: the absolute-positioned overlay approach clipped/vanished/clipped text below; replaced by in-flow layout in the toggle row.
- Spot changed linkChip padding (spacing.md -> spacing.sm) to stop overlap/clipping at narrow width (earlier 520px finding: overlap with "Approved", clipped Total).
- Rule 18 hound-narration was partly missed earlier in the session.
- Possible dead code: handleShareRef in JobEstimateScreen.tsx; unverified, left in place.
- Defects: none known in the final output beyond the unverified items above.

## Test plan:
Declined by Jeff (Rule 43); no test plan issued for round 2. The round-1 plan on Desktop is stale.

## Summary
#0057 round 2 removes the ALL-CAPS labels and "ESTIMATE"/"draft" text, keeps the status toggles unmoved, puts the Copy estimate link and Total Estimate in a centered group on the toggles' row, and gives Materials Onsite a check-mark look with a visible label. Uncommitted at time of writing; committed right after, not pushed.
---END BUILD REPORT---
