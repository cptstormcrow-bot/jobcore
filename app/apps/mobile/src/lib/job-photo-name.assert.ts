/**
 * Assertions for before-photo naming helpers. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_BEFORE_PHOTOS,
  beforePhotoFileName,
  beforePhotoSlot,
  nextFreeBeforeSlot,
} from './job-photo-name';

test('max is six', () => {
  assert.equal(MAX_BEFORE_PHOTOS, 6);
});

test('file name uses job number and index', () => {
  assert.equal(beforePhotoFileName(10, 'id', 1), '10BEF-1.jpg');
  assert.equal(beforePhotoFileName('10', 'id', 1), '10BEF-1.jpg');
});

test('index 1..6 valid, 0 and 7 throw', () => {
  assert.equal(beforePhotoFileName(10, 'id', 6), '10BEF-6.jpg');
  assert.throws(() => beforePhotoFileName(10, 'id', 0), RangeError);
  assert.throws(() => beforePhotoFileName(10, 'id', 7), RangeError);
  assert.throws(() => beforePhotoFileName(10, 'id', 1.5), RangeError);
});

test('job number 0 is valid', () => {
  assert.equal(beforePhotoFileName(0, 'abcdef123456', 2), '0BEF-2.jpg');
});

test('null/blank number falls back to first 8 safe chars of jobId', () => {
  assert.equal(beforePhotoFileName(null, 'abcdef1234567890', 1), 'abcdef12BEF-1.jpg');
  assert.equal(beforePhotoFileName(undefined, 'abcdef1234567890', 1), 'abcdef12BEF-1.jpg');
  assert.equal(beforePhotoFileName('   ', 'abcdef1234567890', 1), 'abcdef12BEF-1.jpg');
  assert.equal(beforePhotoFileName(null, 'ab-cd-ef-1234', 1), 'ab-cd-efBEF-1.jpg');
});

test('unsafe characters are stripped', () => {
  assert.equal(beforePhotoFileName('1/2 .3', 'id', 1), '123BEF-1.jpg');
  assert.equal(beforePhotoFileName('A#b$', 'id', 3), 'AbBEF-3.jpg');
});

test('slot parses from name and path', () => {
  assert.equal(beforePhotoSlot('10BEF-4.jpg'), 4);
  assert.equal(beforePhotoSlot('org/job/10BEF-3.jpg'), 3);
  assert.equal(beforePhotoSlot('org\\job\\10BEF-5.jpg'), 5);
  assert.equal(beforePhotoSlot('other.jpg'), null);
  assert.equal(beforePhotoSlot('10BEF-7.jpg'), null);
  assert.equal(beforePhotoSlot(''), null);
});

test('nextFreeBeforeSlot fills gaps, starts at 1, null when full', () => {
  assert.equal(nextFreeBeforeSlot([]), 1);
  assert.equal(nextFreeBeforeSlot(['10BEF-1.jpg', 'x/10BEF-3.jpg']), 2);
  assert.equal(nextFreeBeforeSlot(['junk.jpg']), 1);
  const full = [1, 2, 3, 4, 5, 6].map((i) => `10BEF-${i}.jpg`);
  assert.equal(nextFreeBeforeSlot(full), null);
  assert.equal(nextFreeBeforeSlot(full.slice(0, 5)), 6);
});
