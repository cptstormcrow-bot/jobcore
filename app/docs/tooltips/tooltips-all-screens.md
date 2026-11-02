---
classification: sdassemblypros/jobcore
comments: "Tooltips: every screen"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/tooltips/tooltips-all-screens.md
tags: [sdassemblypros, jobcore]
---
# Tooltips: every screen

Draft text for Jeff to edit, 2026-11-02. Nothing is built yet.

**How each tooltip opens:** press and hold the control. A small card shows the line, and a tap anywhere closes it.

**Left out on purpose:**
- Items already drafted in tooltips-0012-0025.md (#0012 Jobs and #0025 Jobs).
- Fields that already do a job when tapped, such as a customer name, address or phone link, or the copy-phone tap on #0042.
- Job menu items that already have a "?" help circle (Estimate, Assign, Contact, Start, Complete, Paid, Close-out).
- Screens with only list rows or text.

Form boxes where you type a name, phone or address are kept, since they don't do anything when tapped.

## #0003 Sign In

| Control | Kind | Draft tooltip |
|---|---|---|
| Sign in | Button | Sign in with the email and password above. |
| Create an account | Button | New here? Make an account with your email. |
| Email | Field | The email you signed up with. |
| Password | Field | Your password. It stays hidden as you type. |
| Use (saved email) | Tap target | Fill in this saved email so you don't have to type it. |
| Forgot password? | Tap target | Get an email with a link to set a new password. |

## #0004 Sign Up

| Control | Kind | Draft tooltip |
|---|---|---|
| Sign up | Button | Make your account with this email and password. |
| Email | Field | The email you'll sign in with. Invites go here too. |
| Password | Field | Pick a password for your new account. |

## #0006 Field Tech

| Control | Kind | Draft tooltip |
|---|---|---|
| Overview | Tab | Your numbers at a glance: jobs, hours and pay. |
| Jobs | Tab | Your assigned jobs and the calendar. |
| Prems | Tab | Walk-throughs waiting for a tech. Claim one to do it. |
| Reviews | Tab | What customers said about your work. |
| Payroll | Tab | Your hours, pay and pay history. |
| Logins | Menu item | Switch to another test login. For testing only. |
| Settings | Menu item | App options such as the default calendar view. |
| Profile | Menu item | Your name, email and password. |
| Field Tech | Menu item | The view you're in now. Pick another view to switch. |
| Show Test Jobs | Menu item | Show or hide the practice jobs used for testing. |
| Default to Month View | Menu item | Open the calendar on the whole month instead of one week. |
| On my way | Menu item | Tell the customer and the office you're driving there. |
| Start | Menu item | Begin the job's start checklist on site. |
| Accept | Menu item | Tell the office you'll take this job. |
| Start Time | Menu item | Clock in on this job. Your hours count from now. |
| Stop Time | Menu item | Clock out on this job. Your hours stop here. |
| Complete | Menu item | Mark the work done and fill in the wrap-up. |
| Estimate | Menu item | See the price and line items the customer approved. |
| Investigation | Menu item | Record what you found on site before the work starts. |

## #0009 Jobs

| Control | Kind | Draft tooltip |
|---|---|---|
| New job | Button | Start a new job for a customer. |
| Show Test Jobs | Checkbox | Show or hide the practice jobs used for testing. |

## #0010 Admin & Finance / #0011 Calendar / #0013 Overview

| Control | Kind | Draft tooltip |
|---|---|---|
| Test Employee | Menu item | Act as a practice employee to try out their view. |
| Paid Travel | Menu item | Set whether drive time to a job is paid. |
| Show Test Employees | Menu item | Show or hide the practice employees used for testing. |
| Show Test Jobs | Menu item | Show or hide the practice jobs used for testing. |
| Logins | Menu item | Switch to another test login. For testing only. |
| Settings | Menu item | App options for this office. |
| Profile | Menu item | Your name, email and password. |
| Test Jobs | Menu item | Make, run or clear practice jobs. |
| Admin & Finance | Menu item | The view you're in now. Pick another view to switch. |
| Overview card | Tap target | Open the list behind this number. |

## #0014 Leads

| Control | Kind | Draft tooltip |
|---|---|---|
| New Lead | Button | Add a customer who asked about work. |

## #0015 Qualify Lead

| Control | Kind | Draft tooltip |
|---|---|---|
| Service area | Button | Pick the area this job is in. It decides which techs can take it. |
| Cancel | Button | Go back without qualifying this lead. |
| Qualify | Button | Mark this as a real job. It moves on to scheduling. |

## #0016 Assignments

| Control | Kind | Draft tooltip |
|---|---|---|
| Tech row | Button | Pick this tech for the job. |
| Service | Button | Assign the tech who does the work. |
| Prem | Button | Assign the tech who does the walk-through. |
| Confirm | Button | Give the job to the tech you picked. They'll be told. |
| Assign only to Test Jobs | Checkbox | Limit picks to practice jobs, so real jobs stay untouched. |
| Status tabs | Tabs | Filter the jobs by where they stand. |
| Unassigned | Tab | Jobs that don't have a tech yet. |
| Unassigned | Menu item | Take the tech off this job. |

## #0018 Close-Out Review

| Control | Kind | Draft tooltip |
|---|---|---|
| Add photo | Button | Add a photo to the job's record. |
| Close out job | Button | File the job as finished. Pay is worked out from here. |
| Note box | Field | A note for the close-out record. |
| Section tabs | Tabs | Switch between payouts, photos, notes and the trail. |
| Payouts | Tab | What each tech earns from this job. |
| Photos | Tab | Before and after photos from the job. |
| Notes | Tab | Notes the techs and office left on the job. |
| Trail | Tab | Every step the job went through, with dates. |

## #0019 Price Sheets

| Control | Kind | Draft tooltip |
|---|---|---|
| Create price sheet | Button | Start a new list of tasks and prices. |

## #0020 Price Sheet Editor

| Control | Kind | Draft tooltip |
|---|---|---|
| + Add Task | Button | Add a task with its price and time to this sheet. |
| Save Rate | Button | Save this rate change. |
| Publish | Button | Make this sheet the one used for new estimates. |
| Task row | Button | Open this task to edit it. |
| Name | Field | What the task is called on the estimate. |
| Price ($) | Field | What the customer pays for this task. |
| Est. minutes | Field | How long the task usually takes. Used for scheduling and pay. |
| Details | Field | What the task includes, shown to the tech. |
| Materials | Field | Parts or supplies the task needs. |
| Category | Field | The group this task is listed under. |
| Amount ($) | Field | The dollar amount for this rate. |
| Minutes | Field | The time this rate covers. |
| Standard minutes | Field | The normal time for this task, before any adjustment. |
| Adjustment value | Field | How much to raise or lower the standard. |
| Active | Checkbox | Turn off to hide the task from new estimates without deleting it. |

## #0021 Reimbursements (Admin)

| Control | Kind | Draft tooltip |
|---|---|---|
| Approve | Button | OK this expense so it gets paid back. |
| Reject | Button | Turn down this expense. You'll be asked why. |
| Confirm Reject | Button | Send the rejection and reason to the tech. |
| Mark paid | Button | Record that the tech has been paid back. |
| Reason for rejection | Field | Tell the tech why this was turned down. |

## #0022 Payout Batches

| Control | Kind | Draft tooltip |
|---|---|---|
| Approve | Button | OK this group of payouts to be paid. |
| Mark Paid | Button | Record that this group of payouts went out. |

## #0023 Reports

| Control | Kind | Draft tooltip |
|---|---|---|
| View all | Button | Show every job in this report, not just the first few. |
| Status | Tab | How many jobs are at each stage. |
| Slot Hit Rate | Tab | How often jobs started in the time window promised. |
| Commission Totals | Tab | Commission earned by each person. |

## #0024 Completion

| Control | Kind | Draft tooltip |
|---|---|---|
| Submit | Button | Send the wrap-up and mark the job done. |
| Not Completed | Button | The work isn't finished. Put the job back in progress. |
| Describe the damage | Field | What was damaged, so the office can follow up. |
| List each item added to the scope | Field | Extra work done beyond the estimate, one item per line. |
| Quality notes | Field | Anything the office should know about how the job went. |
| Wrap-up checks | Checkbox | Tick each one that applies to this job. |

## #0026 Earnings

| Control | Kind | Draft tooltip |
|---|---|---|
| Submit dispute | Button | Send your question about this pay to the office. |
| Describe the dispute | Field | What looks wrong with this pay, and what you expected. |

## #0028 Greeting

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back without declining. |
| Submit decline | Button | Send the reason and turn down the job. |
| Accept | Button | Take this job. The office will be told. |
| Decline | Button | Turn down this job. You'll be asked why. |
| Reason for declining | Field | Tell the office why you can't take it. |

## #0029 Reimbursements (Field Tech)

| Control | Kind | Draft tooltip |
|---|---|---|
| Submit request | Button | Ask to be paid back for this expense. |
| Amount | Field | What you spent, in cents. 1250 means $12.50. |
| What was this for? | Field | What you bought and why. |
| Linked job id | Field | The job this expense was for, if any. |

## #0030 Start Checklist

| Control | Kind | Draft tooltip |
|---|---|---|
| On my way | Button | Tell the customer and the office you're driving there. |
| Start | Button | You're on site. Begin the checklist. |
| Capture before-photo | Button | Take a photo before any work starts. |
| Submit | Button | Finish the checklist and start the work. |
| Checklist item | Checkbox | Tick when this step is done. |

## #0034 Compose Post

| Control | Kind | Draft tooltip |
|---|---|---|
| Approve draft | Button | OK this post so it can be shared. |
| Export & share | Button | Save the post and share it from your phone. |
| Post to Meta | Button | Post straight to the Facebook and Instagram pages. |
| Post text | Field | The words that go with the post. |

## #0037 Review Library

| Control | Kind | Draft tooltip |
|---|---|---|
| Curate | Button | Save this review for use in posts and pitches. |
| Filter by service id | Field | Show only reviews for one kind of service. |
| Filter by community id | Field | Show only reviews from one neighborhood. |

## #0038 Sales & Marketing

| Control | Kind | Draft tooltip |
|---|---|---|
| Overview | Tab | Sales numbers at a glance. |
| Review Library | Tab | Customer reviews you can use in posts. |
| Pitch Picker | Tab | Pick a ready-made pitch for a customer. |
| Composer | Tab | Write a social media post. |
| Reporting | Tab | How posts and leads are doing. |
| Callback tasks | Tab | Customers waiting for a call back. |
| Payroll | Tab | Your hours, pay and pay history. |
| Sales & Marketing | Menu item | The view you're in now. Pick another view to switch. |
| Sign Out | Menu item | Sign out of the app on this phone. |
| Settings | Menu item | App options. |
| Profile | Menu item | Your name, email and password. |

## #0040 Assign / #0041 Job / #0075-#0078 / #0095 / #0096 / #0097

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the job. |
| Cancel | Button | Close without saving. |
| Save | Button | Save your changes. |
| Section tabs | Tabs | Switch between the parts of this job. |
| Job | Tab | The job's details and next steps. |
| Logins | Menu item | Switch to another test login. For testing only. |
| Settings | Menu item | App options. |
| Profile | Menu item | Your name, email and password. |
| Test Jobs | Menu item | Make, run or clear practice jobs. |
| Prelim (Prem) | Menu item | The walk-through: measurements, photos and notes before pricing. |
| Schedule | Menu item | Set the date and time for the job. |
| Photos | Menu item | All photos taken on this job. |
| Blackout Dates? | Menu item | Days no work can be booked, like holidays. |

## #0042 Employee Detail

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the employee list. |
| Edit | Button | Change this person's details, pay or role. |
| Deactivate | Button | Stop this person from signing in. Their records are kept. |
| Reactivate | Button | Let this person sign in again. |

## #0043 Add/Edit Employee

| Control | Kind | Draft tooltip |
|---|---|---|
| Save | Button | Save this employee. |
| Add Skills | Button | Add the kinds of work this person can do. |
| Cancel | Button | Close without saving. |
| Add | Button | Add this skill to the list. |
| Keep editing | Button | Go back to your changes. |
| Discard | Button | Throw away your changes and leave. |
| Revoke & resend | Button | Cancel the old invite and email a new one. |
| Skill row | Button | Open this skill to rename or delete it. |
| Save (skill) | Button | Save the skill's new name. |
| Delete (skill) | Button | Remove this skill from the list. |
| Close | Button | Close this box. |
| New skill name | Field | A kind of work not on the list yet. |
| Email | Field | Where the invite is sent. They sign in with it. |
| Full name | Field | The name shown on jobs and pay. |
| Phone | Field | A number the office can reach them on. |
| Address | Field | Their home address, for records and travel. |
| Driver's License # | Field | Kept on file for driving to jobs. |
| SSN (last 4 digits only) | Field | Only the last 4 digits, to match pay records. |
| Emergency Contact Name | Field | Who to call if something happens on a job. |
| Emergency Contact Phone | Field | That person's phone number. |
| Search box | Field | Find a skill or area by name. |
| Commission % of labor (0-50) | Field | Their share of each job's labor price, from 0 to 50. |
| Hourly Rate | Field | What they earn per hour on the clock. |
| Rate effective from (YYYY-MM-DD) | Field | The first day the new pay applies. |
| Commission % of job labor | Field | Their share of each job's labor price. |
| Skill name | Field | The skill's name as shown on the list. |
| Commission | Checkbox | Pay by commission instead of by the hour. |
| Section tabs | Tabs | Switch between the parts of this employee's record. |
| Email | Tab | Their sign-in email and invite. |
| Detail | Tab | Name, contact and ID details. |
| Pay | Tab | How and how much they're paid. |
| Role | Tab | What they can see and do in the app. |
| Service Areas | Tab | Where they'll take jobs. |
| Skills | Tab | The kinds of work they can do. |

## #0044 Employee Job Detail

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the employee. |

## #0045 Employees

| Control | Kind | Draft tooltip |
|---|---|---|
| Add Employee | Button | Add a new person and email them an invite. |
| Pending Invitations | Button | Invites sent but not yet accepted. |

## #0046 Payments

| Control | Kind | Draft tooltip |
|---|---|---|
| Open (payment) | Tap target | Open this payment's details. |

## #0049 Callback tasks

| Control | Kind | Draft tooltip |
|---|---|---|
| Mark Called Back | Button | Record that you called this customer. It leaves the list. |
| Show Test Jobs | Checkbox | Show or hide the practice jobs used for testing. |

## #0050 Payout Batch Detail

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the payout batches. |

## #0052 New Lead

| Control | Kind | Draft tooltip |
|---|---|---|
| Cancel | Button | Close without saving the lead. |
| Create lead | Button | Save this customer as a new lead. |
| Customer name | Field | Who asked about the work. |
| Phone | Field | Best number to reach them. |
| Email | Field | Their email, for the estimate and updates. |
| Requested service | Field | The kind of work they want. |
| Date | Field | The day they'd like the work done. |
| Preferred time | Field | The time of day that suits them. |
| Address | Field | Where the work is. |
| Describe the project | Field | What they want done, in their words. |

## #0053 New Price Sheet

| Control | Kind | Draft tooltip |
|---|---|---|
| Cancel | Button | Close without making the sheet. |
| Create price sheet | Button | Make the new sheet. You add tasks next. |
| Version number | Field | A number to tell this sheet from older ones. |

## #0055 Planning

| Control | Kind | Draft tooltip |
|---|---|---|
| Remove | Button | Take this photo off the plan. |
| Back to Job | Button | Go back to the job. |
| Save | Button | Save the plan. |
| Add Photo | Button | Add a photo to the plan. |
| Photo caption | Field | A short note on what the photo shows. |
| Model Numbers | Field | Model numbers of the items being installed. |
| Parts List | Field | Parts to bring to the job. |
| Measurements | Field | Sizes taken on site. |
| Instructions | Field | Steps for the tech doing the work. |
| Ingress Notes | Field | How to get in: gate codes, doors, stairs. |
| Logistics Notes | Field | Anything about moving or staging items. |
| Parking Notes | Field | Where the tech can park. |
| State Assessment | Field | The condition of the site before work starts. |

## #0056 Add Blackout

| Control | Kind | Draft tooltip |
|---|---|---|
| Done | Button | Save the blocked-out days and close. |

## #0057 Job Estimate

| Control | Kind | Draft tooltip |
|---|---|---|
| Back to Job | Button | Go back to the job. |
| Check UPS | Button | Look up the package and see if it has arrived. |
| Build from tasks | Button | Fill in the estimate from the tasks picked for this job. |
| Edit | Button | Change this line. |
| Delete | Button | Remove this line from the estimate. |
| Add contingency | Button | Add a possible extra cost if something unexpected turns up. |
| Cancel | Button | Close without saving. |
| Add another | Button | Save this and start another. |
| Add Task | Button | Add a task from the price sheet. |
| On / Off | Button | Turn this on or off for the estimate. |
| Save | Button | Save the estimate. |
| Save as new line | Button | Keep the original and add this as a new line. |
| Save to sheet | Button | Save this price change to the price sheet too. |
| Remove | Button | Take this off the estimate. |
| Refresh from task | Button | Reset this line to the price sheet's current price. |
| Edit Template | Button | Change the fine print used on every estimate. |
| Reset to default | Button | Put the fine print back to the office's standard text. |
| Save template | Button | Save the fine print for every new estimate. |
| Print / PDF | Button | Make a PDF of the estimate to print or send. |
| Tracking number | Field | The UPS tracking number for parts. |
| Description | Field | What this line is for. |
| Price (optional) | Field | Leave blank to use the price sheet price. |
| Quantity | Field | How many. |
| Unit Cost | Field | The price for one. |
| Unit | Field | What one means, like each, foot or hour. |
| Area | Field | The room or part of the house this is for. |
| Materials note | Field | Notes on parts for this job. |
| Search price sheet | Field | Find a task by name. |
| Fine print for this estimate | Field | Terms shown only on this estimate. |
| Organization fine-print template | Field | Terms shown on every estimate. |
| Materials Onsite? | Checkbox | Tick if the parts are already at the job. |
| Applies | Checkbox | Tick if this contingency applies to this job. |
| Section tabs | Tabs | Switch between tasks, contingencies and fine print. |
| Tasks | Tab | The work and its prices. |
| Contingencies | Tab | Possible extra costs. |
| Fine Print | Tab | The terms printed on the estimate. |
| Copy estimate link | Tap target | Copy a link the customer can open to see the estimate. |

## #0058 Schedule

| Control | Kind | Draft tooltip |
|---|---|---|
| Back to Job | Button | Go back to the job. |
| Save | Button | Save the date and time. |
| Clear | Button | Take the date off the job. |
| Cancel | Button | Close without saving. |
| Yes | Button | Go ahead with the change. |
| No | Button | Keep things as they were. |

## #0060 Pending Invitations

| Control | Kind | Draft tooltip |
|---|---|---|
| Send | Button | Email an invite to join the app. |
| Revoke | Button | Cancel this invite. The link stops working. |
| Invite by email | Field | The email of the person to invite. |

## #0061 Prelim (Prem)

| Control | Kind | Draft tooltip |
|---|---|---|
| Back to Job | Button | Go back to the job. |
| Add photo | Button | Add a photo from the walk-through. |
| Save Draft | Button | Save what you have and finish later. |
| Submit | Button | Send the walk-through to the office for pricing. |
| Check UPS | Button | Look up the package and see if it has arrived. |
| Delete | Button | Remove this photo. |
| Note box | Field | Notes from the walk-through. |
| UPS tracking number | Field | The tracking number for parts being shipped. |
| Materials Onsite? | Checkbox | Tick if the parts are already at the job. |

## #0062 Edit Lead

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the leads. |
| Save | Button | Save your changes to this lead. |
| Create job | Button | Turn this lead into a job. |
| Full name | Field | Who asked about the work. |
| Phone | Field | Best number to reach them. |
| Email | Field | Their email, for the estimate and updates. |
| Service | Field | The kind of work they want. |
| Date | Field | The day they'd like the work done. |
| Preferred time | Field | The time of day that suits them. |
| Address | Field | Where the work is. |
| Project details | Field | What they want done. |

## #0063 Payments

| Control | Kind | Draft tooltip |
|---|---|---|
| Section tabs | Tabs | Switch between payments, expenses and payouts. |
| Payments | Tab | Money coming in from customers. |
| Reimbursements | Tab | Expenses techs asked to be paid back for. |
| Payout Batches | Tab | Groups of pay going out to techs. |

## #0064 Reports Job Detail

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the report. |

## #0065 Settings

| Control | Kind | Draft tooltip |
|---|---|---|
| Save | Button | Save these settings. |
| Setting box | Field | Change this setting's value. |
| Show screen numbers | Checkbox | Show each screen's number, to help when reporting a problem. |

## #0066 Test Jobs

| Control | Kind | Draft tooltip |
|---|---|---|
| Delete | Button | Remove this practice job. |
| Spawn Test Jobs | Button | Make a set of practice jobs to try things on. |
| Delete All | Button | Remove every practice job. Real jobs aren't touched. |
| Run Job Simulator | Button | Walk a practice job through every step to check the app. |
| Dismiss | Button | Close the simulator results. |
| Run Again | Button | Run the simulator one more time. |
| Show screen numbers | Checkbox | Show each screen's number, to help when reporting a problem. |
| Logins | Menu item | Switch to another test login. For testing only. |
| Settings | Menu item | App options. |
| Profile | Menu item | Your name, email and password. |
| Test Jobs | Menu item | Make, run or clear practice jobs. |

## #0068 Account

| Control | Kind | Draft tooltip |
|---|---|---|
| Sign out | Button | Sign out of the app on this phone. |
| Switch user | Button | Sign in as someone else on this phone. |
| Account button | Button | Open your account options. |

## #0069 Prems

| Control | Kind | Draft tooltip |
|---|---|---|
| Claim / Open | Button | Claim this walk-through, or open the one you've claimed. |

## #0070 Accordion edit row

| Control | Kind | Draft tooltip |
|---|---|---|
| Row header | Button | Open or close this row to edit it. |
| Cancel | Button | Close without saving. |
| Save | Button | Save this row. |

## #0071 Add Task

| Control | Kind | Draft tooltip |
|---|---|---|
| Cancel | Button | Close without adding the task. |
| Add Task | Button | Add this task to the price sheet. |
| Name | Field | What the task is called on the estimate. |
| Price ($) | Field | What the customer pays for this task. |
| Est. minutes | Field | How long the task usually takes. |
| Category | Field | The group this task is listed under. |
| Details | Field | What the task includes, shown to the tech. |
| Materials | Field | Parts or supplies the task needs. |
| Active | Checkbox | Turn off to hide the task from new estimates. |

## #0072 Profile

| Control | Kind | Draft tooltip |
|---|---|---|
| Save details | Button | Save your name and email. |
| Update password | Button | Change your password to the new one. |
| Name | Field | Your name as others see it. |
| Email | Field | The email you sign in with. |
| New password | Field | The password you want to use from now on. |
| Confirm password | Field | Type the new password again to be sure. |

## #0079 Reset Password

| Control | Kind | Draft tooltip |
|---|---|---|
| Send reset link | Button | Email a link to set a new password. |
| Back to sign in | Button | Go back to the sign-in screen. |
| Email | Field | The email you signed up with. |

## #0080 New Password

| Control | Kind | Draft tooltip |
|---|---|---|
| Set new password | Button | Save your new password and sign in. |
| Request a new link | Button | The link ran out. Get a fresh one by email. |
| Password | Field | The password you want to use from now on. |

## #0081 Blackout range

| Control | Kind | Draft tooltip |
|---|---|---|
| Cancel | Button | Close without blocking these days. |
| Save | Button | Block these days so no work is booked. |
| Reason (optional) | Field | Why these days are blocked, like a holiday. |

## #0082 Blackout and time-off list

| Control | Kind | Draft tooltip |
|---|---|---|
| Cancel | Button | Take back this time off. Those days open up again. |

## #0086 Payroll Settings

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to payroll. |
| Compensation Policy | Button | Set default pay rates and bonuses. |
| Save settings | Button | Save the overtime rules. |
| Save accounts | Button | Save the payroll account numbers. |
| Week-start day | Field | The day the pay week begins. 0 is Sunday, 6 is Saturday. |
| Daily overtime after (minutes) | Field | Time worked in a day before overtime pay starts. |
| Daily double time after (minutes) | Field | Time worked in a day before double pay starts. |
| Weekly overtime after (minutes) | Field | Time worked in a week before overtime pay starts. |
| Account field | Field | The account this kind of pay is booked to. |
| Seventh consecutive day rule | Checkbox | Pay overtime for a seventh work day in a row. |

## #0087 Payroll Run

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to payroll. |
| Close run | Button | Lock this pay week. No more changes after this. |
| Export format | Button | Pick the file type for your payroll service. |
| Export | Button | Save the pay week as a file to send for payroll. |
| Week start (YYYY-MM-DD) | Field | The first day of the pay week to run. |

## #0090 Calendar

| Control | Kind | Draft tooltip |
|---|---|---|
| Blackouts | Button | Pick days to block so no work is booked. |
| Request time off | Button | Ask the office for days off. |
| Add Blackout | Button | Block a range of days. |
| Save day(s) | Button | Block the days you picked. |
| Submit request | Button | Send your time-off request to the office. |
| Cancel | Button | Close without saving. |
| Start date (YYYY-MM-DD) | Field | The first day off. |
| End date (YYYY-MM-DD) | Field | The last day off. |
| Reason (optional) | Field | Why you need the time off. |

## #0092 Archived Jobs

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to the jobs list. |
| Unarchive | Button | Bring this job back to the main list. |

## #0093 Compensation Policy

| Control | Kind | Draft tooltip |
|---|---|---|
| Back | Button | Go back to payroll settings. |
| Save policy | Button | Save these default pay rates. |
| Hourly rate ($/hr) | Field | Default pay per hour for new techs. |
| Commission % | Field | Default share of the labor price for new techs. |
| Dev Tech default commission % of labor (0-50) | Field | Default share for techs in training, from 0 to 50. |
| Prem Tech bonus: flat ($) | Field | A set dollar bonus for doing a walk-through. |
| Prem Tech bonus: % of job total | Field | A bonus for the walk-through tech, as a share of the job. |
