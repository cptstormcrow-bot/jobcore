import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allowedEstimateMoves, needsDownstreamWarning, estimateStageFlags } from '../estimateStatus.js';
import type { EstimateStatusValue, EstimateEditorRole } from '../estimateStatus.js';

const ALL: EstimateStatusValue[] = ['draft', 'submitted', 'approved'];

const EXPECT: Record<EstimateEditorRole, Record<EstimateStatusValue, EstimateStatusValue[]>> = {
  admin: {
    draft: ['submitted', 'approved'],
    submitted: ['draft', 'approved'],
    approved: ['draft', 'submitted'],
  },
  tech: { draft: ['submitted'], submitted: ['draft'], approved: [] },
};

test('allowedEstimateMoves full matrix', () => {
  for (const role of ['admin', 'tech'] as const) {
    for (const from of ALL) {
      const r = allowedEstimateMoves(role, from);
      assert.deepEqual(r, EXPECT[role][from], `${role}/${from}`);
      assert.ok(!r.includes(from));
    }
  }
});

test('tech has no moves from approved', () => {
  assert.deepEqual(allowedEstimateMoves('tech', 'approved'), []);
});

test('estimateStageFlags', () => {
  const none = { estimateComplete: false, approvalComplete: false, rejected: false };
  assert.deepEqual(estimateStageFlags(null), none);
  assert.deepEqual(estimateStageFlags(undefined), none);
  assert.deepEqual(estimateStageFlags('draft'), none);
  assert.deepEqual(estimateStageFlags('submitted'), { estimateComplete: true, approvalComplete: false, rejected: false });
  assert.deepEqual(estimateStageFlags('approved'), { estimateComplete: true, approvalComplete: true, rejected: false });
});

test('needsDownstreamWarning over all 16 pairs', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const want = from === 'approved' && (to === 'draft' || to === 'submitted');
      assert.equal(needsDownstreamWarning(from, to), want, `${from}->${to}`);
    }
  }
});

test('returned arrays are fresh copies', () => {
  const a = allowedEstimateMoves('admin', 'draft');
  a.push('approved');
  a.length = 0;
  assert.deepEqual(allowedEstimateMoves('admin', 'draft'), ['submitted', 'approved']);
});
