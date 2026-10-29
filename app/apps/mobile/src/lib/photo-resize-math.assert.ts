/** Assertions for photoTargetSize. Runs under `node --experimental-strip-types --test`. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PHOTO_EDGE, photoTargetSize } from './photo-resize-math';

test('landscape larger than max is scaled to 1600 long edge', () => {
  assert.deepEqual(photoTargetSize(4000, 3000), { width: 1600, height: 1200, resize: true });
});

test('portrait larger than max is scaled', () => {
  assert.deepEqual(photoTargetSize(3000, 4000), { width: 1200, height: 1600, resize: true });
});

test('never upscales', () => {
  assert.deepEqual(photoTargetSize(800, 600), { width: 800, height: 600, resize: false });
  assert.equal(photoTargetSize(MAX_PHOTO_EDGE, 10).resize, false);
});

test('extreme aspect keeps minimum 1px', () => {
  assert.deepEqual(photoTargetSize(16000, 1), { width: 1600, height: 1, resize: true });
});

test('invalid dims are left alone', () => {
  assert.equal(photoTargetSize(0, 100).resize, false);
  assert.equal(photoTargetSize(NaN, 100).resize, false);
});
