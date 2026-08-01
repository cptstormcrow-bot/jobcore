# P2D-AIRPLANE-MODE-TEST

Manual test procedure for ledger row P2d.4a — "Airplane-mode replay test | blocked until P2d.3c lands a real sqlite-backed queue." P2d.3c has landed, so this row unblocks. This document is the deliverable for that row: a procedure a tester runs by hand, not an automated suite.

## Status of this row

This ships as a **documented manual procedure**, not an automated test. There is no test runner installed in the mobile app: `apps/mobile` devDependencies are only `@types/react` and `typescript`, and `package.json` has no `test` script. There is nothing to wire an automated case into.

Two further gates apply to what this procedure can exercise:

- No UI call site exists for `enqueue` yet. Nothing in the app (source under `app/apps/mobile/src`, `app/apps/mobile/app`, `app/modules`) calls `enqueue`, `replayPending`, `listPending`, or `markFailed` except `offline-db.ts` itself. Job actions get wired to the queue in **P2-e**.
- No Supabase transport exists for replay yet. `replay` is deliberately left unwired on the `SyncStatusProvider` mount in `app/_layout.tsx`, because `ReplayOptions.send` needs a live transport that does not exist. This procedure exercises replay with a **stub** `send`, never a real network call.

## What this procedure can and cannot prove

| CAN prove | CANNOT prove |
|---|---|
| Schema creation on first open | Real network replay |
| Durability of queued rows across app restart | Conflict resolution against a server |
| Count semantics (`'failed'` excluded from `countPending()`) | End-user job-action flow (no UI call site until P2-e) |
| Indicator states and colours (pending / syncing / error / hidden) | |
| Replay drain via a stub `send` that resolves | |
| `markFailed` path via a stub `send` that rejects | |
| Idempotent re-open of the offline db | |

## Preconditions

- A physical device or emulator with the Jobcore mobile app installed.
- App started with `npm start` from `app/apps/mobile`.
- Signed in — the sync indicator only renders on the authenticated branch of `app/_layout.tsx`.
- A clean queue — uninstall/reinstall the app, or delete the app's data, to drop `jobcore-offline.db` (see `OFFLINE_DB_NAME` in `offline-db.ts`) before starting.

## Temporary dev harness

`enqueue`, `replayPending`, `listPending`, `markFailed`, and `countPending` have no UI call site yet, so exercising them requires a throwaway dev-only screen or control that imports these functions directly from `../src/lib/offline-db` and calls them on press. This harness is illustrative only — adapt paths/imports to wherever it is temporarily dropped in the app tree.

```tsx
// DEV-ONLY HARNESS — never commit
import { Pressable, Text, View } from 'react-native';
import {
  enqueue, countPending, listPending, replayPending,
} from '../src/lib/offline-db';

export function DevQueueHarness() {
  const enqueue3 = async () => {
    for (let i = 0; i < 3; i++) {
      await enqueue({
        id: `m-${i}`, op: 'test.op', payload: '{}',
        occurredAt: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
  };
  return (
    <View>
      <Pressable onPress={enqueue3}><Text>Enqueue 3</Text></Pressable>
      <Pressable onPress={() => countPending().then(console.log)}><Text>Count</Text></Pressable>
      <Pressable onPress={() => replayPending(async () => {}).then(console.log)}><Text>Replay OK</Text></Pressable>
      <Pressable onPress={() => replayPending(async () => { throw new Error('x'); }).then(console.log)}>
        <Text>Replay FAIL</Text>
      </Pressable>
      <Pressable onPress={() => listPending().then(console.log)}><Text>List</Text></Pressable>
    </View>
  );
}
```

**TEARDOWN WARNING**: this harness is deleted before commit — it is never staged, never merged. After removing it, `npx tsc --build --force` run from `app/apps/mobile` must return exit code 0 again, confirming no residue was left behind.

## Procedure

a. **Fresh install and sign in.** Confirm no indicator is visible. Expected: `pendingCount` is 0, no error, the `SyncIndicator` renders nothing (it renders nothing when `pendingCount === 0 && !syncing && !lastError`).

b. **Enable airplane mode** on the device.

c. **Enqueue 3 mutations** via the harness, with distinct ids and ascending `occurredAt` ISO strings. Expected: `countPending()` returns 3.

d. **Tap the indicator** to trigger `refresh()`. Expected: the overlay shows the label "3 pending" in colour `colors.warning` (`#D97706`).

e. **Force-quit and relaunch** the app, still in airplane mode. Expected: the indicator returns to "3 pending" — the rows survived the restart, proving durability.

f. **Replay with a resolving stub `send`** via the harness's "Replay OK" control. Expected: `replayPending` returns `{ sent: 3, failed: 0 }`; `countPending()` is now 0; after `refresh()` the overlay disappears entirely.

g. **Enqueue 2 more, then replay with a rejecting stub `send`** via "Replay FAIL". Expected: `replayPending` returns `{ sent: 0, failed: 2 }`; both rows now have `status: 'failed'` with `attempts` incremented to 1; `countPending()` is 0 because `'failed'` rows are excluded by design; the overlay is therefore hidden even though the failed rows remain in the `offline_queue` table. This is intentional — failed rows surface through the indicator's separate `lastError` channel, not through the pending count.

h. **Leave airplane mode.** Expected: nothing changes automatically. No transport and no connectivity listener are wired today, so the queue does not auto-drain on reconnect. This is expected, not a defect.

i. **Remove the harness** and re-run `npx tsc --build --force` from `app/apps/mobile`. Expected: exit code 0.

## Results log

| Step | Expected | Observed | Pass/Fail | Notes |
|---|---|---|---|---|
| a | No indicator visible, pendingCount 0, no error | | | |
| b | Airplane mode enabled | | | |
| c | countPending() === 3 | | | |
| d | Overlay shows "3 pending" in #D97706 | | | |
| e | Indicator shows "3 pending" after relaunch | | | |
| f | ReplayResult { sent: 3, failed: 0 }; countPending() === 0; overlay hidden | | | |
| g | ReplayResult { sent: 0, failed: 2 }; both rows 'failed', attempts 1; countPending() === 0; overlay hidden | | | |
| h | No auto-drain on leaving airplane mode | | | |
| i | tsc --build --force exits 0 after harness removal | | | |

## Deferred to later rows

| Item | Reason |
|---|---|
| Real-transport replay | Needs a live Supabase project + transport wiring; gated |
| End-user job-action flow | P2-e wires `enqueue` to job actions |
| Automated regression suite | Needs a test runner installed; out of scope for P2-d |
| Connectivity-triggered auto-replay | No connectivity listener wired yet |
