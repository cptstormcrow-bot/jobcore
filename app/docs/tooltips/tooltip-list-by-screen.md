# Tooltip list by screen

Draft for discussion, 2026-11-02. Nothing is built yet.

About 399 controls across 73 screen groups.

## What the app has now

- **Cut-off text opens in full.** Job rows on #0025 Jobs, the job title bar, list rows, screen titles, #0042 Employee Detail and #0045 Employees. This shows hidden text but does not explain a control.
- **"?" circles in the job menu.** Estimate, Assign, Contact, Start, Complete, Paid and Close-out each have a small "?" that opens a help card.
- **Timeline dots legend.** The "?" beside "Next Steps" on the job screen opens "Timeline dots", which explains each dot color.
- **Screen "?" in the title bar.** Opens the help card for the whole screen.
- **No other field, tab or button has a tooltip.** Every row below marked "No" needs one.

## Questions to settle first

1. **How a tooltip opens.** My pick is a long-press on the control that shows a small card, since phones have no hover. The other choice is a small "?" beside each control, which takes space.
2. **Who writes the text.** I can draft one short line per control for you to edit, or you supply them.
3. **Where to start.** My pick is the Field Tech screens first (#0025, the job screen, #0061, #0024), then Admin, then Sales.

## The list

Controls are pulled from the code, so a few labels show as `{...}` where the label is built at run time. Shared pieces like the calendar, date pickers and list rows are counted once, under the screen that uses them most.

### #0003 Sign In

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Signing in…' : 'Sign in'} | Button | No |
| Create an account | Button | No |
| you@example.com | Field | No |
| •••••••• | Field | No |
| Use ${e} | Tap target | No |
| Forgot password? Reset your password | Tap target | No |

### #0004 Sign Up

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Signing up…' : 'Sign up'} | Button | No |
| you@example.com | Field | No |
| •••••••• | Field | No |

### #0006 Field Tech

| Control | Kind | Tooltip now |
|---|---|---|
| Overview | Menu item | No |
| Jobs | Menu item | No |
| Prems | Menu item | No |
| Reviews | Menu item | No |
| Payroll | Menu item | No |
| Logins | Menu item | No |
| Settings | Menu item | No |
| Profile | Menu item | No |
| Field Tech | Menu item | No |
| Show Test Jobs | Menu item | No |
| Default to Month View | Menu item | No |
| On my way | Menu item | No |
| Start | Menu item | No |
| Accept | Menu item | No |
| Start Time | Menu item | No |
| Stop Time | Menu item | No |
| Complete | Menu item | No |
| Estimate | Menu item | No |
| Investigation | Menu item | No |

### #0009 Jobs

| Control | Kind | Tooltip now |
|---|---|---|
| New job | Button | No |
| Show Test Jobs | Checkbox | No |

### #0010 Admin & Finance / #0011 Calendar / #0012 Jobs / #0013 Overview

| Control | Kind | Tooltip now |
|---|---|---|
| Closed | Button | No |
| Archived | Button | No |
| Add Job | Button | No |
| Archive | Button | No |
| Detail | Button | No |
| Test Employee | Menu item | No |
| Paid Travel | Menu item | No |
| Show Test Employees | Menu item | No |
| Show Test Jobs | Menu item | No |
| Logins | Menu item | No |
| Settings | Menu item | No |
| Profile | Menu item | No |
| Test Jobs | Menu item | No |
| Admin & Finance | Menu item | No |
| ${card.title}, ${card.subtitle} | Tap target | No |

### #0014 Leads

| Control | Kind | Tooltip now |
|---|---|---|
| New Lead | Button | No |

### #0015 Qualify Lead

| Control | Kind | Tooltip now |
|---|---|---|
| {area.name} | Button | No |
| Cancel | Button | No |
| Qualify | Button | No |

### #0016 Assignments

| Control | Kind | Tooltip now |
|---|---|---|
| (no label) | Button | No |
| Service | Button | No |
| Prem | Button | No |
| Confirm | Button | No |
| Assign only to Test Jobs | Checkbox | No |
| (built from a list) | Tabs | No |
| Unassigned | Tab | No |
| Unassigned | Menu item | No |

### #0017 Close-Outs

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0018 Close-Out Review

| Control | Kind | Tooltip now |
|---|---|---|
| Add photo | Button | No |
| Close out job | Button | No |
| (no label) | Field | No |
| (built from a list) | Tabs | No |
| Payouts | Menu item | No |
| Photos | Menu item | No |
| Notes | Menu item | No |
| Trail | Menu item | No |

### #0019 Price Sheets

| Control | Kind | Tooltip now |
|---|---|---|
| Create price sheet | Button | No |

### #0020 Price Sheet Editor

| Control | Kind | Tooltip now |
|---|---|---|
| + Add Task | Button | No |
| {actionState.kind === 'loading' ? 'Saving...' : 'Save Rate'} | Button | No |
| {busy ? 'Publishing...' : 'Publish'} | Button | No |
| (no label) | Button | No |
| Name | Field | No |
| Price ($) | Field | No |
| Est. minutes | Field | No |
| Details | Field | No |
| Materials | Field | No |
| Category | Field | No |
| Amount ($) | Field | No |
| Minutes | Field | No |
| Standard minutes | Field | No |
| Adjustment value | Field | No |
| Active | Checkbox | No |

### #0021 Reimbursements

| Control | Kind | Tooltip now |
|---|---|---|
| Approve | Button | No |
| Confirm Reject | Button | No |
| Reject | Button | No |
| Mark paid | Button | No |
| Reason for rejection | Field | No |

### #0022 Payout Batches

| Control | Kind | Tooltip now |
|---|---|---|
| Approve | Button | No |
| Mark Paid | Button | No |

### #0023 Reports

| Control | Kind | Tooltip now |
|---|---|---|
| View all ${visibleJobs.length} | Button | No |
| Status | Tab | No |
| Slot Hit Rate | Tab | No |
| Commission Totals | Tab | No |

### #0024 Completion

| Control | Kind | Tooltip now |
|---|---|---|
| {submitLabel} | Button | No |
| {reopening ? 'Reopening…' : 'Not Completed'} | Button | No |
| Describe the damage | Field | No |
| List each item added to the scope | Field | No |
| Quality notes | Field | No |
| {label} | Checkbox | No |

### #0025 Jobs

| Control | Kind | Tooltip now |
|---|---|---|
| < | Button | No |
| Go to today | Button | No |
| (no label) | Button | No |
| Close | Button | No |
| Week | Tab | No |
| Month | Tab | No |
| Week | Menu item | No |
| Month | Menu item | No |

### #0026 Earnings

| Control | Kind | Tooltip now |
|---|---|---|
| {submitting ? 'Submitting…' : 'Submit dispute'} | Button | No |
| Describe the dispute | Field | No |

### #0027 Job Detail

| Control | Kind | Tooltip now |
|---|---|---|
| {resolvedPhone ? `Call ${resolvedPhone} | Button | No |
| {job.address ?? 'No address on file'} | Button | No |

### #0028 Greeting

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| {submitting ? 'Submitting…' : 'Submit decline'} | Button | No |
| Accept | Button | No |
| Decline | Button | No |
| Reason for declining | Field | No |

### #0029 Reimbursements

| Control | Kind | Tooltip now |
|---|---|---|
| {submitting ? 'Submitting…' : 'Submit request'} | Button | No |
| e.g. 1250 | Field | No |
| What was this for? | Field | No |
| Linked job id | Field | No |

### #0030 Start Checklist

| Control | Kind | Tooltip now |
|---|---|---|
| On my way | Button | No |
| Start | Button | No |
| Capture before-photo | Button | No |
| {submitting ? 'Submitting…' : 'Submit'} | Button | No |
| {item.label} | Checkbox | No |

### #0032 Payment Review

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0034 Compose Post

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Approving…' : 'Approve draft'} | Button | No |
| {busy ? 'Exporting…' : 'Export & share'} | Button | No |
| {busy ? 'Posting…' : 'Post to Meta'} | Button | No |
| (no label) | Field | No |

### #0035 Pitch Picker

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0036 Reporting

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0037 Review Library

| Control | Kind | Tooltip now |
|---|---|---|
| {curatedIds.has(item.id) ? 'Curated' : 'Curate'} | Button | No |
| Filter by service id | Field | No |
| Filter by community id | Field | No |

### #0038 Sales & Marketing

| Control | Kind | Tooltip now |
|---|---|---|
| Overview | Menu item | No |
| Review Library | Menu item | No |
| Pitch Picker | Menu item | No |
| Composer | Menu item | No |
| Reporting | Menu item | No |
| Callback tasks | Menu item | No |
| Payroll | Menu item | No |
| Sales & Marketing | Menu item | No |
| Sign Out | Menu item | No |
| Settings | Menu item | No |
| Profile | Menu item | No |

### #0040 Assign / #0041 Job / #0075 Contact / #0076 Start / #0077 Complete / #0078 Paid / #0095 Needs Prem / Clear Prem / #0096 Sign out / #0097 Configuration

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Cancel | Button | No |
| {saving ? 'Saving…' : 'Save'} | Button | No |
| (built from a list) | Tabs | No |
| Job | Menu item | No |
| Logins | Menu item | No |
| Settings | Menu item | No |
| Profile | Menu item | No |
| Test Jobs | Menu item | No |
| Prelim (Prem) | Menu item | No |
| Estimate | Menu item | Yes, "?" circle |
| Assign | Menu item | Yes, "?" circle |
| Schedule | Menu item | No |
| Contact | Menu item | Yes, "?" circle |
| Start | Menu item | Yes, "?" circle |
| Photos | Menu item | No |
| Complete | Menu item | Yes, "?" circle |
| Paid | Menu item | Yes, "?" circle |
| Close-out | Menu item | Yes, "?" circle |
| Blackout Dates? | Menu item | No |

### #0042 Employee Detail

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Edit | Button | No |
| Deactivate | Button | No |
| Reactivate | Button | No |
| Copy phone number ${employee.phone} | Tap target | No |

### #0043 Add/Edit Employee

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Saving...' : 'Save'} | Button | No |
| Add Skills | Button | No |
| Cancel | Button | No |
| Add | Button | No |
| Keep editing | Button | No |
| Discard | Button | No |
| Revoke & resend | Button | No |
| (no label) | Button | No |
| Save | Button | No |
| Delete | Button | No |
| Close | Button | No |
| New skill name | Field | No |
| Email | Field | No |
| Full name | Field | No |
| Phone | Field | No |
| Address | Field | No |
| Driver's License # | Field | No |
| SSN (last 4 digits only) | Field | No |
| Emergency Contact Name | Field | No |
| Emergency Contact Phone | Field | No |
| (no label) | Field | No |
| Commission % of labor (0-50) | Field | No |
| Hourly Rate | Field | No |
| Rate effective from (YYYY-MM-DD) | Field | No |
| Commission % of job labor | Field | No |
| Skill name | Field | No |
| Commission | Checkbox | No |
| (built from a list) | Tabs | No |
| Email | Menu item | No |
| Detail | Menu item | No |
| Pay | Menu item | No |
| Role | Menu item | No |
| Service Areas | Menu item | No |
| Skills | Menu item | No |

### #0044 Employee Job Detail

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |

### #0045 Employees

| Control | Kind | Tooltip now |
|---|---|---|
| Add Employee | Button | No |
| Pending Invitations | Button | No |

### #0046 Payments

| Control | Kind | Tooltip now |
|---|---|---|
| Open ${label} | Tap target | No |

### #0048 sweep-modules-field-tech-src-screens-daterangecalendar-tsx

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0049 Callback tasks

| Control | Kind | Tooltip now |
|---|---|---|
| {markingIds.has(item.jobId) ? 'Marking…' : 'Mark Called Back'} | Button | No |
| Show Test Jobs | Checkbox | No |

### #0050 Payout Batch Detail

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |

### #0052 New Lead

| Control | Kind | Tooltip now |
|---|---|---|
| Cancel | Button | No |
| {submitting ? 'Creating...' : 'Create lead'} | Button | No |
| Customer name | Field | No |
| Phone | Field | No |
| Email | Field | No |
| Requested service | Field | No |
| YYYY-MM-DD | Field | No |
| Preferred time | Field | No |
| Address | Field | No |
| Describe the project... | Field | No |

### #0053 New Price Sheet

| Control | Kind | Tooltip now |
|---|---|---|
| Cancel | Button | No |
| {submitting ? 'Creating...' : 'Create price sheet'} | Button | No |
| Version number | Field | No |

### #0054 Overview

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0055 Planning

| Control | Kind | Tooltip now |
|---|---|---|
| Remove | Button | No |
| {onBack ? 'Back to Job' : 'Back to job list'} | Button | No |
| {saving ? 'Saving...' : 'Save'} | Button | No |
| {addingPhoto ? 'Adding...' : 'Add Photo'} | Button | No |
| (no label) | Field | No |
| Model Numbers | Field | No |
| Parts List | Field | No |
| Measurements | Field | No |
| Instructions | Field | No |
| Ingress Notes | Field | No |
| Logistics Notes | Field | No |
| Parking Notes | Field | No |
| State Assessment | Field | No |

### #0056 Add Blackout

| Control | Kind | Tooltip now |
|---|---|---|
| Done | Button | No |

### #0057 Job Estimate

| Control | Kind | Tooltip now |
|---|---|---|
| {onBack ? 'Back to Job' : 'Estimate'} | Button | No |
| {checkingUps ? 'Checking...' : 'Check UPS'} | Button | No |
| Edit | Button | No |
| Delete | Button | No |
| {contingencyForm.index === null ? 'Add contingency' : 'Save'} | Button | No |
| Cancel | Button | No |
| Add another | Button | No |
| Add Task | Button | No |
| {on ? 'On' : 'Off'} | Button | No |
| {busy ? 'Saving...' : 'Save'} | Button | No |
| Save as new line | Button | No |
| Save to sheet | Button | No |
| Remove | Button | No |
| Refresh from task | Button | No |
| Edit Template | Button | No |
| Reset to default | Button | No |
| Save template | Button | No |
| Print / PDF | Button | No |
| {ESTIMATE_LABELS.trackingNumber} | Field | No |
| Description | Field | No |
| Price (optional) | Field | No |
| Quantity | Field | No |
| Unit Cost | Field | No |
| Unit | Field | No |
| Area | Field | No |
| Materials note | Field | No |
| Search price sheet | Field | No |
| Fine print for this estimate | Field | No |
| Organization fine-print template | Field | No |
| Materials Onsite? | Checkbox | No |
| Applies | Checkbox | No |
| (built from a list) | Tabs | No |
| Tasks | Menu item | No |
| Contingencies | Menu item | No |
| Fine Print | Menu item | No |
| Copy estimate link | Tap target | No |

### #0058 Schedule

| Control | Kind | Tooltip now |
|---|---|---|
| Back to Job | Button | No |
| {busy ? 'Saving...' : 'Save'} | Button | No |
| Clear | Button | No |
| Cancel | Button | No |
| Yes | Button | No |
| No | Button | No |

### #0060 Pending Invitations

| Control | Kind | Tooltip now |
|---|---|---|
| {sending ? 'Sending...' : 'Send'} | Button | No |
| Revoke | Button | No |
| Invite by email | Field | No |

### #0061 Prelim (Prem)

| Control | Kind | Tooltip now |
|---|---|---|
| Back to Job | Button | No |
| Add photo | Button | No |
| Save Draft | Button | No |
| Submit | Button | No |
| {checkingUps ? 'Checking...' : 'Check UPS'} | Button | No |
| Delete | Button | No |
| (no label) | Field | No |
| UPS tracking number | Field | No |
| Materials Onsite? | Checkbox | No |

### #0062 Edit Lead

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Save | Button | No |
| Create job | Button | No |
| Full name | Field | No |
| Phone | Field | No |
| Email | Field | No |
| Service | Field | No |
| YYYY-MM-DD | Field | No |
| Preferred time | Field | No |
| Address | Field | No |
| Project details | Field | No |

### #0063 Payments

| Control | Kind | Tooltip now |
|---|---|---|
| (built from a list) | Tabs | No |
| Payments | Menu item | No |
| Reimbursements | Menu item | No |
| Payout Batches | Menu item | No |

### #0064 Reports Job Detail Screen

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |

### #0065 Settings

| Control | Kind | Tooltip now |
|---|---|---|
| Save | Button | No |
| (no label) | Field | No |
| Show screen numbers | Checkbox | No |

### #0066 Test Jobs

| Control | Kind | Tooltip now |
|---|---|---|
| {deletingId === job.id ? 'Deleting…' : 'Delete'} | Button | No |
| {spawning ? 'Spawning…' : 'Spawn Test Jobs'} | Button | No |
| {deletingAll ? 'Deleting all…' : 'Delete All'} | Button | No |
| {simulating ? 'Running…' : 'Run Job Simulator'} | Button | No |
| Dismiss | Button | No |
| {simulating ? 'Running…' : 'Run Again'} | Button | No |
| Show screen numbers | Checkbox | No |
| Logins | Menu item | No |
| Settings | Menu item | No |
| Profile | Menu item | No |
| Test Jobs | Menu item | No |

### #0067 Reviews

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0068 Account

| Control | Kind | Tooltip now |
|---|---|---|
| Sign out | Button | No |
| Switch user | Button | No |
| (no label) | Button | No |

### #0069 Prems

| Control | Kind | Tooltip now |
|---|---|---|
| {premCardAction(item.claimedByMe)} | Button | No |

### #0070 sweep-modules-admin-finance-src-screens-accordioneditrow-tsx

| Control | Kind | Tooltip now |
|---|---|---|
| (no label) | Button | No |
| Cancel | Button | No |
| {pending === 'save' ? busyLabel : 'Save'} | Button | No |

### #0071 Add Task

| Control | Kind | Tooltip now |
|---|---|---|
| Cancel | Button | No |
| {pending ? 'Saving…' : 'Add Task'} | Button | No |
| Name | Field | No |
| Price ($) | Field | No |
| Est. minutes | Field | No |
| Category | Field | No |
| Details | Field | No |
| Materials | Field | No |
| Active | Checkbox | No |

### #0072 Profile

| Control | Kind | Tooltip now |
|---|---|---|
| {detailsBusy ? 'Saving…' : 'Save details'} | Button | No |
| {busy ? 'Updating…' : 'Update password'} | Button | No |
| Name | Field | No |
| Email | Field | No |
| New password | Field | No |
| Confirm password | Field | No |

### #0074 Overview

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0079 Reset Password

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Sending…' : 'Send reset link'} | Button | No |
| Back to sign in | Button | No |
| you@example.com | Field | No |

### #0080 New Password

| Control | Kind | Tooltip now |
|---|---|---|
| {busy ? 'Saving…' : 'Set new password'} | Button | No |
| Request a new link | Button | No |
| •••••••• | Field | No |

### #0081 blackout-range-modal

| Control | Kind | Tooltip now |
|---|---|---|
| Cancel | Button | No |
| {busy ? 'Saving…' : 'Save'} | Button | No |
| Reason (optional) | Field | No |

### #0082 blackout-time-off-list

| Control | Kind | Tooltip now |
|---|---|---|
| {cancelling ? 'Cancelling...' : 'Cancel'} | Button | No |

### #0083 time-off-tech-calendar

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0084 Payroll

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0085 Payroll

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0086 Payroll Settings

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Compensation Policy | Button | No |
| Save settings | Button | No |
| Save accounts | Button | No |
| Week-start day (0 = Sunday ... 6 = Saturday) | Field | No |
| Daily overtime after (minutes) | Field | No |
| Daily double time after (minutes) | Field | No |
| Weekly overtime after (minutes) | Field | No |
| {f.label} | Field | No |
| Seventh consecutive day rule | Checkbox | No |

### #0087 Payroll Run

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Close run | Button | No |
| {f.label} | Button | No |
| Export | Button | No |
| Week start (YYYY-MM-DD) | Field | No |

### #0088 Payroll

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0089 Review

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |

### #0090 universal-calendar

| Control | Kind | Tooltip now |
|---|---|---|
| {pickDays ? 'Cancel' : 'Blackouts'} | Button | No |
| {requesting ? 'Cancel' : 'Request time off'} | Button | No |
| Add Blackout | Button | No |
| Save ${picked.length} day(s) | Button | No |
| Submit request | Button | No |
| Cancel | Button | No |
| Start date (YYYY-MM-DD) | Field | No |
| End date (YYYY-MM-DD) | Field | No |
| Reason (optional) | Field | No |

### #0092 Archived Jobs

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| {busyJobId === row.id ? 'Unarchiving...' : 'Unarchive'} | Button | No |

### #0093 Compensation Policy

| Control | Kind | Tooltip now |
|---|---|---|
| Back | Button | No |
| Save policy | Button | No |
| Hourly rate ($/hr) | Field | No |
| Commission % | Field | No |
| Dev Tech default commission % of labor (0-50) | Field | No |
| Prem Tech bonus: flat ($) | Field | No |
| Prem Tech bonus: % of job total | Field | No |

### #0094 Photos

| Control | Kind | Tooltip now |
|---|---|---|
| — | (list rows or text only) | — |
