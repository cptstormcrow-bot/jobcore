---
classification: sdassemblypros/jobcore
comments: "Offline audit (v0.13.30 + offline pass, next build vc28)"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/offline-audit.md
tags: [sdassemblypros, jobcore]
---
# Offline audit (v0.13.30 + offline pass, next build vc28)

How each screen behaves in airplane mode. Screen numbers come from the v0.13.30 UI Inventory.

- **Works offline**: the action is saved on the phone and sent automatically when the internet returns. Failures show on #0098 Sync issues.
- **Saved data**: the screen shows what was last loaded while online, or a blank screen if nothing was ever loaded.
- **Needs internet**: the action shows a "needs internet" message. The reason is given.

This is a code audit. Items marked untested go on the next APK's uber test plan.

## Sign-in and app shell

| Screen | Offline | Notes |
|---|---|---|
| #0003 Sign In, #0004 Sign Up, #0079 Forgot Password, #0080 Reset Password | Needs internet | Signing in has to reach the server. An already signed-in phone stays signed in offline. |
| #0001 Root Layout, #0007 Tabs, #0091 Module Shell Layout, #0002 index | Saved data | Opens from the saved session. |
| #0068 Account, #0072 Profile | Saved data | Changing email or role needs internet (the server checks it). |
| #0096 Sign out | Works offline | Pending changes stay queued for the next sign-in. |
| #0098 Sync issues, #0100 Sync history, #0099 Stuck changes | Works offline | These are the offline queue's own screens. |
| #0005 Module Host (marketing modules) | Needs internet | Social posting is online by nature. |

## Jobs (#0009 Jobs, #0012 Jobs, #0025 Jobs, #0027 Job Detail)

| Screen | Offline | Notes |
|---|---|---|
| #0009 / #0012 / #0025 Jobs lists | Saved data | |
| #0027 Job Detail and job tabs | Saved data | Fixed in 5081943 and ea1bcba (no more "Job unavailable"). |
| #0075 Contact, #0058 Schedule, #0041 Plan, #0076 Arrive | Works offline | |
| #0040 Assign (tech and prem tech) | Works offline | Fixed in 7603929. |
| #0061 Prelim (Prem) | Works offline | An unsaved prem opens as a blank form (5081943). |
| #0094 Photos | Works offline | Photos upload when online. |
| #0077 Complete, #0024 Completion | Works offline | |
| #0078 Paid | Works offline | |
| #0095 Needs Prem / Clear Prem | Works offline | |
| #0092 Archived Jobs, archive and unarchive | Works offline | New in this pass. |
| #0066 Test Jobs | Needs internet | Creates and clears test data on the server. |

## Estimates and price sheets

| Screen | Offline | Notes |
|---|---|---|
| #0057 Job Estimate | Works offline | An unsaved estimate opens blank (4e0b0c4). Line edits queue. |
| Estimate fine print (#0065 Settings) | Works offline | New in this pass. Filled in the background while online, for owners and admins. |
| Estimate links (send to customer) | Needs internet | The link is made by the server. |
| Save a line to the price sheet | Needs internet | Changes the shared price sheet. |
| #0019 Price Sheets, #0020 Price Sheet Editor | Saved data | Rates read offline, and the active sheet's rates are filled in the background while online for every role. Publishing needs internet. |
| #0053 New Price Sheet | Needs internet | Publishing is server-checked. |

## Leads and planning

| Screen | Offline | Notes |
|---|---|---|
| #0014 Leads, #0052 New Lead, #0062 Edit Lead, #0015 Qualify Lead | Works offline | |
| #0055 Planning, #0016 Assignments, #0071 Add Task | Works offline | |
| #0011 / #0090 Calendar, #0083 Time Off Tech Calendar | Saved data | |
| #0056 Add Blackout, #0081 Blackout Range, #0082 Blackouts and Time Off | Works offline | |

## Employees

| Screen | Offline | Notes |
|---|---|---|
| #0045 Employees, #0042 Employee Detail, #0044 Employee Job Detail | Saved data | |
| #0043 Add/Edit Employee | Needs internet for SSN and private details | SSN is never stored on the phone. |
| #0060 Pending Invitations | Needs internet | The duplicate-invite check runs on the server. |

## Money (Admin & Finance)

| Screen | Offline | Notes |
|---|---|---|
| #0010 Admin & Finance, #0013 Overview, #0023 Reports, #0064 Reports Job Detail | Saved data | |
| #0017 Close-Outs, #0018 Close-Out Review | Saved data | Close-out, reopen and reset of time segments need internet (pay totals). |
| #0063 / #0046 Payments | Saved data | Payouts, pay and commission need internet. |
| #0021 Reimbursements | Saved data | Approve, reject and paid need internet. Receipt pictures need internet (signed link). |
| #0022 Payout Batches, #0050 Payout Batch Detail | Needs internet | Money moves are server-checked. |
| #0093 Compensation Policy | Needs internet | Pay settings. |
| #0032 Payment Review | Saved data | |

## Payroll

| Screen | Offline | Notes |
|---|---|---|
| #0088 Payroll (admin), #0087 Payroll Run | Saved data | Timesheets and clock hours read offline (new in this pass), filled in the background while online for this pay week and last. Approve, reject, delete, close and export need internet. |
| #0086 Payroll Settings | Needs internet | Rates, settings and QuickBooks. |
| #0084 Payroll (field tech), #0085 Payroll (sales) | Works offline | Clock in and out queue. Own hours for this pay week and last are filled in the background while online. |

## Field tech and sales

| Screen | Offline | Notes |
|---|---|---|
| #0006 Field Tech, #0054 Overview, #0069 Prems, #0067 Reviews | Saved data | Assigned open jobs (up to 30) are filled in the background while online: job, notes, photos, checklists, estimate, investigation and plan. |
| #0038 Sales & Marketing, #0074 Overview, #0049 Callback tasks, #0036 Reporting, #0037 Review Library, #0035 Pitch Picker | Saved data | |
| #0034 Compose Post | Needs internet | Social posting. |

## Not shown in the app

#0026 Earnings, #0028 Greeting, #0030 Start Checklist, #0029 Reimbursements (field tech), #0070 and #0048 (shared parts), #0073 Not Found. They have no separate offline behavior.

## Uber test plan items (vc28)

1. Open Job #N in airplane mode. Job Detail #0027 shows saved data.
2. Make a new prem #0061 and a new estimate #0057 offline. Each opens as a blank form.
3. Edit estimate lines and read price-sheet rates offline.
4. Assign a tech and a prem tech #0040 offline.
5. Open each "Saved data" screen offline after a fresh install. It is blank, with no error.
6. Archive and unarchive a job offline (#0092).
7. Change estimate fine print offline (#0065).
8. Open Payroll #0088 timesheets and clock hours offline.
9. Turn the internet back on. Every queued change syncs and #0098 Sync issues is empty.
10. Edit Job #N offline twice, go online. Both changes land in order (sequence-gotchas.md row 1).
11. Make a change offline as one user, sign out on #0068 Account (the prompt names the waiting count), sign in as another. The change does not send until the first user signs in again.
12. Change Job #N's stage offline, go online, finish it on #0018 Complete Job. It stays finished.
13. Edit a time entry on #0084 Payroll and submit the week offline, go online. Both sync, the submit last.
14. On a very weak signal (or Wi-Fi with no internet behind it), save a change to Job #N. Within about 30 seconds the screen moves on, and the change syncs once a good signal is back, with no app restart.
15. Toggle airplane mode on and off a few times while changes are syncing. Nothing ends up in #0098 Sync issues; every change syncs once the signal holds.
16. On #0094 Photos for Job #N, delete a photo and turn on airplane mode right as you tap. Go online. The photo stays gone and nothing shows in #0098 Sync issues.
17. On #0040 Assign for Job #N, assign a tech on a very weak signal and turn on airplane mode as the save goes out. Go online. The tech stays assigned and nothing shows in #0098 Sync issues.
18. On a fresh install, sign in as an admin online and wait a minute without opening #0065, #0088 or #0087. Turn on airplane mode. Fine print on #0065 and this week's timesheets and clock hours on #0088 and #0087 show.
19. On a fresh install, sign in as a tech online and wait a minute without opening any job. Turn on airplane mode. #0054 Overview lists the assigned jobs, and Job #N opens on #0027 Job Detail with its notes, photos and checklists.
20. On a fresh install, sign in online and wait a minute without opening #0057. Turn on airplane mode, open #0057 Job Estimate for Job #N. The price sheet rates show.
21. On a fresh install, sign in as a tech online and wait a minute without opening #0084. Turn on airplane mode. This week's hours show on #0084 Payroll.
22. In airplane mode, open Job #N from #0054 Overview when only the list was saved (the job itself was never opened). #0027 Job Detail opens at once with the list's data, with no wait.
23. In airplane mode, open a new prem #0061 and a new estimate #0057 for Job #N. Each blank form shows at once, with no wait.
24. In airplane mode, move between screens never opened online (for example #0023 Reports for a new date range). Each shows blank at once, with no wait.
25. Close the app fully, turn on airplane mode, open the app and go straight to a screen never opened online. It shows blank within about a second, with no long wait.
26. In airplane mode, open #0027 Job Detail for a Job #N that has photos. The rest of the job shows at once; the photos show no image instead of hanging.
27. On #0041 for Job #N on a narrow phone, the Prem tech dropdown is one short line, with the tech name on one line.
28. On #0041 Job Timeline for Job #N, assign a Prem tech. The single Prem dot turns yellow. Submit the prem report and it turns green.
29. On #0041 Job Timeline for a Job #N with no prem needed and no Prem tech, the Prem dot stays gray and Next Steps skips it.
30. On #0041 Job Timeline for Job #N, there are no Lead, Photos or History dots, and the work dot reads "Complete". Tapping Prem opens the prem section; tapping Complete opens the completion screen.
