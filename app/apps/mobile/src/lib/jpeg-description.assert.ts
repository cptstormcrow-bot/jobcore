/**
 * Assertions for readJpegDescription / writeJpegDescription. Runs under
 * `node --experimental-strip-types --test` — pure bytes, no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PHOTO_NOTE_LENGTH, readJpegDescription, writeJpegDescription } from './jpeg-description';

const EXIF_SEG = [0xff, 0xe1, 0x00, 0x0e, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x01, 0x12, 0x00, 0x03, 0x00, 0x06];
const APP0_SEG = [0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46];

function jpeg(...segs: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segs.flat(), 0xff, 0xd9]);
}

function indexOfSeq(hay: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

function foreignXmp(): number[] {
  const hdr = Array.from('http://ns.adobe.com/xap/1.0/\0').map((c) => c.charCodeAt(0));
  const body = Array.from('<x:xmpmeta><dc:title>old</dc:title></x:xmpmeta>').map((c) => c.charCodeAt(0));
  const total = hdr.length + body.length + 2;
  return [0xff, 0xe1, total >> 8, total & 0xff, ...hdr, ...body];
}

test('round trip', () => {
  const out = writeJpegDescription(jpeg(), 'Cracked pipe under sink');
  assert.equal(readJpegDescription(out), 'Cracked pipe under sink');
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);
  assert.equal(out[out.length - 2], 0xff);
  assert.equal(out[out.length - 1], 0xd9);
});

test('replace existing note', () => {
  const a = writeJpegDescription(jpeg(), 'first');
  const b = writeJpegDescription(a, 'second');
  assert.equal(readJpegDescription(b), 'second');
  assert.equal(b.length < a.length + 10, true);
});

test('empty text clears the note', () => {
  const a = writeJpegDescription(jpeg(), 'something');
  const b = writeJpegDescription(a, '');
  assert.equal(readJpegDescription(b), null);
  assert.deepEqual(Array.from(b), Array.from(jpeg()));
});

test('JPEG with no XMP reads null', () => {
  assert.equal(readJpegDescription(jpeg()), null);
  assert.equal(readJpegDescription(jpeg(APP0_SEG, EXIF_SEG)), null);
});

test('existing foreign XMP is replaced', () => {
  const src = jpeg(foreignXmp());
  assert.equal(readJpegDescription(src), null);
  const out = writeJpegDescription(src, 'mine');
  assert.equal(readJpegDescription(out), 'mine');
  assert.equal(indexOfSeq(out, Array.from('dc:title').map((c) => c.charCodeAt(0))), -1);
});

test('Exif orientation segment bytes are kept intact', () => {
  const src = jpeg(APP0_SEG, EXIF_SEG);
  const out = writeJpegDescription(src, 'with exif');
  assert.equal(readJpegDescription(out), 'with exif');
  assert.notEqual(indexOfSeq(out, EXIF_SEG), -1);
  assert.notEqual(indexOfSeq(out, APP0_SEG), -1);
  // clearing returns the original bytes exactly
  assert.deepEqual(Array.from(writeJpegDescription(out, '')), Array.from(src));
});

test('truncated and garbage input return null and never throw', () => {
  const good = writeJpegDescription(jpeg(EXIF_SEG), 'abc');
  for (let n = 0; n < good.length; n++) {
    assert.doesNotThrow(() => readJpegDescription(good.slice(0, n)));
  }
  assert.equal(readJpegDescription(good.slice(0, 10)), null);
  assert.equal(readJpegDescription(new Uint8Array([])), null);
  assert.equal(readJpegDescription(new Uint8Array([1, 2, 3, 4, 5, 6])), null);
  assert.equal(readJpegDescription(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])), null);
});

test('non-ASCII and emoji round trip', () => {
  const t = 'Café ñ 日本語 \u{1F527}\u{1F4A7} done';
  assert.equal(readJpegDescription(writeJpegDescription(jpeg(), t)), t);
});

test('XML special characters are escaped and restored', () => {
  const t = `a & b < c > d "e" 'f' &amp; <x>`;
  const out = writeJpegDescription(jpeg(), t);
  assert.equal(readJpegDescription(out), t);
  assert.equal(indexOfSeq(out, Array.from('<x>').map((c) => c.charCodeAt(0))), -1);
});

test('a 500-char note round-trips', () => {
  const t = 'x'.repeat(MAX_PHOTO_NOTE_LENGTH);
  assert.equal(MAX_PHOTO_NOTE_LENGTH, 500);
  assert.equal(readJpegDescription(writeJpegDescription(jpeg(), t)), t);
});

test('text over 500 chars is truncated, not rejected', () => {
  const t = 'y'.repeat(MAX_PHOTO_NOTE_LENGTH + 80);
  const got = readJpegDescription(writeJpegDescription(jpeg(), t));
  assert.equal(got, 'y'.repeat(MAX_PHOTO_NOTE_LENGTH));
});

test('truncation never splits a surrogate pair', () => {
  const t = 'z'.repeat(MAX_PHOTO_NOTE_LENGTH - 1) + '\u{1F527}';
  const got = readJpegDescription(writeJpegDescription(jpeg(), t)) as string;
  assert.equal(got, 'z'.repeat(MAX_PHOTO_NOTE_LENGTH - 1));
});

test('non-JPEG input makes the writer throw', () => {
  assert.throws(() => writeJpegDescription(new Uint8Array([1, 2, 3, 4]), 'x'));
  assert.throws(() => writeJpegDescription(new Uint8Array([]), 'x'));
});
