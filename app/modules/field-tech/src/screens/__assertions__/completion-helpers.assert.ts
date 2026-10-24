/**
 * Assertions for Completion screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPLETION_CHECKLIST_ITEMS,
  UPSTAIRS_FEE,
  UPSTAIRS_FEE_DESCRIPTION,
  buildCompletionNoteBody,
  canSubmitCompletion,
  completionBlockedNotice,
  formatTimeSpent,
  upstairsFeeApplies,
} from '../completion-helpers';

const OK = { buildsFinished: true, debrisCleared: true, afterPhotoCount: 1, notes: 'done', submitting: false };

const ALREADY = 'This job is already complete.';
const CANCELLED = 'This job was cancelled, so it cannot be completed.';
const NOT_STARTED = 'Start the job first, then you can complete it.';

// JobStatus members from app/packages/core/src/index.ts lines 79-93 that are
// not in_progress, cancelled, or past completion (completed/paid/closed/archived).
const NOT_STARTED_STATUSES = [
  'new',
  'qualified',
  'scheduled',
  'assigned',
  'accepted',
  'en_route',
  'declined',
  'needs_reschedule',
];

test('canSubmitCompletion is true when every condition holds', () => {
  assert.equal(canSubmitCompletion(OK), true);
});

test('canSubmitCompletion is false when builds are not finished', () => {
  assert.equal(canSubmitCompletion({ ...OK, buildsFinished: false }), false);
});

test('canSubmitCompletion is false when debris is not cleared', () => {
  assert.equal(canSubmitCompletion({ ...OK, debrisCleared: false }), false);
});

test('canSubmitCompletion requires damage text when damage is ticked', () => {
  assert.equal(canSubmitCompletion({ ...OK, damageChecked: true, damageText: '' }), false);
  assert.equal(canSubmitCompletion({ ...OK, damageChecked: true, damageText: '  \n ' }), false);
  assert.equal(canSubmitCompletion({ ...OK, damageChecked: true, damageText: 'dent on box' }), true);
});

test('canSubmitCompletion requires scope text when extra scope is ticked', () => {
  assert.equal(canSubmitCompletion({ ...OK, scopeChecked: true, scopeText: '' }), false);
  assert.equal(canSubmitCompletion({ ...OK, scopeChecked: true, scopeText: '  \t ' }), false);
  assert.equal(canSubmitCompletion({ ...OK, scopeChecked: true, scopeText: 'added a desk' }), true);
});

test('canSubmitCompletion ignores damage/scope text when their box is unticked', () => {
  assert.equal(canSubmitCompletion({ ...OK, damageChecked: false, damageText: '' }), true);
  assert.equal(canSubmitCompletion({ ...OK, scopeChecked: false, scopeText: '' }), true);
  assert.equal(canSubmitCompletion({ ...OK, damageChecked: false, damageText: 'stray' }), true);
  assert.equal(canSubmitCompletion({ ...OK, scopeChecked: false, scopeText: 'stray' }), true);
});

test('COMPLETION_CHECKLIST_ITEMS has the 7 items in order with exact labels', () => {
  assert.deepEqual(COMPLETION_CHECKLIST_ITEMS, [
    { key: 'materialsOnsite', label: 'Materials onsite and complete?' },
    { key: 'movedUpstairs', label: 'Materials moved upstairs', hint: '$20 fee if not done' },
    { key: 'damage', label: 'List any apparent damage to the box(es) or unpacked items before assembly' },
    { key: 'extraScope', label: 'Additional items added to scope after arrival?' },
    { key: 'buildsFinished', label: 'Build(s) finish successfully' },
    { key: 'debrisCleared', label: 'Worksite debris cleared/packed' },
    { key: 'photosTaken', label: 'Photographs taken' },
  ]);
  assert.equal(COMPLETION_CHECKLIST_ITEMS.length, 7);
});

test('upstairs fee constants', () => {
  assert.equal(UPSTAIRS_FEE, 20);
  assert.equal(UPSTAIRS_FEE_DESCRIPTION, 'Materials not moved upstairs fee');
});

test('upstairsFeeApplies is true only when not moved upstairs', () => {
  assert.equal(upstairsFeeApplies(false), true);
  assert.equal(upstairsFeeApplies(true), false);
});

test('formatTimeSpent formats whole minutes and handles bad input', () => {
  assert.equal(formatTimeSpent(0), '0h 0m');
  assert.equal(formatTimeSpent(3725), '1h 2m');
  assert.equal(formatTimeSpent(59), '0h 0m');
  assert.equal(formatTimeSpent(null), '--');
  assert.equal(formatTimeSpent(undefined), '--');
  assert.equal(formatTimeSpent(Number.NaN), '--');
  assert.equal(formatTimeSpent(-1), '--');
});

const NOTE_ALL = {
  materialsOnsite: true,
  movedUpstairs: true,
  damageChecked: true,
  damageText: '  dent on box  ',
  scopeChecked: true,
  scopeText: 'added a desk',
  buildsFinished: true,
  debrisCleared: true,
  afterPhotoCount: 3,
  timeSpentSeconds: 3725,
  feeApplied: false,
};

test('buildCompletionNoteBody renders everything ticked', () => {
  const expected = [
    '[x] Materials onsite and complete?',
    '[x] Materials moved upstairs',
    '[x] List any apparent damage to the box(es) or unpacked items before assembly - dent on box',
    '[x] Additional items added to scope after arrival? - added a desk',
    '[x] Build(s) finish successfully',
    '[x] Worksite debris cleared/packed',
    '[x] Photographs taken (3 photos)',
    '',
    'Time spent: 1h 2m',
    'Upstairs fee: none',
  ].join('\n');
  assert.equal(buildCompletionNoteBody(NOTE_ALL), expected);
});

test('buildCompletionNoteBody shows the fee line when not moved upstairs', () => {
  const body = buildCompletionNoteBody({ ...NOTE_ALL, movedUpstairs: false, feeApplied: true, afterPhotoCount: 1 });
  const lines = body.split('\n');
  assert.equal(lines[1], '[ ] Materials moved upstairs');
  assert.equal(lines[6], '[x] Photographs taken (1 photo)');
  assert.equal(lines[9], 'Upstairs fee: $20.00 added');
});

test('buildCompletionNoteBody ignores text when damage/scope are unticked', () => {
  const body = buildCompletionNoteBody({
    ...NOTE_ALL,
    damageChecked: false,
    damageText: 'stray damage',
    scopeChecked: false,
    scopeText: 'stray scope',
  });
  const lines = body.split('\n');
  assert.equal(lines[2], '[ ] List any apparent damage to the box(es) or unpacked items before assembly');
  assert.equal(lines[3], '[ ] Additional items added to scope after arrival?');
  assert.ok(!body.includes('stray'));
});

test('buildCompletionNoteBody is deterministic', () => {
  assert.equal(buildCompletionNoteBody(NOTE_ALL), buildCompletionNoteBody({ ...NOTE_ALL }));
});

test('canSubmitCompletion is false with zero photos', () => {
  assert.equal(canSubmitCompletion({ ...OK, afterPhotoCount: 0 }), false);
});

test('canSubmitCompletion is false with empty or whitespace-only notes', () => {
  assert.equal(canSubmitCompletion({ ...OK, notes: '' }), false);
  assert.equal(canSubmitCompletion({ ...OK, notes: '   \n\t ' }), false);
});

test('canSubmitCompletion is false while submitting', () => {
  assert.equal(canSubmitCompletion({ ...OK, submitting: true }), false);
});

test('canSubmitCompletion accepts padded notes and multiple photos', () => {
  assert.equal(canSubmitCompletion({ ...OK, notes: '  done  ' }), true);
  assert.equal(canSubmitCompletion({ ...OK, afterPhotoCount: 3 }), true);
});

test('completionBlockedNotice says already complete for completed/paid/closed/archived', () => {
  for (const status of ['completed', 'paid', 'closed', 'archived']) {
    assert.equal(completionBlockedNotice({ status }), ALREADY, status);
  }
});

test('completionBlockedNotice says cancelled for cancelled', () => {
  assert.equal(completionBlockedNotice({ status: 'cancelled' }), CANCELLED);
});

test('completionBlockedNotice says start the job first for every not-started status', () => {
  for (const status of NOT_STARTED_STATUSES) {
    assert.equal(completionBlockedNotice({ status }), NOT_STARTED, status);
  }
});

test('completionBlockedNotice is null for in_progress with no completedAt', () => {
  assert.equal(completionBlockedNotice({ status: 'in_progress' }), null);
  assert.equal(completionBlockedNotice({ status: 'in_progress', completedAt: null }), null);
  assert.equal(completionBlockedNotice({ status: 'in_progress', completedAt: '' }), null);
});

test('completionBlockedNotice says already complete when completedAt is set', () => {
  const completedAt = '2026-01-02T03:04:05Z';
  assert.equal(completionBlockedNotice({ status: 'in_progress', completedAt }), ALREADY);
  assert.equal(completionBlockedNotice({ status: 'scheduled', completedAt }), ALREADY);
});
