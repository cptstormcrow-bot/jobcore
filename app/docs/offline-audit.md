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
58. Open Job Overview for Job #9 and the Prem Checklist #0061, first as an admin and then signed in as a tech: the Search price sheet box shows for both, each match shows its price, and every task row (rolled up too) shows its dollar price next to the Qty. Add a price-sheet task and confirm its price appears on the row.
59. Open Job Overview for Job #9: + Prem photos starts closed. Tap it open: each photo shows only its file name (no folder path). Tap a file name and the photo opens full screen; tap anywhere to close.
60. Open Job Overview for Job #9 (screen #0081) and add a price-sheet task: the row shows its firm price (sheet rate x Qty) right away. Change the Qty to 3 and confirm the price becomes rate x 3; close and reopen the job and the same price is still there. The roll up/down arrow on each task row is now as large as the + on the Prem photos header.
61. Open Job Overview for Job #9 (screen #0081) as an admin, roll a task down: a Fixed price / Hourly dropdown shows with the number box under it (price, or hourly rate), and the same amount shows as info above it and beside the title. Switch to Hourly, enter a rate, leave the box: the title price becomes rate x time. Then sign in as a tech on the same job: the pricing line shows the price info only (no "locked" message, no dropdown or number boxes), so the tech can see it but cannot change it.
62. Open any screen with labelled fields, for example Job Overview for Job #9 (screen #0081), the Prem Checklist #0061, and an Estimate #0057: every field label ("Customer name:", "Project title:", a date, a dropdown) sits on the same line as its box, with the box filling the rest of the row. Type a bad date in a date field and confirm the red error message drops to its own line under the row.
63. Job #N, Job Overview #0081, a rolled-down task: pick Fixed price and only the "Fixed price $" field shows; pick Hourly and only "Hourly rate $" shows. The Unit, Area / room and Materials fields are gone, and "Quantity" and "SKU" fields sit on one line each. Change Quantity and SKU, leave the field, reopen the job: both stuck, and a price-sheet task's price follows the quantity.
64. Job #N, Job Overview #0081, as a tech: type a SKU that is on the price sheet (#0019) into "Scan box SKU" and tap Find SKU: that price-sheet task is added with its firm price. Type a SKU that is not on the sheet: a "Piece name" and "Price $" appear; fill both and tap Add (pending HQ). The new task shows "Pending HQ approval · SKU ..." and the tech cannot change its price.
65. Job #N, Job Overview #0081, as an admin/owner (migration 0125 live): on the pending task from item 64, tap Approve price (optionally change the Fixed price box first). The "Pending" line goes away, the task is firm, and the piece now appears on the price sheet (#0019) with that SKU. Sign in as a tech and scan the same SKU: it now adds straight from the price sheet with no pending state.
66. Camera scan of a box barcode (Job Overview #0081): needs the rebuilt APK (vc31). Open any job (Job #N) as tech or admin, tap Scan next to the SKU field, allow camera, point at a box barcode. Expect the SKU to fill and the price-sheet task to add (known SKU) or the "SKU not on the price sheet" form (unknown). Typing the SKU and tapping Find SKU still works.
67. Job #N, Estimate #0057 Tasks tab, as an admin/owner: open the Estimate for any job (same job as Job Overview #0081). The Tasks tab shows the same editable task list as #0081: roll a task down, change its Fixed price or Hourly rate, Quantity or SKU, add a task from the price sheet, and remove one. The estimate lines follow the edited tasks on their own (no button). Sign in as a tech: the Tasks tab on #0057 stays read-only (title and Qty only).
68. Needs migration 0126 pushed. Job #N, Complete Job screen (Completion #NNNN, use the screen number on the Screen list), as a tech on a job whose Estimate #0057 is Approved: tick Moved upstairs and tap Complete. The job completes, the upstairs fee is added to the approved estimate's add-ons, and Sync issues shows no "job_estimates: only an admin may change an approved estimate" row. Then, as a tech, try to change anything else on that approved estimate (price, lines, notes): it is still rejected and parked on Sync issues; the queue behind it keeps syncing. Repeat the fee as an admin/owner: it is added as before.
69. Job #N, Prem Checklist #0061 Tasks and Estimate #0057 Tasks tab, and Job Overview #0081, as an admin/owner and as a tech: every task row now shows a Delete button on its title line, even rolled up. Tap Delete: it turns into Confirm; tap Confirm and the task is gone (and stays gone after you leave and come back). Tapping any other row, or Delete on a different row, leaves the first one un-deleted after you tap it again. On #0057 tap Build from tasks afterward: the estimate lines no longer include the deleted task. A tech on #0057 still sees the read-only list with no Delete.

70. Job #N, Prem Checklist #0061 or Estimate #0057 Tasks tab, as an admin/owner: search the price sheet, pick an item and add it (also try scanning or typing a known SKU). The new task row immediately shows the item name on its title line, never a blank/untitled row, and still shows the same name after you leave and come back.

71. Job #N, Job screen (Job #0081 / Prem #0061 / Estimate #0057 / Assign / Schedule / Payment / Close-out): tap through the slide menu one screen at a time. On each, the menu highlights that item AND the matching dot on the timeline bar is about 20% larger (same colour, nothing else moves). Tap Contact, Start and Complete: the dot for that stage grows and the dot for the previous screen shrinks back. On Photos the menu highlights Photos and no dot is enlarged. At no time are two dots enlarged, and the enlarged dot always matches the highlighted menu item.

72. Job #9, Job screen (Job #0081 / Prem #0061 / Estimate #0057): move through the slide menu. The timeline dot for the screen in view now looks clearly bigger (about 40% larger than the others, not 20%), same colour; no other dot, line or label moves and the big dot is not cut off at the top or bottom. Replaces the size expectation in item 71.

73. Calendar (#0011): tap any day. The selected day shows white numbers on the dark cell, even if that day has time off or jobs. A day shown as picked (sand background) keeps dark numbers.
74. Calendar (#0011), admin login: tap a day that has time off or jobs. Every piece of text in the selected day is white on the dark cell, including time-off labels, job addresses and "+N more". A picked (sand) day keeps dark text.
75. Calendar (#0011), admin login (Job #9 for the job check): tap any day. A sheet opens like the day list on #0025, titled with the day, showing that day's jobs and blackouts (or "Nothing scheduled."). Buttons: Add Job, Add Blackout, Open day view, Close. Add Job opens a new job with that date filled in as the preferred date. Add Blackout starts day picking with that day already ticked. A job row has Job details (opens the job); a blackout row has Blackout details. Week view works the same. The Add Blackout editor (#0056) day tap and the calendar on the Time Off tab behave as before.

76. Calendar (#0011), admin login (Job #9 for the job check): tap any day. The sheet title now reads "Scheduled: Thursday Nov 5" style (weekday, short month, day). Under the jobs is a "Start time (optional)" row of half-hour chips from 6:00 AM to 8:00 PM; tap one to select it (tap again to clear) and the label shows "Start time: 9:00 AM". Tap Add Job: the new job (#0057 form) opens with that date and that time already filled in as the preferred date and time. With no time chosen only the date is filled in. Changing to another day clears the chosen time.
Confirm button (added to 76): once a start time is chosen, a Confirm button appears next to Add Job. Tapping Confirm opens the new job with the day and that time filled in, same as Add Job.
77. Calendar (#0011), admin login (Job #9 for the job check): tap a day. If any job has an accepted (approved) estimate, a tech assigned and no scheduled time yet, a "Ready to schedule (tap one, pick a time, Confirm)" list appears on the sheet. Tap a job (it highlights), pick a start time chip, then tap Confirm: the job is scheduled on that day at that time (one hour long) and the sheet closes. The job now shows on that day with its time. A job without an accepted estimate or without an assigned tech is not listed (assign first, then schedule). With no job picked, Confirm still opens the new job form as in 76. The tech calendar has no list and no Confirm.
78. Best of both calendars (#0058 Job Schedule and #0011 Calendar), admin login (Job #9): in #0058 there is now an "Add to schedule" button next to Save, with a "Technician: name" line. Pick a date and time, tap it: the job is scheduled for whichever tech is assigned (with no tech it says to assign one first; with no time picked it says to pick one). If the job already has a slot you get the same Yes/No reschedule question as Save. In #0011, tap a day: tap a job's text for its details popup, tap a blackout row for its reason; a job already on the day has "Move to {time}" and "Remove from schedule" (each with a Yes/No question); a Minute row (:00 :15 :30 :45) sits under the time chips; the new Hide Blackouts / Show Blackouts button hides time-off on the grids. Moves keep the job's length and log a reschedule note. Tech calendar has none of the Move/Remove buttons.
79. Calendar #0011, admin login: the hour-of-day picker (time chips plus the :00 :15 :30 :45 minute row) now sits in the top row to the right of the Add Job / Add Blackout buttons and above the date label. Pick the hour there, then tap a day: the day sheet uses that hour for Confirm, Move to {time} and Add Job (it says 'Pick an hour at the top of the calendar' until you do). The month grid now stretches to the full window height and shows each day's entries inline (up to 4, then '+N more'). Use #0011 for scheduling a prem, an arrival or a completion.

80. Job Schedule #0058 now uses the same layout as #0011 (uber 79): the hour picker sits in the top row to the right of Save / Add to schedule / Clear / Cancel and above the date, and the month grid stretches to the window and shows every schedulable job and blackout as entries (Prev / Next buttons change the month). Tapping a day sets the draft date (keeping the time, default 9:00 AM), an hour chip sets the draft time, and an entry opens its details popup. This is the one place to schedule a prem, an arrival or a completion.

81. Pending Invitations #0060 now has an Accept button on every invitee row (uber 81). Accept asks "Hand this device to <email>?"; Yes signs the admin out and opens Sign Up #0004 with that email filled in, so the new employee only sets a password and the invitation is consumed by the normal first-login signup. No hides the question.
82. Close Out on #0018 no longer stays live for an archived job, and the Jobs list hides Archive on a job still awaiting close-out (uber 82). Job #3 had been archived out of the close-out flow, so #0018 showed no blocker and Close Out was then rejected. #0018 now says the job is archived and to restore it from Archived first; Archive only appears once a job is closed, cancelled or earlier than completed. Test: on the Jobs list a completed or paid job shows no Archive button; open an archived job in #0018 and Close Out is disabled with the archived message.
83. #0041 Tasks now lists the tasks already assigned to the job first (uber 83). The price-sheet search and the SKU scan used to sit above the list; they now come after the assigned and deferred tasks, then the New task title row. Test: open a job with tasks on #0041 (Job #N), go to Tasks; the assigned tasks show at the top and Search price sheet, Scan box SKU and New task title follow below them.
84. #0054 Overview (field tech login) now opens with a My Schedule month calendar showing the tech's assigned jobs (uber 84). Days with jobs list them inside the day cell, the arrows and the center button move between months or jump back to Today, and tapping a day lists that day's jobs below the calendar with time, Job #N, customer and address; tapping a job opens it. Test: sign in as a field tech with an assigned job, open Overview (#0054); the calendar shows the job on its scheduled day, tap that day and the job appears below, tap the job and it opens.
85. #0054 Overview (field tech login) calendar now matches the Jobs tab calendar #0025 (uber 85). It uses the same dots-style month grid instead of the list style, and now shows the tech's approved time-off entries the same way #0025 does. Test: sign in as a field tech who has an assigned job and approved time off; the Overview (#0054) calendar and the Jobs tab (#0025) calendar show the same job dots and time-off days for the month.
86. #0054 Overview (field tech login) no longer has its own calendar (uber 86). It now shows the same Assigned Jobs list as the Jobs tab #0025 (status color and glyph, customer, address, phone, when), tapping a job opens it, and an Open calendar button goes to the one calendar on #0025. Test: sign in as a field tech with an assigned job; Overview (#0054) shows the job in an Assigned Jobs list with no calendar, tap Open calendar and the Jobs tab (#0025) calendar opens.
87. #0057 Job Estimate: Submit did nothing on Job #116 (uber 87). Submit and Approve silently returned when the estimate had no labor line (for example materials only), so it looked dead. It now shows "Add at least one labor line before submitting this estimate.", and the gray hint under the status buttons says "Add a labor line to submit this estimate." when lines exist but none is labor. Test: open Job #116's estimate (#0057), tap Submit with no labor line and see the message; add a labor line and Submit moves it to Submitted.
88. Month calendars on a phone: list cells (#0025 Jobs, #0054 Overview, #0058 Schedule) were too narrow for an address, so below 80 dp per day a cell now shows a short time like "9a" (time off shows "Off") and 3 entries; tablets keep the address and 4 entries (uber 88). Test: on a phone open the month calendar on #0025 and #0054 and see times like "9a" with up to 3 per day; on a tablet or wide window see addresses and up to 4.
89. The "Sign in to see your jobs." dead end on #0025 Assigned Jobs: the host cleared the field-tech, admin-finance and sales-marketing module sessions whenever a /m route instance unmounted, even when a fresh instance had just injected them, so a signed-in user saw the placeholder; the clears now run only after a real sign-out, and the placeholder carries a Sign in button that opens #0003 Sign In. Test: open #0025, go into a job and back a few times, and the list stays; sign out and open #0025 and tap Sign in, which opens #0003.
90. #0054 Overview: the Assigned Jobs list now hides completed, paid, closed, declined, cancelled and archived jobs by default, and a Show completed / Hide completed button on the list brings them back (the list on #0025 is unchanged). Test: open #0054 as a field tech with one open job and several completed jobs and see only the open job; tap Show completed and see all of them; tap Hide completed and see only the open one again.
91. #0054 Overview now carries the #0025 Assigned Jobs calendar, open-job list and Previous Jobs right under its title (the old Assigned Jobs card is gone), the separate Jobs tab is retired (old ?view=jobs links land on Overview), and the Show Test Jobs and Default to Month View options now live in the Overview options menu. Test: sign in as a field tech, open Overview #0054, and confirm the calendar, Assigned Jobs and Previous Jobs show with no Jobs tab; tap a job to open it, and confirm the count tiles below still drill down.

92. Every "Sign in to..." dead-end screen now has a Sign in button (admin Leads, Payments, Reports, Roster, Pending Invitations, Price Sheets, Reimbursement Queue, Payout Batch, New job/lead and more, plus field tech Overview #0054, Reimbursements and Start Checklist). Test: sign out of a phone session without closing the app, open #0054 Overview and an admin screen such as #0014 Leads, and confirm each shows a Sign in button that lands on Overview #0054 when you are still signed in and on Sign In #0003 when you are not.
93. Android Back never closes the app. With no earlier tab, Back on any module tab goes to Overview #0054, and Back on Overview does nothing (field tech, sales and admin). A screen opened cold with nothing underneath (deep link or job) goes to the landing screen. Backgrounding is left to Android: leaving via Home or another app keeps your place. Test: on a phone, open a non-Overview tab from a job screen, press Back and confirm you land on Overview #0054; press Back repeatedly on Overview and confirm the app stays open; switch to another app and back and confirm you return to the same screen.
94. Sign-out clears the previous login's failed saves and sends one last sync report first, so a tech's blocked "Job details" save (e.g. Job #115) no longer shows under the admin login on the same device. The sync monitor #0101 failed items now also list the column names each save tried to write. Test: sign in as a field tech, trigger a blocked save, sign out, sign in as admin, and confirm Sync issues is empty while #0101 still shows the tech's failed item with its columns.

95. Calendar colour tiles (first slice of the unified calendar): month grids on Overview #0054, Calendar #0011 and Job schedule #0058 now show colour-only day squares, red for time off, green with a count badge for jobs assigned to the signed-in tech, blue for the picked day. Techs can now schedule, move and clear jobs assigned to them from #0011 (needs migration 0127, not yet live, so a tech save is blocked until Jeff says go). Test: sign in as a tech with an assigned unscheduled job, open Calendar #0011, tap a day, schedule it, then see it on the admin calendar.
96. Payroll Delete buttons are slimmer: the Delete buttons on Payroll Run #0087 and Payroll #0088 (Timesheet approval, week actions, time entries) are 24pt tall instead of 32pt, with top and bottom padding removed so they no longer look bloated into the neighbouring button. The touch area stays 44pt. Test: open Payroll, look at the Delete button beside Approve/Kick back or under Withdraw, and tap it.
97. "Blackout" is now "Time-off" everywhere you can see it: the Calendar day menu, the Add Time-off screen (#0056), the Upcoming Time-off list, the job Options menu toggle on #0058, the Time-off tech calendar, popups, sync-issue labels and help text. Who can set it is unchanged: a tech for themselves, an admin for anyone. Test: open Calendar #0011, tap a day, look for the Time-off button, then open Admin & Finance and check the Time-off list and Add Time-off screen.

98. Calendar squares are now flat: no rounded buttons, borders or padding, only a thin gray line between days, with the full-box colour fill kept (red time off, green assigned with count badge, blue picked). Today is marked by a bold underlined number; the Today control keeps its plain "Today" label (the blue fill already marks today, and a refresh opens on the current month, Jeff 2026-11-06).

99. The Today control on #0011 Calendar keeps its plain "Today" label (undone from uber 98); the blue fill already marks today and a refresh opens on the current month.

100. On #0011 Calendar, tap an open day: a popup shows the full date, a Time-off button (sets that day red for the signed-in tech) and Close. A time-off day shows its title and notes. A day with jobs shows each job's Job #, name, address and phone (tap to copy) and the job description.

101. The time picker on #0011 Calendar, the day popup and #0058 Job schedule is back to scrolling Hour, Min and AM/PM columns with the picked row highlighted in blue (no wrapped buttons). The month grid is unchanged. Works on phone and tablet widths.

102. #0058 Job schedule now has Save, Add to schedule, Clear, Cancel and Time-off buttons. Time-off books the job's assigned tech out for the picked day (red on every calendar) and refreshes the calendar. It asks for a technician first if the job has none.

103. The job header schedule link (top right of every job screen, opens #0058 Job schedule) now reads like "Friday, November 13 2026 - 9:00AM" when scheduled, and "Unscheduled" when not.

104. The Start time picker (#0011 Calendar, the day popup and #0058 Job schedule) now only offers 7:00 AM through 6:00 PM. Hours run 7 to 12 then 1 to 6; picking an hour sets AM or PM to match, and 6 PM only offers :00.

105. The Start time picker now sits below the calendar (date picker) on #0011 Calendar and #0058 Job schedule, instead of in the button row above it.

106. The gap between the calendar and the Start time picker is closed up and a line now separates them (#0011 Calendar, #0058 Job schedule).

107. The white space between the "Schedule #0058" title and the button row (Save, Add to schedule, Clear, Cancel, Time-off) on #0058 Job schedule is reduced.

108. The Time-off button on #0058 Job schedule now only shows when a technician is assigned to the job. #0011 Calendar (no job) keeps its Time-off button.

109. On #0054 Overview, each job in the green-day popup now has an "Open Job #N" button that closes the popup and opens that job in the app.

110. Time-off has no approval step (first come, first served). The assignment warning on the board (#0051 area) now says "This tech has time off during this window." for any time-off request that is not denied, instead of separate approved and pending wording. New requests were already decided on entry by the database (migration 0019), so no approve or deny screen exists. Test: assign a job to a tech who has time off on that day; the warning reads "has time off".

111. The #0011 Calendar tab now reads every scheduled job straight from the jobs table, in addition to the calendar log. A job that was scheduled without a log entry (for example Job #4, Nov 25, closed out) never reached the grid, so its day square stayed white with no green badge. Test: open Calendar as admin, go to Nov 25; the square is green with a count badge.

112. The #0011 Calendar no longer auto-filters an admin who is also a technician to their own jobs. Admins now open on "All Techs", so Job #4 (Dev Tech, closed out) shows green with a count badge on Nov 25; pick a technician in the picker to narrow it. The My-requests list also counts any time-off that is not cancelled or denied. Test: sign in as admin, open Calendar, go to Nov 25; the square is green with a badge.

113. On the #0011 Calendar, an admin can tap a red time-off day, open the time-off entry, see who requested it ("Requested by") and the dates and reason, and press Clear to cancel it. The red day goes away after the refresh. Test: sign in as admin, open Calendar, tap a red day, tap the time-off entry, press Clear; the day is no longer red.
114. On the #0058 Job Schedule calendar, a cancelled or denied time-off request no longer shows as red days. Test: cancel a time-off request, open a job schedule (#0058); its days are no longer red.
115. On the day sheet that opens when you tap a day (#0011), admins now see a Clear button right beside Time-off details on each time-off entry. Test: sign in as admin, tap a red day, press Clear; the day is no longer red.
116. On the #0011 Calendar (and the #0054 field-tech Overview and #0058 views that share it), jobs that are completed, archived or cancelled no longer paint a day green or add to its count badge. Closed and paid jobs still show. Test: open Calendar on a day that only has a completed or archived job; the square is no longer green.
117. The day popup on the #0011 Calendar now says "Pick an hour below the calendar" (the time picker sits below the calendar, not above it). Test: tap an empty day; the hint reads "below".
118. On the #0011 Calendar day popup, when the day already has a job and you can reschedule, a small scrolling time picker now sits inside the popup; pick a time and tap "Move to ..." then Yes. Test: as admin, tap a green day, pick a time in the popup, tap Move to, then Yes.
119. Closed and paid jobs no longer paint days green on the #0011 Calendar (and every screen that uses it). Test: open Calendar on a day that only has a closed or paid job, such as Job #4; the square is no longer green.
120. Every calendar now looks like #0011: tiles, the month label above the Week/Month/Day tabs, blue for the picked days. This covers #0056 Add Time-off, #0083 Time-off calendar, #0048 range picker (the days you pick turn blue) and #0058 Schedule (its Prev/Next row became the same header, with Week and Day views). Test: open each of those screens and compare to #0011; in #0048 tap two days and see the range turn blue; in #0058 tap Week, Day, then Month and pick a day.
121. The #0011 day popup's buttons now end with Cancel then Time-off, the same order as #0058 (Save, Add to schedule, Clear, Cancel, Time-off); the old Close button is now Cancel. Test: tap a day on Calendar and confirm the bottom row reads Cancel, then Time-off, and Cancel closes the popup.
122. On #0058, trying a different day no longer erases the saved day's green: the saved day stays green while the day being tried shows blue with its badge, until Save moves the job. Test: open Job #115 (saved Nov 23), tap Nov 19, and confirm the 23rd stays green and the 19th turns blue; press Cancel and confirm the 19th clears.
123. The in-app help now spells out the calendar rules: on #0058 Schedule the day being tried is blue and the saved day stays green until Save; what Save, Add to schedule, Clear, Cancel and Time-off each do; green = assigned jobs with a count, red = time-off; no per-day limit (overlaps only warn); no time-off approval. Also added to #0011 Calendar and Reschedule help. Test: open Help on a job's Schedule page and on Calendar and read the new lines.

124. On #0058 Schedule the Clear button is now called Unschedule (same behavior: empties the picked day and time; nothing is stored until Save). Help updated to match. Test: open Job #115 Schedule, tap a day, press Unschedule, and confirm the pick empties and the saved day is untouched until you press Save.
125. On #0058 Schedule the Save and Add to schedule buttons are merged into one Save. Save needs a tech assigned and a day picked; with nothing picked and a job already booked it removes the job (after a confirm). Help updated. Test: open an unassigned job (not Job #115) Schedule page, pick a day, press Save and confirm it asks you to assign a technician; then open Job #115, pick a new day, press Save and confirm the Reschedule question appears.

126. Job #115, Estimate #0057 Tasks tab, as an admin/owner: the Build from tasks button is gone. Open the Estimate for a job that has a priced task such as assembling a bed: the task shows as an estimate line with its price and Quantity without tapping anything, and the total is not $0. Add another task on the Tasks tab: its line appears on its own. Test: open #0057 for Job #115 and confirm the bed task line and total are there with no button press.

127. Estimate #0057: marking the estimate Approved now unlocks the Service Tech picker (it was grayed out until materials arrived). Test: open Job #115 Estimate #0057, mark it Approved, and confirm Service Tech can be picked right away.

128. Day popup (#0011/#0054): the full Address, Phone number and description of work now show (no clipping, tap Address or Phone to copy), and the Info and Job details buttons sit in their own row under the text, no longer squeezed side by side. Test: tap a green day with a job that has a long address, confirm the whole Address, Phone and description show, tap the Address to copy it, and confirm Info and Job details have space between them.
129. Job screen header (#0013 job screen) and day popup (#0011/#0054): saving Job details (phone, name, email, address, description) now updates the cached job and customer straight away, so the job header shows the new phone instead of the old one after Save; the day popup lists Address, Phone and Work as labelled rows under a bold customer name. Test: open Job #115, Edit, change the phone number, Save, confirm the header shows the new number at once and still does after leaving and reopening the job; then tap a green day and confirm the popup shows labelled Address, Phone and Work rows.
130. **Calendar day popup (#0011/#0054) shows the real address, the customer phone and the description.** The calendar loaded only `jobs` rows, so no phone ever reached the popup, and the grid label "Tech: address" leaked into the Address row. `calendar.tsx` now also reads the org customers (cached) and adds name, phone and a fallback address to each job; `UniversalCalendar` hands the popup the unlabelled job. Test: tap a day with a scheduled job; the popup shows the street address, a Phone row and the Work description, with no tech name in front of the address.

131. **Calendar day popup (#0011, #0054) always shows a Phone row on its own line.** The Phone row used to be hidden when the job had no customer phone, so a missing number looked like a missing feature. It now always renders, reading "No phone" when the customer has none. Test: open the Calendar (#0011), tap a day with a job, and confirm Address, Phone and Work each sit on their own line, with Phone showing the customer's number or "No phone".

132. **Calendar day popup (#0011) now finds the customer's real phone.** The admin Calendar (#0011) gets its jobs from a read that carries no phone, so the popup said "No phone" even when the customer had one saved. When a day popup opens, the calendar now looks up each job's customer (the same lookup the Job Schedule screen uses) and fills in phone, name and address. Test: save a phone on a job's customer, open the Calendar (#0011), tap that job's day, and confirm the Phone row shows the number and it can be copied.

133. **Phone numbers show with dashes, the day popup drops Info, and every in-app call is confirmed.** Phones now display as 555-123-4567 (a helper in the shared UI package; the raw digits are still what gets copied-from-saved and dialed). The calendar day popup (#0011, #0054) no longer has an Info button, and Job details sits on the right. Every call started inside the app (Contact on the Job screen for Job #3, the field tech job detail #0027, and the Qualify Lead screen #0015) first asks "Call 555-123-4567?" and only opens the dialer on Call; Contact is only stamped as contacted after the call is confirmed. Test: open the Calendar (#0011), tap a day with a job, confirm Phone shows with dashes and only a Job details button sits on the right; then open a job, tap Contact, and confirm a "Call ...?" question appears and Cancel does not open the dialer.

134. **Field tech Overview hides closed jobs.** The Overview (#0025 Assigned Jobs, field tech login) built every tile list, Assigned, Notes, Photos and both Checklist tiles, from all assigned jobs, so a completed, paid or closed job (for example Job #3) could appear when a tile was opened. Closed-out jobs are now removed before any tile is built, so all of them show only open work. Test: log in as a field tech who has a completed or closed job, open the Overview, tap each tile, and confirm no closed job appears.

135. **Field tech calendar and day popup hide closed jobs.** The calendar embedded in the field tech Overview (#0054 Week and Month views, and the day popup that opens when a day is tapped) listed every assigned job, so a finished job such as the one at 505 Vulcan Ave still showed there. They now use only open jobs; finished jobs remain under Previous Jobs. Test: log in as a field tech, open Assigned Jobs (#0025), tap the day of the closed 505 Vulcan Ave job in Week and Month, and confirm it is not listed; then confirm it still appears under Previous Jobs.
