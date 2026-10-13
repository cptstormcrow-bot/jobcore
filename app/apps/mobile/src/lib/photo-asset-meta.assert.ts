import test from 'node:test';
import assert from 'node:assert/strict';

import { photoMetaFrom } from './photo-asset-meta';

const JPG = { ext: 'jpg', contentType: 'image/jpeg' };

test('mimeType png', () => {
  assert.deepEqual(photoMetaFrom({ mimeType: 'image/png' }), { ext: 'png', contentType: 'image/png' });
});
test('mimeType wins over fileName', () => {
  assert.deepEqual(photoMetaFrom({ mimeType: 'image/webp', fileName: 'a.png' }), {
    ext: 'webp',
    contentType: 'image/webp',
  });
});
test('fileName .PNG uppercase', () => {
  assert.deepEqual(photoMetaFrom({ fileName: 'IMG.PNG' }), { ext: 'png', contentType: 'image/png' });
});
test('uri with query', () => {
  assert.deepEqual(photoMetaFrom({ uri: 'file:///a/b.heic?x=1#y' }), { ext: 'heic', contentType: 'image/heic' });
});
test('data:image/webp uri', () => {
  assert.deepEqual(photoMetaFrom({ uri: 'data:image/webp;base64,AAAA' }), {
    ext: 'webp',
    contentType: 'image/webp',
  });
});
test('blob uri with no info falls back', () => {
  assert.deepEqual(photoMetaFrom({ uri: 'blob:http://x/abc.png' }), JPG);
});
test('null/undefined fields fall back', () => {
  assert.deepEqual(photoMetaFrom({ mimeType: null, fileName: null, uri: null }), JPG);
  assert.deepEqual(photoMetaFrom({}), JPG);
});
test('jpeg normalises to jpg', () => {
  assert.deepEqual(photoMetaFrom({ mimeType: 'image/jpeg' }), JPG);
  assert.deepEqual(photoMetaFrom({ fileName: 'a.jpeg' }), JPG);
});
test('unknown ext falls back', () => {
  assert.deepEqual(photoMetaFrom({ fileName: 'file.bin' }), JPG);
});
