---
classification: sdassemblypros/jobcore
comments: "Admin Sync Monitor: plan and evaluation"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/sync-monitor-plan.md
tags: [sdassemblypros, jobcore]
---
# Admin Sync Monitor: plan and evaluation

Status: Steps 1, 2 and 4 built 2026-11-04 (no admin buttons yet). Step 3 not built. Migration 0121 pushed live 2026-11-04.

## What you asked for

Turn Sync on in the web Options menu, but have it open an admin screen that shows each tech's sync problems and who is online right now, with a way for the admin to reset or cancel a tech's stuck sync.

## The one fact that shapes everything

A tech's unsent changes live **only on that tech's phone**, in the phone's own offline database. The server never sees them until they send. Today nothing on the phone reports its queue to the server, so the web app has nothing to show. (Checked: no heartbeat, last-seen or device-status table exists in `supabase/migrations`; the queue lives in `apps/mobile/src/lib/offline-db.ts`.)

So the feature has two halves:

1. **The phone reports.** Each phone writes a short status row to the server.
2. **The admin sends orders.** The admin's reset or cancel is stored on the server, and the phone carries it out the next time it is online.

## Plan

### Step 1. New server tables (one migration, needs your go before the live push)

- `device_sync_status`, one row per tech per phone: tech, phone name, app version, online or offline, last seen, waiting count, failed count, stuck count, the latest error text, and a short list of the failed items (type of change, which job, when it was saved, the error). No full record contents.
- `device_sync_commands`: an admin's order for one phone: `retry`, `unstick`, `discard_failed`, or `full_resync`, who sent it, when, and when the phone finished it (or why it could not).
- Rules: a tech can only write their own status row and read their own orders. Only admins and the owner can read every row and create orders.

### Step 2. Phone reports its status

In `apps/mobile/src/lib/sync-status.tsx`, after every sync pass, on each online/offline change, and every 2 minutes while the app is open, the phone writes its row. If the phone is offline the write waits, and the row's "last seen" simply gets older, which is itself the signal.

### Step 3. Phone carries out admin orders

On each sync pass the phone reads its unfinished orders and runs them with the functions that already exist on screen #0098: retry all failed, unstick all, discard failed. Then it marks the order done and reports its new counts.

`discard_failed` first copies each failed item into the server's order record, so nothing is lost for good even if the admin chose wrong.

### Step 4. Web screen

- Options menu shows **Sync** on web too, for admins and the owner only. On web it opens a new screen, **#0101 Tech sync monitor**.
- One card per tech: online dot (green if seen in the last 5 minutes, gray otherwise), last seen, waiting, failed, stuck, latest error, and app version.
- Tapping a tech shows the failed items, cited by Job #N, plus three buttons: **Retry**, **Unstick**, **Discard failed** (discard asks first).
- Each order shows "Waiting for phone", "Done", or "Could not run" with the reason.
- The screen refreshes every 30 seconds.

### Step 5. Phone side stays as is

Techs keep screen #0098 on their phone exactly as now.

Rough size: one migration, about 6 changed files, 1 new screen.

## How effective it would be

**Good at:**
- Seeing at a glance which tech has stuck or failed changes, and which phones have not checked in. That is most of the support value.
- Fixing the common cases without touching the phone: a failed item that just needs a retry, a row stuck "sending" after the app was killed, a change the server will never accept.
- Catching techs on an old app version.

**Not good at:**
- **A phone that is offline cannot be fixed remotely.** The order waits until it reconnects. The screen will show "Waiting for phone," but the admin cannot force anything.
- **The cause is often on the phone itself**, such as no signal or a dead app. The monitor tells you that, but it does not cure it.
- **"Online" means "the app reported recently,"** not live. A phone that is closed shows as offline even with full signal. Android also pauses apps in the background, so a tech in their pocket may look offline.

My estimate: it would answer most "why didn't my job save?" calls from your desk, and fix perhaps half of them without the tech doing anything.

## Edge cases

1. **Tech fixes it on the phone while an admin order is waiting.** The phone finds nothing to do and marks the order "done, nothing to do."
2. **Two admins send different orders.** The phone runs them in the order they were sent. Discard always runs last.
3. **Tech signs out or reinstalls.** The local queue is gone. The status row goes stale. The monitor should show "not seen since…" and let an admin hide old phones.
4. **Tech has two phones.** Each phone gets its own row, so both show.
5. **Discard on a change that would have sent a minute later.** The saved copy in the order record lets an admin see what was lost and re-enter it.
6. **Clock wrong on the phone.** Use server time for "last seen," not the phone's time.
7. **Very large failure lists.** Report the 20 newest items plus the total count.
8. **Error text containing customer details.** Only admins and the owner can read it, same as job data today.

## Would it cause trouble?

- **Data use and battery:** small. One short write every 2 minutes while the app is open, and nothing while closed.
- **Risk to the sync itself:** low if the report and the order check are wrapped so a failure there never stops a normal sync pass. That must be a hard rule in the build.
- **Discard is the only dangerous button.** It deletes work that was never sent. The saved copy and a confirm prompt make it recoverable, and it could be limited to the owner.
- **Live database change:** this needs one new migration and live push, so it waits for your go.
- **Web menu change:** Sync on web opens the monitor, not #0098. On web, #0098 would always be empty because web has no offline queue.
- **Older app builds** in the field will not report until they update, so they will show as "never seen" at first.

## Recommendation

Worth building. It is low risk if reporting can never block a sync pass. Start with Steps 1, 2 and 4, which show the problem without any buttons, and add the orders in Step 3 as a second step once you trust what the screen shows.
