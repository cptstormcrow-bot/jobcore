import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCreatedDate, formatJobNumberLine, formatScheduledLabel } from '../job-header-format';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const ISO = '2026-10-01T12:00:00Z';
const expectedDate = new Date(ISO).toLocaleDateString('en-US');

test('formatCreatedDate valid ISO', () => {
  assert.equal(formatCreatedDate(ISO, 'en-US'), expectedDate);
});
test('formatCreatedDate null/undefined/invalid', () => {
  assert.equal(formatCreatedDate(null, 'en-US'), '—');
  assert.equal(formatCreatedDate(undefined, 'en-US'), '—');
  assert.equal(formatCreatedDate('not-a-date', 'en-US'), '—');
});
test('formatCreatedDate Date object', () => {
  assert.equal(formatCreatedDate(new Date(ISO), 'en-US'), expectedDate);
});

test('formatJobNumberLine', () => {
  assert.equal(formatJobNumberLine(3, ISO, 'en-US'), 'Job #3 - Created: ' + expectedDate);
  assert.equal(formatJobNumberLine(null, null, 'en-US'), 'Job #— - Created: —');
  assert.equal(formatJobNumberLine('0047', ISO, 'en-US'), 'Job #0047 - Created: ' + expectedDate);
});

test('formatScheduledLabel scheduled morning', () => {
  assert.equal(
    norm(formatScheduledLabel('2026-10-23T08:00:00', true, 'en-US')),
    'Scheduled - Friday, October 23, 2026 at 8:00 am',
  );
});
test('formatScheduledLabel unscheduled', () => {
  assert.equal(formatScheduledLabel(null, true, 'en-US'), 'Unscheduled ▸');
  assert.equal(formatScheduledLabel(null, false, 'en-US'), 'Unscheduled');
  assert.equal(formatScheduledLabel('garbage', true, 'en-US'), 'Unscheduled ▸');
});
test('formatScheduledLabel afternoon', () => {
  assert.ok(norm(formatScheduledLabel('2026-10-23T15:05:00', true, 'en-US')).endsWith('3:05 pm'));
});
