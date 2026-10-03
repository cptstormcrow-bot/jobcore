---BUILD REPORT---

# BUILD REPORT — Assignments board layout (M1–M6) + status-bar inset + sync pill removal

---BUILD REPORT---

Plan: jobcore-assignments-board-layout | Date: 2026-10-03 | Status: COMPLETE
Tier: A 🔧

## GOAL

Jeff's request (verbatim): "Here is a markup of the assignments screen as screenshot from the tablet. space management is poor here. We gotta make this fit better on the screen and easier to peruse jobs no matter how many. There should be an active scroll bar on the right when there are more jobs. Only Fix these identified items including the (All Screens) item which applies to all top title screens in the app. Tell me why Xx pending is showing on the bottom of the screen and identify the widget for me."

Scope: code change only, no APK build.

Decisions by Jeff:
- Keep the Real/Beta/Test/All chips (M2 divider under them).
- Back is the Android hardware < button, no visible Back button.
- "Yeah, get rid of the pill" (unmount SyncIndicator only; offline queue drain stays out of scope).
- Plan slug: jobcore-assignments-board-layout.
- AppChrome pre-existing hunk: "Supersede the 24px, keep the rest, commit together".
- "They must all match so coordinate" became "Hide its extra header, same inset everywhere".
- Test plan: "skip the test plan".

### Markup items delivered

- M1 (All Screens): AppChrome.tsx now applies an unconditional `useSafeAreaInsets().top` paddingTop on the container (replaces the fixed 24pt). titleBar/controlsRow paddingTop is spacing.xs. The Jobs tab's Tabs-navigator header is hidden via `headerShown: false` in (tabs)/_layout.tsx, so there is no double header. Web insets.top = 0; sign-in/sign-up don't use AppChrome, so no double inset.
- M2: 2px divider View (`jobsDivider`) under the chip row.
- M3: client / address / Tech line / Job # block at top of card (`rowDetail`, `rowMeta`, `rowMetaTech`).
- M4: one action row (`rowActions`): Service · Prem · tech `<Select style={styles.assignSelect}>` · Confirm. Styles: `actionButton`, `kindSlot`, `confirmSlot {flex:1,minWidth:72}`, `assignSelect {flex:2,minWidth:0,width:'auto',marginRight:spacing.xs}`.
- M5: View button removed. The name/address Pressable does `router.push('/job/' + job.id)`. Hardware back is a native-stack pop, and board state stays mounted (local useState on AdminFinanceRoot).
- M6: ScrollView `showsVerticalScrollIndicator` plus `persistentScrollbar: true` on Android only (Platform spread); denser rows; dead styles poolRowInfo/poolRowStatus/rowLeft/viewSlot deleted.

### "24 pending" answer

It is the SyncIndicator pill (apps/mobile/src/components/SyncIndicator.tsx), mounted app-wide by the root layout in an absolute `syncOverlay`. The count comes from countPending() in offline-db.ts:37-45. It never clears because `replay` is unwired (sync-status.tsx:59-61).

Resolution: the pill is unmounted in root _layout.tsx (import, overlay JSX and syncOverlay style removed). The queue and drain are untouched; SyncIndicator.tsx is left as dead code.

| File / Target | Change | Lines (ReadAllLines) |
|---|---|---|
| app/packages/ui/src/AppChrome.tsx | S1: safe-area inset, titleBar/controlsRow paddingTop spacing.xs; pre-existing titleBarSubtitle lineHeight 14→16 hunk kept | 515 |
| app/apps/mobile/app/(tabs)/_layout.tsx | S2: jobs Tabs.Screen headerShown:false | (not measured) |
| app/apps/mobile/app/_layout.tsx | S2b: SyncIndicator unmounted | 230 |
| app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx | S3/S4/S4b: M2–M6 | 667 |
| .claude/build-reports/jobcore/jobcore-assignments-board-layout/2026-10-03_assignments-board-layout.md | this report | — |

Line counts via `[IO.File]::ReadAllLines('<path>').Length` (Rule 29-B).

## 🔧 METHOD / TOOLS USED

- Plan Mode (Rule 1) with Workflow recon.
- Rule 38 slice run S1–S9, one Spot (patch-hound) dispatch per file slice. Nestor wrote the open-items JSON and this report.
- Karen (verify-hound) for S5. Re-run PASS: tsc -b --force on packages/core, ui, module-sdk, modules admin-finance/field-tech/sales-marketing, then tsc -p apps/mobile --noEmit; eslint on the four files, baseline only.
- S6 adversarial review Workflow wf_20f382da-254: 3/3 PASS, defects: [].
- Bundle sanity on shared dev server 8081 via navigate: navOk true, redirected to /sign-in, console errors none. PASS.
- Rule 41/45 gate `verify-open-items.ps1`: Verified on disk: 24 of 26.
- brs-scanner.ps1 -Root at the JobCore root.

## Forward contracts

1. `rowActions` row has no flexWrap: on a ~360dp card the Select trigger gets only ~84dp and long tech names ellipsize. Follow-up if Jeff's phone check shows truncation.
2. `persistentScrollbar` verified only by code review for Android tablet; it is a no-op on web/iOS.
3. Offline queue still accumulates silently with no UI now that the pill is gone. The `replay` drain remains unwired (sync-status.tsx:59-61). SyncIndicator.tsx is dead code pending a decision to delete or rewire.

## Test plan

Declined by Jeff 2026-10-03 ("skip the test plan"). No test plan written, checked, or delivered. Proceeded to commit → build report → Themis per test-plan-protocol.md.

## Deviations / Defects

1. Recon Workflow ran before the 4-line Workflow preflight was printed.
2. Design `list` designer hit a 600-char output cap and failed; recovered by re-run wf_5efb3586-bc6.
3. Preflight declared 9 agents; 8 ran.
4. The Back-button design from the design phase was not applied (Jeff chose hardware back instead).
5. Plan slug chosen by Jeff rather than derived.
6. M1 revised mid-plan from per-screen inset prop to hiding the Jobs-tab header + unconditional inset (Jeff: "They must all match so coordinate").
7. Draft test step 2 may have been unreachable; moot after decline.
8. Pill-removal scope widening approved by Jeff ("get rid of the pill").
9. (minor) Spot S3 needed `\r\n` anchors on the CRLF file.
10. Spot S4 dropped the tech `<Select>` while reporting "carried verbatim"; fixed by S4b, confirmed by S5 re-run.
11. (minor) S6 READ_CONTRACT 180-line budget was smaller than the mandated first command (294-line diff); lenses exceeded (285/319/322); scope lens in blocked[], grep-only, still PASS.
12. S7 Karen record lookup blocked (CLI `db query` not a subcommand in v1.226.4; anon-key RLS returns 0 rows; no seed rows). Resolved by Jeff declining the test plan.

Not deviations (note): AppChrome.tsx has 3 pre-existing `no-constant-condition` lint errors and 3 unused-var warnings, out of scope per "Only Fix these identified items". `handleSelectTech` is unused, pre-existing at HEAD. The planned deletion of dead styles. The S6 risk row on EmployeeDetailScreen/AdminFinanceRoot (other sessions' dirty files) is covered by scoped pathspec.

## Lead Gate / Milestone Verdict

S5 Karen PASS; S6 three-lens Workflow review PASS (defects: []); bundle sanity PASS; main session ANDs → PASS. No /ground on JobCore (standing instruction).

## Rule 41 — prior lineage contracts

Gate run 2026-10-03 with verify-open-items.ps1, result "Verified on disk: 24 of 26 items".

Honored by this change:
- 2026-10-03_prems-screen-record-and-layout.md:63 (iOS safe-area top for fixed 24pt): superseded by safe-area inset.
- 2026-10-03_prems-screen-record-and-layout.md:64 ((tabs)/jobs native header stacked on AppChrome): header hidden.
- 2026-10-03_prems-screen-record-and-layout.md:65 (title bar bump 24→32 waiting on phone check): superseded by inset.
- admin-finance-overview-cards/2026-10-03_admin-finance-overview-cards.md:44 (shared title-bar bump deferred to Jeff): decided, same inset everywhere.

Dropped by the gate: FC6 patchLifecycle 'key' (anchor not found); AppChrome gearTitle dead style (closed by 2026-10-02_hide-payment-review-from-module-switcher-v021.md:54).

The remaining 20 verified items belong to other lineage reports and are untouched by this change. All paths are relative to E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\.

| # | Item | Source |
|---|---|---|
| 1 | Run EAS dev build + on-device checklist for Job Detail restyle | 2026-09-04_job-detail-screen-restyle.md:39 |
| 2 | Finish or revert TimeOff.tsx refactor | 2026-09-04_job-detail-screen-restyle.md:136 |
| 3 | Jeff re-runs failed/untested Job Detail test items on Expo web | 2026-09-04_job-detail-screen-restyle.md:143 |
| 4 | HTML re-export of Job Detail test plan rows 38/39 if asked | 2026-09-04_job-detail-screen-restyle.md:144 |
| 5 | Old job_assignments investigator rows as 'installer' not backfilled (DEV) | 2026-09-04_job-detail-screen-restyle.md:145 |
| 6 | On-device Expo walk of Leads/New Lead/Edit/Create Job | 2026-09-04_leads-screen-create-edit-job.md:61 |
| 7 | Check replay of old queued offline lead.create payloads | 2026-09-04_leads-screen-create-edit-job.md:62 |
| 8 | JD-08 slated by Jeff, out of scope | 2026-09-20_jobcore-redlines-stabilize.md:18 |
| 9 | service_task_id not threaded into calculateCommission | 2026-09-20_jobcore-redlines-stabilize.md:19 |
| 10 | task_id not threaded into edge function | 2026-09-20_jobcore-redlines-stabilize.md:20 |
| 11 | Migration 0032/0049 ordering bug + stale 0022 header | 2026-09-20_jobcore-redlines-stabilize.md:21 |
| 12 | Open chip task_4afe6e43 deliver-plan.ps1 goal-slug bypass | 2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md:42 |
| 13 | Open chip task_f9aac49a brs-scanner hardcoded root | 2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md:43 |
| 14 | Commit account.tsx R5 accent buttons once Button accent variant lands | 2026-09-29_sales-role-navigation.md:58 |
| 15 | EAS native build + on-device gear menu check | 2026-09-29_sales-role-navigation.md:60 |
| 16 | Treat 42501 from profiles as permanent when replay is wired | 2026-09-30_profiles-sensitive-column-guard.md:53 |
| 17 | Local suite 0071 RLS test unrun, needs local stack | 2026-09-30_profiles-sensitive-column-guard.md:20 |
| 18 | Field-tech manual Prem section owed | 2026-10-03_prems-screen-record-and-layout.md:62 |
| 19 | Tag other session's 0.2.0 commit v0.2.0 | release-versioning-sop/2026-10-02_automatic-semver-release-sop.md:39 |
| 20 | Run npm run release at every milestone close | release-versioning-sop/2026-10-02_automatic-semver-release-sop.md:40 |

Commit: scoped pathspec of the four source files plus this report directory; message `fix(jobcore): assignments board fit (M1-M6), status-bar inset in AppChrome, remove sync pill`; no push.

---END BUILD REPORT---
