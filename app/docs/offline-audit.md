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
31. On #0041 Job Timeline for Job #N, the dots sit in two even rows: Job to Assign (6) on top, Contact to Closeout (5) below, each row spread across the full width.
32. On #0041 job header for Job #N, the gold bar has almost no padding around the text; Job # and date sit flush left, name, address and phone are centered, and Scheduled plus the time lines sit flush right.
33. (Needs migration 0121 live.) On web as owner or admin, the ⋮ menu shows Sync, and it opens #0101 Tech sync monitor. As a tech on web, Sync is not in the menu. On the phone, Sync still opens #0098.
34. On #0101, a tech whose phone has the app open shows a green dot and "Seen just now" within 2 minutes; after the app is closed for over 5 minutes the dot turns gray.
35. On #0101, a phone with a failed change shows the failed count in red; tapping the card lists the change with its Job #N, and Hide removes the card until that phone checks in again.
36. Press and hold a colored badge on a #0012 job card (Prem yellow, Estimate green), any #0041 timeline dot (dimmed ones too), and the status line under the job header on #0041 and #0061: each opens a card naming the badge and its state, tied to its Job #N; a tap anywhere or Android back closes it, and a short tap on a dot still opens its step.
37. On #0078 tap Zelle, PayPal and Venmo: the tab highlights, the fullscreen barcode view opens (the saved image once uploaded, see item 42), Android back closes it, and Show barcode opens it again.
38. On #0019 open the published sheet, change a rate and an area adjustment, and confirm a new estimate uses the new price. Publish still shows only on a draft, and the list order is Drafts, Published, Archived.
39. Sign in as a tech and open #0009: only jobs assigned to that tech list, each row opens the job, Show Test Jobs adds practice jobs, and with none assigned it says so.
40. On #0061 the title reads Prem Checklist. The job detail menu, the Create menu and the Complete Job menu all say Prem, and none says Prelim.
41. On #0061 type in Search price sheet: matching price-sheet items list under the field. Tap one and a bottom sheet shows its name, Rate, Details and Materials with an Add button; Add puts it on the checklist and the search stays in place. Sign in as a tech and confirm the search and rate show there too.
42. As owner open Settings #0065, Company Info, Payment barcodes: Upload a PayPal, Venmo and Zelle QR image; each shows a thumbnail and the button changes to Replace. Replace one and the thumbnail updates. On #0078 tap each service: its tab highlights and its saved barcode shows fullscreen and scans from another phone; a service with none says so. Sign in as a tech and confirm Settings shows Saved/None only and #0078 still shows the barcodes.
43. On Prem Checklist #0061 in edit mode, a task shows a Type dropdown (Assembly, Handyman, Appliance, Contractor). Assembly shows Name or SKU and Flat rate price; Handyman shows Hourly rate and Materials $; Appliance shows Hourly rate and Parts $; Contractor shows name, phone or email, and License #. Handyman and Appliance show Total = rate x expected time + materials or parts. Reopen the job and the values are kept.
44. As owner, on an Assembly task with a price on #0061 tap To price sheet: the button disappears and the item is in the active sheet on #0019 with that price. Sign in as a tech and confirm the button does not show.
45. On #0061, fill in Red flag notes with a long note: the field wraps and grows to show all of it instead of scrolling on one line.
46. On the investigation screen, leave every note blank and add one photo: it submits. With no photo it will not submit and says a photo is needed.
47. Complete job #9 on #0077 (Complete Job) after opening it from Prem Checklist #0061: you land on Estimate #0057, not Prem. Also tap Update on a completed job and Not Completed: each lands on #0057.
48. As owner or admin, open Closed from the Jobs board #0010 (list #0092): each closed job row has an Archive button. Tap it, confirm, and the job leaves the Closed list and appears under Archived. A tech or non-admin sees no Archive button.
49. Open Job Checklist #0024 (from Complete Job #0077): one header line with Job Checklist at left, a small Time Spent in the center, and the Complete Job button at right (Not Completed beside it on a completed job). No separate title or button rows remain, so the checklist starts higher.
50. Open any job's Job Progress timeline (Job #0041): there is no Approval dot any more, only Estimate, in two even rows of five (Job, Prem, Estimate, Schedule, Assign / Contact, Start, Complete, Paid, Closeout). Every label sits on one line on the smallest phone. Estimate stays gray for a draft, yellow once submitted, green once approved, red if rejected; press and hold it for its tooltip and tap it to open the estimate.
51. Open Job Details #0041 on a job that has a Prem checklist (#0061), e.g. Job #9: there is only one Parking field now, Parking availability; the old Parking (Prem) field is gone. If Parking availability was empty and Prem had a parking note, that note now shows in Parking availability. Edit it and Save: the Prem checklist Parking notes shows the same value.
52. Open Job Details #0041 (Job #9) in edit mode: the old Rooms needing work checkboxes are gone, replaced by a Description of work box that wraps and grows as you type. Type a short description, Save, reopen: it shows the same text. A job that had rooms ticked before shows them as a comma list (for example Kitchen, Bathroom). The field tech job detail view uses the same Description of work label.
53. Open Job Details #0041 (Job #9) and look at the timeline: the order is now Job, Prem, Estimate, Assign, Schedule on the top row (five dots, Assign fourth, Schedule fifth) and Contact, Start, Complete, Paid, Closeout on the bottom row. Tap Assign and the Assign screen opens; tap Schedule and the Schedule screen opens. Each dot still shows its own tooltip and color. On a job with a tech assigned and no schedule, Assign is green and Schedule is gray; on a job that is scheduled but has no tech, Assign turns red and Next Steps says Redo Assign.
54. Open Estimate #0057 for Job #9: the title Estimate sits at the left with Copy estimate link at the upper right on the same line (grayed with a note until submitted). Total Estimate: $X shows on one line beside the status control, no longer in a separate column. The Take a photo of the job Before card, the customer and address title bar, and the Service area line are gone from #0057. Service tasks and Build from tasks still show when the job has tasks; copying the link, changing status, tracking and Materials Onsite? still work.
55. Open Estimate #0057 for Job #9: at the top of the Tasks card there is one field, Add from price sheet. Type part of a task name and tap a match: the task is added at once with its rate and quantity 1 (no separate Add Task press). Tap Add manually to reveal Assembly labor, Type, Description, Quantity, Unit Cost, Add Task and Save to price sheet; Hide manual entry collapses them again, and a manually added task still saves. The Select and text fields on #0057 now share one minimum row height, so the boxes line up. Then open Job Overview for Job #9 as an admin and the Prem Checklist #0061: both offer the price-sheet search, and tapping a match opens the item sheet (Rate, Details, Materials, Add).
56. Open Job Overview for Job #9 as an admin (the Tasks section sits right under Job Details), and the Prem Checklist #0061: every task now shows as one line with an arrow and its title. Tap a row and it rolls down to show Qty, Notes, Type, Unit, Area, Materials and the Defer, Remove and Add buttons; tap again and it rolls back up. Edit a value in a rolled-down row, roll it up and down again: the value is kept. A task you just added from the price sheet starts rolled up.
57. Open Job Overview for Job #9 as an admin: directly under the pinned buttons you now see Tasks first (price-sheet search plus the one-line task rows), then Prem photos, then Customer projects, and Job Details last. Check Save and Cancel still work, a Prem photo and Customer projects still expand, and Start project still works.
