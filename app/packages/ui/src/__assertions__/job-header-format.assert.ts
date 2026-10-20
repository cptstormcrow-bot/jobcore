import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCreatedDate,
  formatJobHeaderLines,
  formatJobNumberLabel,
  formatJobNumberLine,
  formatScheduleLabel,
  formatScheduledLabel,
} from '../job-header-format';

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
  assert.equal(formatJobNumberLine(3, ISO, 'en-US'), 'Job #3 - ' + expectedDate);
  assert.equal(formatJobNumberLine(null, null, 'en-US'), 'Job #— - —');
  assert.equal(formatJobNumberLine('0047', ISO, 'en-US'), 'Job #0047 - ' + expectedDate);
});

test('formatJobNumberLabel', () => {
  assert.equal(formatJobNumberLabel(7), 'Job #7');
  assert.equal(formatJobNumberLabel(null), 'Job #—');
  assert.equal(formatJobNumberLabel(undefined), 'Job #—');
});

test('formatJobHeaderLines', () => {
  assert.deepEqual(formatJobHeaderLines(4, ISO, 'en-US'), { jobLine: 'Job #4', dateLine: expectedDate });
  assert.deepEqual(formatJobHeaderLines(null, null, 'en-US'), { jobLine: 'Job #—', dateLine: '—' });
});

test('formatScheduleLabel times', () => {
  assert.equal(formatScheduleLabel(new Date(2026, 11, 14, 9, 0)), 'Monday, Dec 14, 2026 - 9am');
  assert.equal(formatScheduleLabel(new Date(2026, 11, 14, 9, 30)), 'Monday, Dec 14, 2026 - 9:30am');
  assert.equal(formatScheduleLabel(new Date(2026, 11, 14, 12, 0)), 'Monday, Dec 14, 2026 - 12pm');
  assert.equal(formatScheduleLabel(new Date(2026, 11, 14, 0, 0)), 'Monday, Dec 14, 2026 - 12am');
  assert.equal(formatScheduleLabel(new Date(2026, 11, 14, 15, 5)), 'Monday, Dec 14, 2026 - 3:05pm');
});
test('formatScheduleLabel unscheduled', () => {
  assert.equal(formatScheduleLabel(null), 'Unscheduled');
  assert.equal(formatScheduleLabel(undefined), 'Unscheduled');
  assert.equal(formatScheduleLabel(''), 'Unscheduled');
  assert.equal(formatScheduleLabel('not a date'), 'Unscheduled');
});

test('formatScheduledLabel scheduled morning', () => {
  assert.equal(formatScheduledLabel(new Date(2026, 9, 23, 8, 0), true, 'en-US'), 'Friday, Oct 23, 2026 - 8am');
});
test('formatScheduledLabel unscheduled', () => {
  assert.equal(formatScheduledLabel(null, true, 'en-US'), 'Unscheduled ▸');
  assert.equal(formatScheduledLabel(null, false, 'en-US'), 'Unscheduled');
  assert.equal(formatScheduledLabel('garbage', true, 'en-US'), 'Unscheduled ▸');
});
test('formatScheduledLabel afternoon', () => {
  assert.ok(norm(formatScheduledLabel('2026-10-23T15:05:00', true, 'en-US')).endsWith('3:05pm'));
});
