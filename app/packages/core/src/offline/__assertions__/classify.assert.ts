import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyReplayError } from '../replay.js';

test('classify: network branches', () => {
  assert.equal(classifyReplayError({ name: 'TypeError', message: 'Failed to fetch' }), 'network');
  assert.equal(classifyReplayError({ name: 'TypeError', message: 'Network request failed' }), 'network');
  assert.equal(classifyReplayError({ name: 'AuthRetryableFetchError' }), 'network');
  assert.equal(classifyReplayError({ status: 0 }), 'network');
  assert.equal(classifyReplayError({ status: 503 }), 'network');
  assert.equal(classifyReplayError({ status: '502' }), 'network');
  assert.equal(classifyReplayError({ status: 429 }), 'network');
});

test('classify: auth branches', () => {
  assert.equal(classifyReplayError({ status: 401 }), 'auth');
  assert.equal(classifyReplayError({ code: 'PGRST301' }), 'auth');
  assert.equal(classifyReplayError({ message: 'JWT expired' }), 'auth');
  assert.equal(classifyReplayError(new Error('not authenticated')), 'auth');
});

test('classify: permission branches', () => {
  assert.equal(classifyReplayError({ code: '42501' }), 'permission');
  assert.equal(classifyReplayError({ status: 403 }), 'permission');
});

test('classify: 23505 pkey is duplicate, otherwise permanent', () => {
  assert.equal(
    classifyReplayError({ code: '23505', message: 'duplicate key value violates unique constraint "jobs_pkey"' }),
    'duplicate'
  );
  assert.equal(
    classifyReplayError({ code: '23505', message: 'duplicate key violates unique constraint "jobs_email_key"' }),
    'permanent'
  );
});

test('classify: 23505 on idempotency / client_id replay indexes is duplicate', () => {
  for (const idx of ['job_photos_idempotency_key_idx', 'audit_log_idempotency_key_idx', 'job_contact_log_client_id_key']) {
    assert.equal(
      classifyReplayError({ code: '23505', message: `duplicate key value violates unique constraint "${idx}"` }),
      'duplicate'
    );
  }
});

test('classify: permanent branches', () => {
  assert.equal(classifyReplayError({ status: 400 }), 'permanent');
  assert.equal(classifyReplayError({ status: 404 }), 'permanent');
  assert.equal(classifyReplayError({ status: 422 }), 'permanent');
  assert.equal(classifyReplayError({ code: '22P02' }), 'permanent');
  assert.equal(classifyReplayError({ code: '23503' }), 'permanent');
  assert.equal(classifyReplayError({ code: '42P01' }), 'permanent');
  assert.equal(classifyReplayError({ code: 'PGRST116' }), 'permanent');
});

test('classify: unknown fallthrough, any thrown value', () => {
  assert.equal(classifyReplayError({}), 'unknown');
  assert.equal(classifyReplayError(new Error('boom')), 'unknown');
  assert.equal(classifyReplayError(null), 'unknown');
  assert.equal(classifyReplayError(undefined), 'unknown');
  assert.equal(classifyReplayError('x'), 'unknown');
  assert.equal(classifyReplayError({ code: 12345, status: 'abc' }), 'unknown');
});
