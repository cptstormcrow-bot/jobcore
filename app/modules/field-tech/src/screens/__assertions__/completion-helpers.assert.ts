/**
 * Assertions for Completion screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { canSubmitCompletion, completionBlockedNotice } from '../completion-helpers';

const OK = { checklistComplete: true, afterPhotoCount: 1, notes: 'done', submitting: false };

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

test('canSubmitCompletion is false when the checklist is incomplete', () => {
  assert.equal(canSubmitCompletion({ ...OK, checklistComplete: false }), false);
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
