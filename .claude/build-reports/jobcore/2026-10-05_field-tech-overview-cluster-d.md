---BUILD REPORT---

# Cluster D: Field Tech Overview (tests 7.2 and 8.1)

- Date 2026-10-05; branch jobcore-role-landing-0.1.3; commit e3a7ebc (3 files, +94/-7): app/modules/field-tech/src/index.ts, screens/Overview.tsx, screens/FieldJobDetail.tsx.

## Changes

- 7.2a: "Prems Claimed" group on Overview between Jobs and Time Off; shows "—" when unavailable/errored; tile is non-navigating (intentional no-op, no Prems route from Overview). Source: premQueue.listOpen(userId).claimedByMe.
- 7.2b: Jobs heading is a Pressable calling new onOpenJobs prop (index.ts wires setSubView('jobs')), same screen as Menu > Jobs.
- 7.2c: Overview count now equals DayList count: shared showTestJobs state in index.ts passed to Overview, which prefers the prop over localPref field-tech.jobs.show-test-jobs. DayList.tsx not edited.
- 8.1a: SUBVIEW_LABELS.jobs = 'Assigned Jobs'.
- 8.1b: header fills width; already done in 7826612; device pass pending (Jeff's).
- 8.1c: tapping a job shows admin Jobs detail info minus financial fields (FieldJobDetail "Job details" section: Customer name, Ingress instructions, Permit status, Parking availability, Rooms needing work, Main panel size/style, Considerations; each row only when present).

## Verification

- Karen: tsc PASS (zero errors); npm test 225 passed, 0 failed, 0 skipped; no apps/mobile imports in field-tech/src.
- Commit confirmed via `git show --stat e3a7ebc` on 2026-10-05.

## Forward contracts:

none

## Deviations / Defects

- Scope addition: 8.1c job-detail info went beyond the checkpoint spec (deliberate, per Jeff's test text).
- Omitted from 8.1c: Customer email (not on Job type; would need a new prop), Service, Preferred date/time, Materials/Links/Photos/Notes lists.
- Overview premsClaimed tile deliberately non-navigating.
- Pending: on-device pass for 8.1b (Jeff).
- No defects found in the change's own output.

## Test plan:

declined/deferred: cluster-level; Jeff tests from the 0.3.0 test-results workflow (test results feed the next build).

## Out of scope (untouched)

git push; docs/snapshots/v0.3.0/*; untracked .claude/build-reports/INDEX.md, 2026-10-03_apk-0-3-0-release.md, .claude/state/; AppChrome.tsx; DayList.tsx; ledger shard row; admin-menu items.
