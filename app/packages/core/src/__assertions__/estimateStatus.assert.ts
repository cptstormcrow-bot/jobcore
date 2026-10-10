import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allowedEstimateMoves, needsDownstreamWarning } from '../estimateStatus.js';
import type { EstimateStatusValue, EstimateEditorRole } from '../estimateStatus.js';

const ALL: EstimateStatusValue[] = ['draft', 'submitted', 'approved', 'rejected'];

const EXPECT: Record<EstimateEditorRole, Record<EstimateStatusValue, EstimateStatusValue[]>> = {
  admin: {
    draft: ['submitted', 'approved'],
    submitted: ['draft', 'approved'],
    approved: ['draft', 'submitted'],
    rejected: ['draft', 'submitted', 'approved'],
  },
  tech: { draft: ['submitted'], submitted: ['draft'], approved: [], rejected: [] },
};

test('allowedEstimateMoves full matrix', () => {
  for (const role of ['admin', 'tech'] as const) {
    for (const from of ALL) {
      const r = allowedEstimateMoves(role, from);
      assert.deepEqual(r, EXPECT[role][from], `${role}/${from}`);
      assert.ok(!r.includes(from));
      assert.ok(!r.includes('rejected'));
    }
  }
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
