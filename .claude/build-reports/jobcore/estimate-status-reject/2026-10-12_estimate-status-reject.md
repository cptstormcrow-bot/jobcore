---BUILD REPORT---
GOAL: Screen #0057 Job Estimate - admin can Reject; bulbs follow status.

RoA: jobcore / BUILD
Plan: n/a | Date: 2026-10-12 | Status: COMPLETE
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\estimate-status-reject\2026-10-12_estimate-status-reject.md

Summary:
- Commit 8f0cd93 on branch jobcore-role-landing-0.1.3. No push.
- Admin can now move a Submitted estimate to Rejected. ADMIN.submitted adds 'rejected'; ADMIN.rejected = draft|submitted; TECH is unchanged, so a tech never gets Rejected.
- New core helper estimateStageFlags(status) returns {estimateComplete: submitted|approved, approvalComplete: approved, rejected}.
- StageInput gained rejected?: boolean; deriveStageStates renders it red, never done (doneAt null).
- EstimateStatusControl got a Rejected chip (danger style) replacing the read-only pill.
- JobProgressBar red Estimate/Approval dots are now tappable.
- JobEstimateScreen handleMove routes rejected through approveEstimate (requires current status submitted).
- approve-estimate.ts stale RLS header fixed (Rule 31).
- job/[jobId].tsx stage inputs use estimateStageFlags (only this session's 3 hunks staged; other sessions' hunks in that file left unstaged).
- JobEstimateEditor handler type widened.
- Result: Submitted -> Estimate green, Approved -> Approval green, Rejected -> both red until resubmitted.

Verification:
- tsc exit 0 (from app/, per jobcore-typecheck-test-runner-quirks recipe).
- npm test 318/318.
- Live DB read-only check: job_estimates.status CHECK allows 'rejected' (no migration).
- Karen PASS; leads Verdin/Curio/Gauge/Scout CONFIRMED.

Test plan: declined by Jeff (Rule 43).

Forward contracts: none

## Deviations / Defects
- none to the approved plan. Note: [jobId].tsx committed partially (3 hunks) because the file carries other sessions' uncommitted edits; those remain unstaged and are owned by those sessions.

Rule 41: prior lineage contracts (help-cards-context-relevant rows 1-3, job-overview-unified-tasks four items, time-off-tech-calendar three items) reviewed 2026-10-12; none resolvable by this change, none needs Jeff's input, none triggered. Honored: yes, nothing dangling.

DEFERRED (Rule 31 deferrals by plan scope):

| Item | Why deferred |
|------|--------------|
| rejection reason / timestamp field + any migration | out of scope, JobEstimate has no such field |
| tech-side resubmit | admin resubmits on #0057 |
| separate Reject shortcut button | out of scope |

Rule 14: no leftovers; scratch chk.sql already deleted.
