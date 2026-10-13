import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALKTHROUGH_STEPS, getHelpStep } from '../walkthrough-content';
import type { ScreenKey } from '../walkthrough-content';
import { HELP_CARDS } from '../help-content';
import type { JobStatus } from '@jobcore/core';

// JobStatus is a type-only union: packages/core/src/index.ts:79
const JOB_STATUSES: JobStatus[] = [
  'new', 'qualified', 'scheduled', 'assigned', 'accepted', 'en_route', 'in_progress',
  'completed', 'paid', 'closed', 'declined', 'needs_reschedule', 'cancelled', 'archived',
];

// ScreenKey is a type-only union: packages/ui/src/walkthrough/walkthrough-content.ts:47
const SCREEN_KEYS: ScreenKey[] = [
  'job-detail', 'jobs-list', 'admin-finance', 'qualify-lead', 'job-create', 'calendar', 'account', 'profile', 'settings', 'test-jobs',
  'af-overview', 'af-leads', 'af-jobs', 'af-assignments', 'af-price-sheets', 'af-payments', 'af-review', 'af-time-off', 'af-calendar', 'af-reports', 'af-employees',
  'ft-overview', 'ft-jobs', 'ft-time-off', 'ft-prems', 'ft-reviews', 'ft-job-detail',
  'sm-overview', 'sm-pitch', 'sm-composer', 'sm-reporting', 'sm-callbacks', 'sm-reviews',
];

// Status-driven screens need a representative status ('new' matches the "assign" step).
const STATUS_DRIVEN: ScreenKey[] = ['job-detail', 'ft-job-detail'];

test('every JobStatus resolves to a card on job-detail', () => {
  for (const status of JOB_STATUSES) {
    assert.ok(getHelpStep('job-detail', status), `no card for status ${status}`);
  }
});

test('every ScreenKey except admin-finance resolves to a non-fallback card', () => {
  for (const key of SCREEN_KEYS.filter((k) => k !== 'admin-finance')) {
    const status = STATUS_DRIVEN.includes(key) ? 'new' : undefined;
    const card = getHelpStep(key, status);
    assert.ok(card, `no card for ${key}`);
    assert.notEqual(card.id, 'help_general', `${key} fell back to help_general`);
  }
});

test('card ids are unique across WALKTHROUGH_STEPS and HELP_CARDS', () => {
  const ids = [...WALKTHROUGH_STEPS, ...HELP_CARDS].map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('WALKTHROUGH_STEPS has 8 steps', () => {
  assert.equal(WALKTHROUGH_STEPS.length, 8);
});
