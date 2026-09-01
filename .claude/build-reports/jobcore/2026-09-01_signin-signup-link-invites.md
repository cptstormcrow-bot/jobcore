---BUILD REPORT---
GOAL: Added a self-serve path into JobCore's existing invitation-only signup model and finished the
admin-side invitation lifecycle. The sign-in screen now carries a link into sign-up (previously
sign-up was reachable only by direct URL), and a `EmployeeInvitationsScreen.tsx` was built and wired
into `AdminFinanceRoot.tsx`/`EmployeeRosterScreen.tsx` so admins can see pending invitations and revoke
them, using the already-existing `InvitationRepository.listPendingInvitations`/`revokeInvitation`
ports against the `public.invitations` schema in `app/supabase/0003_invitations_and_signup.sql`. This
closes the gap where invitations could be created and consumed but never listed, reviewed, or revoked
from the admin UI, and where a new user with an invitation had no discoverable way into the sign-up
form. Integrates with the admin-finance module's existing screen-routing / SubView pattern; no new
backend schema was needed since 0003 already had the RLS-scoped table and policies this screen reads.

RoA: jobcore / BUILD
Plan: signin-signup-link-invites | Date: 2026-09-01 | Status: COMPLETE
Why: Closed two gaps in the invitation flow — no sign-in-to-sign-up path, and no admin-facing way to
view or revoke pending invitations (the "Invitation sent." misleading-success copy is also fixed as
part of this same change). Admins can now manage the full invitation lifecycle from the app, and new
invitees can find the sign-up form from the sign-in screen.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-09-01_signin-signup-link-invites.md
Forward contracts: none


🔧 METHOD / TOOLS USED
- Read + Edit on `sign-in.tsx`, `EmployeeEditorScreen.tsx`, `EmployeeRosterScreen.tsx`, `AdminFinanceRoot.tsx` — small anchored edits, each under Rule 30's write-delegation threshold except where routed through a scribe hound.
- New file `EmployeeInvitationsScreen.tsx` authored via scribe-hound (Nestor), mirroring `EmployeeRosterScreen.tsx`'s existing load-state-machine pattern exactly — no new pattern introduced.
- `git diff` / `git log` used for Rule 42 ownership triage on the working tree before committing, to separate this change's hunks from unrelated in-flight work (TimeOffStatus widening, Slice D task-level pricing, parseCalendarDate, handleArchived removal).
- Git-plumbing hunk isolation (`git reset`, `git apply --cached` against a hand-built inclusion-only patch, `git diff --cached` verification) used to split `AdminFinanceRoot.tsx`'s 8 hunks into 4 in-scope (this change) / 4 out-of-scope (unrelated in-flight work, left unstaged) — gotcha: the auto-mode permission classifier blocked plain `git add` on this file twice before the scoped-patch approach succeeded.
- Manual live verification in the running app (sign in, navigate to sign-up via the new link, navigate to the invitations list, revoke an invitation, confirm removal) — no automated test suite exists for this module.

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| app/apps/mobile/app/sign-in.tsx | Added a "Sign up" link/button navigating to the sign-up route | edited |
| app/modules/admin-finance/src/screens/EmployeeInvitationsScreen.tsx | New pending-invitations list screen with per-row Revoke action | created |
| app/modules/admin-finance/src/screens/EmployeeEditorScreen.tsx | Fixed misleading "Invitation sent." success copy | edited |
| app/modules/admin-finance/src/screens/EmployeeRosterScreen.tsx | Added `onViewInvitations` prop + "Pending Invitations" button | edited |
| app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx | Added `EmployeeInvitationsScreen` import, `'employee-invitations'` SubView entry, routing branch, and `SUBVIEW_LABELS` entry (4 of this file's 8 working-tree hunks; the other 4 belong to unrelated in-flight work and were left unstaged) | edited |
| (commit) e44d069 on branch jobcore-job-detail-action-buttons | 5 files changed, 210 insertions(+), 2 deletions(-) | committed |

⚠️ DEFERRED
| Item | Reason | Disposition | Saved to (path + anchor) |
|---|---|---|---|
| Revoke has no confirmation dialog | By-design decision made earlier in this lineage, not a defect, but flagged here since it's a one-tap destructive action | Backlog | tracked only in this report; no separate file |
| Real email-sending Edge Function for invitations (send actual email on invite) | Explicitly out of scope; user declined to approve this session | Backlog | tracked only in this report; no separate file |
| TimeOffStatus 'cancelled' widening (ports.ts / time-off-repo.ts) | Unrelated in-flight work discovered during Rule 42 triage, correctly left unstaged/uncommitted | Backlog | app/modules/field-tech/src/data/ports.ts, app/modules/admin-finance/src/data/time-off-repo.ts (uncommitted) |
| Slice D / Job Estimates Wave 2 (price-sheet-repo.ts, 0032/0036/0037 migrations, AdminFinanceRoot.tsx price-sheet hunks, two assertion-file fixture edits) | Separate, substantially-complete feature discovered during Rule 42 triage; not part of this change's scope | Backlog | app/modules/admin-finance/src/data/price-sheet-repo.ts, app/supabase/0032_price_sheet_task_pricing.sql, app/supabase/0036_job_estimates.sql, app/supabase/0037_estimate_tokens.sql (uncommitted) |
| `issue_estimate_token` RPC has no CREATE FUNCTION body in app/supabase/*.sql despite being called live in code | Gap discovered incidentally while triaging Slice D files; belongs to that lineage, not this one | Backlog | app/supabase/0037_estimate_tokens.sql |
| AdminFinanceRoot.tsx parseCalendarDate guard / handleArchived removal / job-address fallback tweak | Unrelated in-flight hunks in the same file, correctly left unstaged during hunk-isolation commit | Backlog | app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx (uncommitted) |

🧪 VERIFY
- [x] Live app: sign-in screen shows a working "Sign up" link that navigates to the sign-up route — verified manually in a prior session.
- [x] Live app: admin can navigate to the new Employee Invitations screen and see pending invitations for their org — verified manually in a prior session.
- [x] Live app: tapping "Revoke" removes the row from the list and the invitation is actually revoked server-side (re-checked against `public.invitations.consumed_at`/deletion, not just local state) — verified manually in a prior session.
- [x] `git show e44d069 --stat` shows exactly 5 files changed, 210 insertions(+), 2 deletions(-), with EmployeeInvitationsScreen.tsx as a new file — confirmed via `git diff --cached --stat` before commit.
- [ ] Automated test coverage for EmployeeInvitationsScreen.tsx / the sign-up link — none exists; not run, since this module has no automated test suite.

## Deviations / Defects
- AdminFinanceRoot.tsx required git-plumbing hunk isolation instead of a normal file-level stage, because the working tree mixed this change's 4 hunks with 4 hunks from unrelated in-flight work in the same file. Resolved via `git apply --cached` against a hand-built inclusion-only patch; verified correct via `git diff --cached`/`git diff` before commit. No plan deviation — the plan did not anticipate this file's working-tree state, but the resulting commit content matches the plan's intent exactly.
- The auto-mode permission classifier blocked plain `git add` on AdminFinanceRoot.tsx twice during this process; resolved by retrying with a session-scoped Bash permission rule for `git add`/`git apply`, per explicit user direction ("start with option 1 and retry"). The user separately asked whether that permission rule could be made permanent; per this session's Prohibited "Modifying system or security settings" category, that was declined and the user was directed to make the change themselves (either via their interactive terminal's permissions dialog, or by hand-authoring `.claude/settings.local.json`) — no such file was written by this session.
- Ambiguous blank-email "tech" row encountered during earlier live verification of the invitations list was investigated and its disposition finalized in a prior session window; no residual open question.
- No rule breaches found in this change's own output.

📊 SUMMARY
Files touched: 5 (committed) + 1 report file | ~Lines +210 / -2 | Deferred: 6 | ASSESS: PASS / CORRECT / CLEAN
---BUILD REPORT---
</content>
