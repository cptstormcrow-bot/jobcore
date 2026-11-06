import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapTime } from '../time-snap';

test('tapping an afternoon hour while AM is showing lands on PM (the 11am cap bug)', () => {
  for (const hour of [12, 1, 2, 3, 4, 5]) {
    const r = snapTime({ hour, minute: '30', meridiem: 'AM' }, true);
    assert.equal(r.hour, hour);
    assert.equal(r.meridiem, 'PM');
    assert.equal(r.minute, '30');
  }
});

test('tapping a morning hour while PM is showing lands on AM', () => {
  for (const hour of [7, 8, 9, 10, 11]) {
    const r = snapTime({ hour, minute: '15', meridiem: 'PM' }, true);
    assert.equal(r.hour, hour);
    assert.equal(r.meridiem, 'AM');
  }
});

test('6 PM is on the hour only', () => {
  assert.equal(snapTime({ hour: 6, minute: '45', meridiem: 'AM' }, true).minute, '00');
});

test('tapping AM/PM still drives the hour', () => {
  assert.deepEqual(snapTime({ hour: 3, minute: '00', meridiem: 'AM' }), { hour: 11, minute: '00', meridiem: 'AM' });
  assert.deepEqual(snapTime({ hour: 9, minute: '00', meridiem: 'PM' }), { hour: 12, minute: '00', meridiem: 'PM' });
  assert.deepEqual(snapTime({ hour: 9, minute: '00', meridiem: 'AM' }), { hour: 9, minute: '00', meridiem: 'AM' });
});
