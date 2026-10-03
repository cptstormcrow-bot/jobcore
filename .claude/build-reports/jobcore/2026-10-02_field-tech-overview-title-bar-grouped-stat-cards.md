---BUILD REPORT---
Project: jobcore
Date: 2026-10-02
Tier: A
Branch: jobcore-role-landing-0.1.3
Plan: E:\Jeff\.claude\plans\field-tech-overview-tweaks-title-bar-grouped-stat-cards.md
Summary: Field Tech Overview tweaks — wider/lower shared title bar, pill-only "Overview" subtitle in white normal weight, six grouped stat cards with tighter vertical spacing.

## Goal
Jeff supplied a marked-up photo of the Field Tech Overview screen: widen and lower the title bar and menus; put "Overview" tight under "Field Tech" inside the title pill in white normal text; group the stats under Jobs / Time Off / Reimbursements / Notes / Photos / Checklist; reduce vertical white space between and within cards; leave the footer SyncIndicator untouched.

## Decisions (Jeff, via AskUserQuestion)
- One card per group, six cards, group name as title, stats side by side.
- Merge Reimbursements (pending/approved/rejected) and Checklist (open + submitted) into single cards.
- Pill only: the body "Overview" heading is deleted; the pill subtitle is white, normal weight, tightened under the title.
- Title-bar change applies to all screens via the shared AppChrome.
- Test plan: declined.

## Files changed
| File | Change |
|------|--------|
| app/packages/ui/src/AppChrome.tsx | Styles only (13 lines): controlsRow lower padding (paddingTop md+sm, paddingBottom xs, paddingHorizontal sm); iconButton paddingHorizontal xs; titleBar marginHorizontal xs (wider); titleBarTitle lineHeight 18; titleBarSubtitle fontSize 12, lineHeight 14, fontWeight 400, color white, opacity removed. |
| app/modules/field-tech/src/screens/Overview.tsx | Body "Overview" heading removed; stats rendered as six group cards (Jobs, Time Off, Reimbursements, Notes, Photos, Checklist) via groups.map with groupCard/groupTitle/statsRow/stat/statValue/statLabel styles; container and card padding/margins tightened (spacing.sm); each stat carries a drillLabel used for the drill-down list heading so merged short labels stay unambiguous. Tap-to-drill-down and time-off navigation preserved. |

## Verification
- Type-check: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` then `npx tsc -p apps/mobile/tsconfig.json --noEmit` — PASSED.
- Ultracode review workflows: wf_801f491f-fb1 (AppChrome PASS; Overview one major finding, fixed in rev 3) and wf_18642b25-c80 (Overview rev 3 PASS, two nits).
- Spot (patch-hound) disk check of the "dead cardValue/cardLabel styles" nit: PASS, nothing dead.
- Visual check in the running app: not performed this session (Jeff declined a test plan; no self browser-check per standing instruction).

## Rule 41 — prior forward contracts
Prior JobCore reports checked in the canonical root: 2026-10-02_hide-payment-review-from-module-switcher-v021.md (Forward contracts: none) and 2026-10-02_role-based-login-landing-home-removed.md (Forward contracts: none new). No open contracts to honor.

Forward contracts: none.

Test plan: declined (Jeff: "No, skip it") (Rule 43).

## Deviations / Defects
- Rule 18: one early Explore dispatch was sent without the one-line chat narration. Later dispatches carried it.
- Slice B rev 1 spec dropped the stat-tile tap behavior; Spot returned CONTRADICTION and rev 2 restored it before any write landed.
- Review found a drill-down heading label collision after the Reimbursements/Checklist merges (e.g. "Pending" ambiguous); fixed in rev 3 with per-stat drillLabel values. PASS on re-review.
- Review nit "dead cardValue/cardLabel styles" refuted on disk by Spot; no edit.
- AppChrome review nits considered, no action: fontWeight '400' with a custom body font on Android; top padding may stack with a parent safe-area inset.

## Out of scope / excluded from commit
app/apps/mobile/src/components/SyncIndicator.tsx; app/supabase/migrations/0074_reapply_0032_task_pricing_alter.sql (untracked); app/apps/mobile/src/lib/admin-finance-repos.ts; pre-existing modification to .claude/build-reports/jobcore/2026-10-02_hide-payment-review-from-module-switcher-v021.md.

## Delivery
Committed in-repo at the canonical path above; delivered by path in chat (JobCore exception — no Desktop copy).
---END BUILD REPORT---
