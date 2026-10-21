import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampRange,
  defaultEnd,
  format12h,
  fromMinutes,
  isValidRange,
  stepEnd,
  stepStart,
  stepTime,
  toMinutes,
} from '../time-range';

test('toMinutes', () => {
  assert.equal(toMinutes('08:30'), 510);
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('bad'), 0);
});

test('fromMinutes', () => {
  assert.equal(fromMinutes(510), '08:30');
  assert.equal(fromMinutes(-5), '00:00');
  assert.equal(fromMinutes(2000), '23:30');
});

test('format12h', () => {
  assert.equal(format12h('08:00'), '8:00 AM');
  assert.equal(format12h('00:00'), '12:00 AM');
  assert.equal(format12h('12:00'), '12:00 PM');
  assert.equal(format12h('13:30'), '1:30 PM');
  assert.equal(format12h('23:30'), '11:30 PM');
});

test('stepTime', () => {
  assert.equal(stepTime('08:10', 1), '08:30');
  assert.equal(stepTime('08:20', 1), '09:00');
  assert.equal(stepTime('08:00', 1), '08:30');
  assert.equal(stepTime('08:00', -1), '07:30');
  assert.equal(stepTime('00:00', -1), '00:00');
  assert.equal(stepTime('23:30', 1), '23:30');
});

test('defaultEnd', () => {
  assert.equal(defaultEnd('08:00', 60), '09:00');
  assert.equal(defaultEnd('08:00', 10), '08:30');
  assert.equal(defaultEnd('08:00', 45), '09:00');
  assert.equal(defaultEnd('23:00', 120), '23:30');
});

test('clampRange', () => {
  assert.deepEqual(clampRange('08:00', '08:00'), { start: '08:00', end: '08:30' });
  assert.deepEqual(clampRange('09:00', '08:00'), { start: '09:00', end: '09:30' });
  assert.deepEqual(clampRange('23:30', '23:30'), { start: '23:00', end: '23:30' });
  assert.deepEqual(clampRange('08:00', '10:00'), { start: '08:00', end: '10:00' });
});

test('isValidRange', () => {
  assert.equal(isValidRange('08:00', '08:30'), true);
  assert.equal(isValidRange('08:00', '08:00'), false);
  assert.equal(isValidRange('09:00', '08:00'), false);
});

test('stepStart keeps duration', () => {
  assert.deepEqual(stepStart({ start: '08:00', end: '09:30' }, 1), { start: '08:30', end: '10:00' });
  assert.deepEqual(stepStart({ start: '08:00', end: '09:30' }, -1), { start: '07:30', end: '09:00' });
});

test('stepEnd', () => {
  assert.deepEqual(stepEnd({ start: '08:00', end: '09:00' }, 1), { start: '08:00', end: '09:30' });
  assert.deepEqual(stepEnd({ start: '08:00', end: '08:30' }, -1), { start: '08:00', end: '08:30' });
  assert.deepEqual(stepEnd({ start: '08:00', end: '23:30' }, 1), { start: '08:00', end: '23:30' });
});
