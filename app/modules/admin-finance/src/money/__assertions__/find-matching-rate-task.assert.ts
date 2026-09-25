/**
 * Assertions for findMatchingRate's optional taskId disambiguation (F11 S5).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-8): no DB, no network, no env vars, no faked
 * clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Job } from '@jobcore/core';
import type { PriceSheetRate } from '../types';
import { findMatchingRate } from '../commission';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'completed',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    source: null,
    payer: null,
    attachTiming: 'same_day',
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: 'tech-1',
    enRouteAt: '2026-08-01T13:00:00.000Z',
    inProgressAt: '2026-08-01T13:30:00.000Z',
    completedAt: '2026-08-01T15:30:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
    isBeta: false,
    totalLaborSeconds: 0,
    ...overrides,
  };
}

function makeRate(
  overrides: Partial<PriceSheetRate & { taskId?: string | null }> = {},
): PriceSheetRate & { taskId?: string | null } {
  return {
    id: 'rate-1',
    priceSheetId: 'ps-1',
    serviceId: 'svc-1',
    attachTiming: 'same_day',
    amount: 1000,
    ...overrides,
  };
}

test('findMatchingRate: exact task match wins over a null-task row', () => {
  const job = makeJob();
  const rates = [
    makeRate({ id: 'null-row', taskId: null }),
    makeRate({ id: 'task-a-row', taskId: 'task-a' }),
  ];
  const result = findMatchingRate(job, rates, 'task-a');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.id, 'task-a-row');
});

test('findMatchingRate: unknown taskId falls back to the null-task row', () => {
  const job = makeJob();
  const rates = [
    makeRate({ id: 'null-row', taskId: null }),
    makeRate({ id: 'task-a-row', taskId: 'task-a' }),
  ];
  const result = findMatchingRate(job, rates, 'task-unknown');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.id, 'null-row');
});

test('findMatchingRate: unknown taskId with no null-task row falls back to first candidate', () => {
  const job = makeJob();
  const rates = [
    makeRate({ id: 'task-a-row', taskId: 'task-a' }),
    makeRate({ id: 'task-b-row', taskId: 'task-b' }),
  ];
  const result = findMatchingRate(job, rates, 'task-unknown');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.id, 'task-a-row');
});

test('findMatchingRate: with no taskId, the null-task row is preferred over a task-specific row', () => {
  const job = makeJob();
  const rates = [
    makeRate({ id: 'task-a-row', taskId: 'task-a' }),
    makeRate({ id: 'null-row', taskId: null }),
  ];
  const result = findMatchingRate(job, rates);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.id, 'null-row');
});

test('findMatchingRate: plain PriceSheetRate[] without a taskId field still matches (legacy behavior)', () => {
  const job = makeJob();
  const rates: readonly PriceSheetRate[] = [makeRate({ id: 'legacy-row' })];
  const result = findMatchingRate(job, rates);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.id, 'legacy-row');
});

test('findMatchingRate: no match', () => {
  const job = makeJob({ serviceId: 'svc-none' });
  const rates = [makeRate({ id: 'other-row' })];
  const result = findMatchingRate(job, rates);
  assert.equal(result.ok, false);
});
