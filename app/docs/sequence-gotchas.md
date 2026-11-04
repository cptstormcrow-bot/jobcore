# Sequence gotchas (whole-app pass, next build vc28)

Things that go wrong only when several steps happen in a certain order. Each one below
is either fixed in this pass (with a test) or explained, with what to do about it.

## Fixed in this pass

| # | The sequence | What went wrong | Fix |
|---|---|---|---|
| 1 | Save a change to Job #N on a slow connection, then quickly make a second change to Job #N. | The second change could send first, then the first one landed on top and undid it. | A change being sent now holds back later changes to the same record. Changes to other jobs still send. |
| 2 | Person A makes changes offline, signs out, Person B signs in on the same phone with internet. | A's changes were sent under B's sign-in, so they failed or were saved as B. | Each change remembers who made it. It waits for that person's next sign-in. |
| 3 | Sign out or switch user on #0068 Account with changes not yet sent. | No warning. The changes seemed lost. | The sign-out and switch-user prompts now say how many changes are waiting and that they send at the next sign-in. |
| 4 | Change Job #N's stage offline, go online, then finish it on #0018 Complete Job before the queue catches up. | The older stage change could land after the finish and undo it. On a job made offline, the finish failed because the job was not on the server yet. | #0018 Complete Job now queues behind anything still waiting on that job, and drops older stage changes it fully replaces. |
| 5 | Edit a time entry on #0084 Payroll, then submit the week, on a slow connection. | These had no record key, so one stuck time entry stopped every other change (jobs, notes, photos) from sending. | Time entries and the week submit share one key per person. They stay in order with each other and no longer hold back job changes. Time-off requests got their own key too. |

## Known, not changed

| # | The sequence | What happens | What to do |
|---|---|---|---|
| A | A change sends, then the app is closed before it hears back. | On the next open it sends again. | The server sees it was already saved and treats it as done. Nothing to do. |
| B | Save offline, then the server refuses the change for good (for example, no permission). | The screen shows an error and the change also sits in #0098 Sync issues. | Fix or discard it in #0098 Sync issues. |
| C | Make Job #N offline, add a note to it, and the create fails. | The note fails too, because the job is not on the server. | Retry the create first in #0098 Sync issues, then retry the note. |
| D | Discard a change in #0098 Sync issues while offline. | The screen can still show the discarded value until the internet is back and the saved data refreshes. | Go online once, or pull to refresh. |
| E | Approve a week on #0088 Payroll while a tech still has unsent hours on their own phone. | The approval does not include those hours. Another phone's queue can't be seen from here. | Ask the tech to open the app with internet before you approve. |
| F | Sign out with unsent changes and never sign in again as that person. | Those changes stay on the phone. | Sign in as that person with internet once, and they send. |

## Spotty internet (random drops)

| # | What happens on a bad signal | What went wrong | Fix |
|---|---|---|---|
| 6 | The phone shows connected, but no data gets through (weak bars, a dead hotspot, a captive Wi-Fi page). | A request waited forever. Sync stayed stuck "running", so no later sync ever started, and a save being sent stayed "sending" until the app was restarted, holding back later changes to that job. | Every request now gives up after 30 seconds (2 minutes for photo uploads) and is retried later like any dropped request. |
| 7 | The connection drops in the middle of sending a change. | The drop was reported in a shape the app didn't recognize, so it was counted as an unknown error. After 8 drops the change was marked failed for good, and sync kept trying the rest of the queue against a dead connection. | A dropped request is now recognized as a network drop: sync stops and waits for the signal, and the change gets the full 10 tries. |

Already handled, checked in this pass: the app closed mid-send (the change resends on next open), a sign-in token refresh that fails during a drop (treated as a network drop), and a photo that uploaded but whose record did not save (the retry reuses the uploaded file).
