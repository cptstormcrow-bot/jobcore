# P2-e — Airplane-Mode Calendar Render Test (manual procedure)

Discharges **02-P2-scheduling-core.md AC 3** — "The day view renders correctly in **airplane mode**
from cached data."

`apps/mobile` has no test runner and no `test` script, so this is a manual procedure, mirroring
`P2D-AIRPLANE-MODE-TEST.md`. Run it on a physical device or an emulator with a real network toggle.

## Preconditions

- `npx tsc --build --force` from `app/apps/mobile` exits 0.
- A dev build is installed and has been launched at least once WITH networking, so the JS bundle is
  resident and the session provider has settled.
- Signed in as a user whose profile role is known (record which — the role gate branches on it).

## Known scope limit (read before judging a result)

There is no job data seam anywhere in the app yet. `app/(tabs)/calendar.tsx` renders from an empty
module-scope `jobs: Job[] = []`, and `app/(tabs)/jobs.tsx` holds `selectedJob` as a typed `null`.
So "renders correctly from cached data" is verified here as **the view mounts, lays out, and paints
its chrome with the network off** — not as "cached jobs appear". Wiring a real source is a later
slice. A later run of this procedure against a live data seam must re-check the job-row assertions.

## Procedure

1. Launch the app with networking ON. Confirm you land on the launcher route (`app/index.tsx`).
2. Navigate into the `(tabs)` group and select the **Calendar** tab. Confirm the day view paints:
   the hour rail (07:00–19:00) and the day header are visible.
3. Enable **airplane mode** at the OS level. Do NOT reload the bundle and do NOT force-quit.
4. Switch Calendar to **week view**. Confirm the 7 day columns render and scroll horizontally.
5. Switch back to **day view**. Confirm it re-renders with no crash, no red box, and no infinite
   spinner.
6. Select the **Jobs** tab. Confirm the `EmptyState` renders ("No job selected…") rather than a
   crash — the registry lookup in `jobs.tsx` runs offline against in-memory session state.
7. Background the app for ~30 seconds, foreground it, and re-check steps 5 and 6.
8. Disable airplane mode. Confirm no error surfaces on reconnect.

## Expected results

| # | Assertion | Expected |
|---|---|---|
| 1 | Day view mounts with network off | renders, no crash |
| 2 | Hour rail 07:00–19:00 present | yes |
| 3 | Week view renders 7 columns offline | yes |
| 4 | Day ↔ week toggle offline | no crash |
| 5 | Jobs tab renders `EmptyState` offline | yes |
| 6 | Foreground/background cycle offline | state retained, no crash |
| 7 | Reconnect | no error surfaced |
| 8 | Cached job rows appear | **N/A — no job data seam exists (see scope limit)** |

## Recording the outcome

Record PASS/FAIL per row in the P2-e build report. Row 8 is reported **DEFERRED**, never PASSED —
it is unverifiable by construction until a job data seam lands.
