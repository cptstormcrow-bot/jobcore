import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allowedEstimateMoves, needsDownstreamWarning, estimateStageFlags } from '../estimateStatus.js';
import type { EstimateStatusValue, EstimateEditorRole } from '../estimateStatus.js';

const ALL: EstimateStatusValue[] = ['draft', 'submitted', 'approved', 'rejected'];

const EXPECT: Record<EstimateEditorRole, Record<EstimateStatusValue, EstimateStatusValue[]>> = {
  admin: {
    draft: ['submitted', 'approved'],
    submitted: ['draft', 'approved', 'rejected'],
    approved: ['draft', 'submitted'],
    rejected: ['draft', 'submitted'],
  },
  tech: { draft: ['submitted'], submitted: ['draft'], approved: [], rejected: [] },
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

test('admin reject rules', () => {
  assert.ok(allowedEstimateMoves('admin', 'submitted').includes('rejected'));
  for (const from of ['draft', 'approved', 'rejected'] as const) {
    assert.ok(!allowedEstimateMoves('admin', from).includes('rejected'), `admin ${from}->rejected`);
  }
  assert.ok(allowedEstimateMoves('admin', 'rejected').includes('draft'));
  assert.ok(allowedEstimateMoves('admin', 'rejected').includes('submitted'));
  assert.ok(!allowedEstimateMoves('admin', 'rejected').includes('approved'));
});

test('tech never gets rejected and has no moves from approved/rejected', () => {
  for (const from of ALL) {
    assert.ok(!allowedEstimateMoves('tech', from).includes('rejected'), `tech ${from}`);
  }
  assert.deepEqual(allowedEstimateMoves('tech', 'approved'), []);
  assert.deepEqual(allowedEstimateMoves('tech', 'rejected'), []);
});

test('estimateStageFlags', () => {
  const none = { estimateComplete: false, approvalComplete: false, rejected: false };
  assert.deepEqual(estimateStageFlags(null), none);
  assert.deepEqual(estimateStageFlags(undefined), none);
  assert.deepEqual(estimateStageFlags('draft'), none);
  assert.deepEqual(estimateStageFlags('submitted'), { estimateComplete: true, approvalComplete: false, rejected: false });
  assert.deepEqual(estimateStageFlags('approved'), { estimateComplete: true, approvalComplete: true, rejected: false });
  assert.deepEqual(estimateStageFlags('rejected'), { estimateComplete: false, approvalComplete: false, rejected: true });
});

test('needsDownstreamWarning over all 16 pairs', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const want = from === 'approved' && (to === 'draft' || to === 'submitted' || to === 'rejected');
      assert.equal(needsDownstreamWarning(from, to), want, `${from}->${to}`);
    }
  }
});

test('returned arrays are fresh copies', () => {
  const a = allowedEstimateMoves('admin', 'draft');
  a.push('rejected');
  a.length = 0;
  assert.deepEqual(allowedEstimateMoves('admin', 'draft'), ['submitted', 'approved']);
});
