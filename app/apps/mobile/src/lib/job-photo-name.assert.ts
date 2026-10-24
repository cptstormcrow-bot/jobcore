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
  MAX_AFTER_PHOTOS,
  afterPhotoFileName,
  afterPhotoSlot,
  nextFreeAfterSlot,
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

test('after: max is six', () => {
  assert.equal(MAX_AFTER_PHOTOS, 6);
});

test('after: file name uses job number and index', () => {
  assert.equal(afterPhotoFileName(10, 'id', 1), '10AFT-1.jpg');
  assert.equal(afterPhotoFileName('10', 'id', 1), '10AFT-1.jpg');
});

test('after: index 1..6 valid, 0 and 7 throw', () => {
  assert.equal(afterPhotoFileName(10, 'id', 6), '10AFT-6.jpg');
  assert.throws(() => afterPhotoFileName(10, 'id', 0), RangeError);
  assert.throws(() => afterPhotoFileName(10, 'id', 7), RangeError);
  assert.throws(() => afterPhotoFileName(10, 'id', 1.5), RangeError);
});

test('after: job number 0 is valid', () => {
  assert.equal(afterPhotoFileName(0, 'abcdef123456', 2), '0AFT-2.jpg');
});

test('after: null/blank number falls back to first 8 safe chars of jobId', () => {
  assert.equal(afterPhotoFileName(null, 'abcdef1234567890', 1), 'abcdef12AFT-1.jpg');
  assert.equal(afterPhotoFileName(undefined, 'abcdef1234567890', 1), 'abcdef12AFT-1.jpg');
  assert.equal(afterPhotoFileName('   ', 'abcdef1234567890', 1), 'abcdef12AFT-1.jpg');
  assert.equal(afterPhotoFileName(null, 'ab-cd-ef-1234', 1), 'ab-cd-efAFT-1.jpg');
});

test('after: unsafe characters are stripped', () => {
  assert.equal(afterPhotoFileName('1/2 .3', 'id', 1), '123AFT-1.jpg');
  assert.equal(afterPhotoFileName('A#b$', 'id', 3), 'AbAFT-3.jpg');
});

test('after: slot parses from name and path', () => {
  assert.equal(afterPhotoSlot('10AFT-4.jpg'), 4);
  assert.equal(afterPhotoSlot('job-photos/org/job/10AFT-3.jpg'), 3);
  assert.equal(afterPhotoSlot('org\\job\\10AFT-5.jpg'), 5);
  assert.equal(afterPhotoSlot('10BEF-4.jpg'), null);
  assert.equal(afterPhotoSlot('other.jpg'), null);
  assert.equal(afterPhotoSlot('10AFT-7.jpg'), null);
  assert.equal(afterPhotoSlot(''), null);
});

test('nextFreeAfterSlot fills gaps, starts at 1, null when full, ignores BEF', () => {
  assert.equal(nextFreeAfterSlot([]), 1);
  assert.equal(nextFreeAfterSlot(['10AFT-1.jpg', 'x/10AFT-3.jpg']), 2);
  assert.equal(nextFreeAfterSlot(['junk.jpg']), 1);
  assert.equal(nextFreeAfterSlot(['10BEF-1.jpg', '10BEF-2.jpg']), 1);
  const full = [1, 2, 3, 4, 5, 6].map((i) => `10AFT-${i}.jpg`);
  assert.equal(nextFreeAfterSlot(full), null);
  assert.equal(nextFreeAfterSlot(full.slice(0, 5)), 6);
});
