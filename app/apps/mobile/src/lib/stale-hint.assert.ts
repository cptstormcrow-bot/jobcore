/**
 * Assertions for stale-hint helpers. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeStale, staleHintText, type StaleEntry } from './stale-hint';

const at = new Date(2026, 9, 29, 14, 41).getTime(); // local 2:41 PM
const sameDayNow = new Date(2026, 9, 29, 16, 0).getTime();
const nextDayNow = new Date(2026, 9, 30, 9, 0).getTime();

const entries: StaleEntry[] = [
  { query: 'app.jobs.byId', servingStale: true, cachedAt: at },
  { query: 'app.jobs.extras', servingStale: false, cachedAt: at - 1000 },
  { query: 'ft.jobs.listAssignedToTech', servingStale: true, cachedAt: at - 5000 },
];

test('fresh data is not stale and shows no hint', () => {
  const s = summarizeStale([entries[1]!]);
  assert.deepEqual(s, { stale: false, cachedAt: null });
  assert.equal(staleHintText(s, sameDayNow), null);
  assert.equal(summarizeStale([]).stale, false);
});

test('stale entries report the oldest cached-at', () => {
  assert.deepEqual(summarizeStale(entries), { stale: true, cachedAt: at - 5000 });
});

test('prefix filter limits which entries count', () => {
  assert.deepEqual(summarizeStale(entries, ['app.jobs.byId']), { stale: true, cachedAt: at });
  assert.equal(summarizeStale(entries, ['app.jobs.extras']).stale, false);
  assert.equal(summarizeStale(entries, ['nope.']).stale, false);
  assert.equal(summarizeStale(entries, []).stale, true);
});

test('same-day text shows the time only', () => {
  const t = staleHintText({ stale: true, cachedAt: at }, sameDayNow);
  assert.match(t!, /^Saved data · last updated 2:41\s?PM$/);
});

test('older-day text includes the date', () => {
  const t = staleHintText({ stale: true, cachedAt: at }, nextDayNow);
  assert.match(t!, /^Saved data · last updated Oct 29, 2:41\s?PM$/);
});

test('unknown time falls back to a plain warning', () => {
  assert.equal(staleHintText({ stale: true, cachedAt: null }), 'Saved data · may be out of date');
});
