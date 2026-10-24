import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPLOYEE_PROFILES_VIEW,
  isMissingEmployeeProfilesView,
  readEmployeeProfiles,
  resetEmployeeProfilesSourceForTests,
} from './employee-profiles-source';

type Err = { code: string; message: string } | null;
type Reply = { data: unknown; error: Err };

const MISSING_VIEW: Err = {
  code: 'PGRST205',
  message: "Could not find the table 'public.employee_profiles_v' in the schema cache",
};
const OK: Reply = { data: [{ id: 'p1' }], error: null };

// Replays `replies` in order and records which source each call asked for.
function scripted(replies: Reply[]) {
  const calls: string[] = [];
  const run = async (source: string): Promise<Reply> => {
    calls.push(source);
    const next = replies[calls.length - 1];
    assert.ok(next, `unexpected call #${calls.length} on ${source}`);
    return next;
  };
  return { calls, run };
}

test('view present: reads the view once and does not touch the table', async () => {
  resetEmployeeProfilesSourceForTests();
  const s = scripted([OK]);
  const out = await readEmployeeProfiles(s.run);
  assert.equal(out, OK);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW]);
});

test('view missing (PGRST205): retries once on profiles and remembers it', async () => {
  resetEmployeeProfilesSourceForTests();
  const s = scripted([{ data: null, error: MISSING_VIEW }, OK, OK]);
  const first = await readEmployeeProfiles(s.run);
  assert.equal(first, OK);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW, 'profiles']);
  await readEmployeeProfiles(s.run);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW, 'profiles', 'profiles']);
});

test('view missing (42P01): also falls back to profiles', async () => {
  resetEmployeeProfilesSourceForTests();
  const s = scripted([
    { data: null, error: { code: '42P01', message: 'relation "public.employee_profiles_v" does not exist' } },
    OK,
  ]);
  assert.equal(await readEmployeeProfiles(s.run), OK);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW, 'profiles']);
});

test('unrelated view error is returned as-is with no retry', async () => {
  resetEmployeeProfilesSourceForTests();
  const bad: Reply = { data: null, error: { code: '42501', message: 'permission denied for view employee_profiles_v' } };
  const s = scripted([bad]);
  assert.equal(await readEmployeeProfiles(s.run), bad);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW]);
});

test('table locked after fallback (42501): drops the memo and tries the view again', async () => {
  resetEmployeeProfilesSourceForTests();
  const locked: Reply = { data: null, error: { code: '42501', message: 'permission denied for table profiles' } };
  const s = scripted([{ data: null, error: MISSING_VIEW }, locked, OK, OK]);
  assert.equal(await readEmployeeProfiles(s.run), OK);
  assert.deepStrictEqual(s.calls, [EMPLOYEE_PROFILES_VIEW, 'profiles', EMPLOYEE_PROFILES_VIEW]);
  // memo was dropped, so the next read goes straight to the view
  await readEmployeeProfiles(s.run);
  assert.deepStrictEqual(s.calls.slice(3), [EMPLOYEE_PROFILES_VIEW]);
});

test('isMissingEmployeeProfilesView: only a missing-relation error that names the view', () => {
  assert.equal(isMissingEmployeeProfilesView(null), false);
  assert.equal(isMissingEmployeeProfilesView(MISSING_VIEW), true);
  assert.equal(
    isMissingEmployeeProfilesView({ code: 'PGRST205', message: "Could not find the table 'public.other_table'" }),
    false,
  );
  assert.equal(
    isMissingEmployeeProfilesView({ code: '42501', message: 'employee_profiles_v permission denied' }),
    false,
  );
});
