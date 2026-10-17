import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jobSubViewFor,
  JOB_ACTION_STAGES,
  type JobSubViewInput,
} from '../screen-numbers/job-subview';
import { resolveScreen, type RegistryEntry } from '../screen-numbers/screen-resolve';

const inp = (o: Partial<JobSubViewInput>): JobSubViewInput => ({
  isCreate: false,
  region: 'details',
  isTechEstimate: false,
  ...o,
});

test('jobSubViewFor table', () => {
  assert.equal(jobSubViewFor(inp({ isCreate: true, region: 'plan' })), undefined);
  assert.equal(jobSubViewFor(inp({ isCreate: true, activeStage: 'paid' })), undefined);
  assert.equal(jobSubViewFor(inp({ region: 'details' })), undefined);
  assert.equal(jobSubViewFor(inp({ region: 'plan' })), 'job:plan');
  assert.equal(jobSubViewFor(inp({ region: 'evisit' })), 'job:prelim');
  assert.equal(jobSubViewFor(inp({ region: 'assign' })), 'job:assign');
  assert.equal(jobSubViewFor(inp({ region: 'schedule' })), 'job:schedule');
  assert.equal(jobSubViewFor(inp({ region: 'estimate', isTechEstimate: false })), 'jobEstimate');
  assert.equal(jobSubViewFor(inp({ region: 'estimate', isTechEstimate: true })), 'jobEstimate');
  assert.equal(jobSubViewFor(inp({ region: 'closeout' })), 'closeOutReview');
  assert.equal(jobSubViewFor(inp({ region: 'bogus' })), undefined);
  for (const s of JOB_ACTION_STAGES) {
    assert.equal(jobSubViewFor(inp({ activeStage: s })), `job:${s}`);
    for (const region of ['details', 'plan', 'evisit', 'assign', 'schedule', 'estimate', 'closeout']) {
      assert.equal(jobSubViewFor(inp({ region, activeStage: s })), `job:${s}`);
    }
  }
});

const JF = 'apps/mobile/app/job/[jobId].tsx';
const AF = 'modules/admin-finance/src/AdminFinanceRoot.tsx';
function e(number: number, key: string, subView?: string, o: Partial<RegistryEntry> = {}): RegistryEntry {
  return { number, key, title: key, route: '/job/[jobId]', file: JF, createdAt: '2026-01-01', ...(subView ? { subView } : {}), ...o };
}
const REG: RegistryEntry[] = [
  e(39, 'job-detail'),
  e(40, 'job-region-assign', 'job:assign'),
  e(41, 'job-region-plan', 'job:plan'),
  e(55, 'af-planning', 'planning', { route: null, file: AF }),
  e(57, 'af-jobEstimate', 'jobEstimate', { file: 'modules/admin-finance/src/screens/JobEstimateScreen.tsx' }),
  e(58, 'job-region-schedule', 'job:schedule'),
  e(59, 'job-region-estimate', 'job:estimate-tech'),
  e(61, 'job-region-evisit', 'job:prelim'),
  e(75, 'job-region-contact', 'job:contact'),
  e(76, 'job-region-arrive', 'job:arrive'),
  e(77, 'job-region-complete', 'job:complete'),
  e(78, 'job-region-paid', 'job:paid'),
  e(18, 'af-closeOutReview', 'closeOutReview', { file: 'modules/admin-finance/src/screens/CloseOutReviewScreen.tsx' }),
  e(70, 'af-shell', undefined, { route: '/m/admin-finance', file: AF }),
];

test('end-to-end resolve', () => {
  const n = (i: Partial<JobSubViewInput>) => resolveScreen('/job/abc', REG, jobSubViewFor(inp(i)))?.number;
  assert.equal(n({ region: 'assign' }), 40);
  assert.equal(n({ region: 'plan' }), 41);
  assert.equal(n({ region: 'estimate', isTechEstimate: false }), 57);
  assert.equal(n({ region: 'schedule' }), 58);
  assert.equal(n({ region: 'estimate', isTechEstimate: true }), 57);
  assert.equal(n({ region: 'evisit' }), 61);
  assert.equal(n({ region: 'closeout' }), 18);
  assert.equal(n({ activeStage: 'contact' }), 75);
  assert.equal(n({ activeStage: 'arrive' }), 76);
  assert.equal(n({ activeStage: 'complete' }), 77);
  assert.equal(n({ activeStage: 'paid' }), 78);
  assert.equal(resolveScreen('/job/abc', REG, undefined)?.number, 39);
  assert.equal(resolveScreen('/job/new', REG, undefined)?.number, 39);
  assert.equal(resolveScreen('/job/abc', REG, null)?.number, 39);
  assert.equal(resolveScreen('/m/admin-finance', REG, 'jobEstimate')?.number, 57);
  assert.equal(resolveScreen('/m/admin-finance', REG, 'planning')?.number, 55);
});
