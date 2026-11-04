import test from 'node:test';
import assert from 'node:assert/strict';

import { removeStoredFile } from './storage-remove';

const bucket = (error: unknown, seen: string[][] = []) => ({
  remove: async (paths: string[]) => {
    seen.push(paths);
    return { error };
  },
});

test('a photo file is removed by its path', async () => {
  const seen: string[][] = [];
  await removeStoredFile(bucket(null, seen), 'org/job/p1.jpg');
  assert.deepEqual(seen, [['org/job/p1.jpg']]);
});

test('no path means nothing to remove', async () => {
  const seen: string[][] = [];
  await removeStoredFile(bucket(null, seen), null);
  assert.deepEqual(seen, []);
});

test('a dropped connection during the remove is thrown so the delete is sent again', async () => {
  const drop = { name: 'StorageUnknownError', message: 'TypeError: Network request failed' };
  await assert.rejects(removeStoredFile(bucket(drop), 'a.jpg'), (e: unknown) => e === drop);
  await assert.rejects(removeStoredFile(bucket({ status: 401, message: 'JWT expired' }), 'a.jpg'));
});

test('any other storage failure is ignored, as before', async () => {
  await removeStoredFile(bucket({ status: 404, message: 'Object not found' }), 'a.jpg');
});
