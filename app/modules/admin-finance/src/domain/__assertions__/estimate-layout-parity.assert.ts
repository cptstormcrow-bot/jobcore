/**
 * Parity + fixture assertions for the shared estimate layout module. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ESTIMATE_SECTION_ORDER,
  ESTIMATE_LABELS,
  formatMoney,
  lineItemTotal,
  computeTotals,
  materialsOnsiteLabel,
} from '../estimate-layout';

const canonicalPath = fileURLToPath(new URL('../estimate-layout.ts', import.meta.url));
const vendoredPath = fileURLToPath(
  new URL('../../../../../supabase/functions/estimate-resolve/estimate-layout.ts', import.meta.url),
);

test('vendored estimate-layout is byte-identical to canonical', () => {
  const a = readFileSync(canonicalPath);
  const b = readFileSync(vendoredPath);
  assert.equal(a.length, b.length);
  assert.ok(a.equals(b), 'vendored copy differs from canonical');
});

test('section order is pinned', () => {
  assert.deepEqual(
    [...ESTIMATE_SECTION_ORDER],
    ['techs', 'summaryRow', 'estimateLink', 'description', 'contingencies', 'lineItems', 'addButtons', 'finePrint'],
  );
});

test('labels are pinned', () => {
  assert.deepEqual({ ...ESTIMATE_LABELS }, {
    estimate: 'Estimate',
    totalCost: 'Total Cost',
    materialsOnsite: 'Materials Onsite?',
    trackingNumber: 'Tracking number',
    estimateLink: 'Estimate link',
    description: 'Description',
    contingencies: 'Contingencies - what if?',
    lineItems: 'Line Items',
    tasks: 'Tasks',
    addManual: 'Add Manual',
    lookupPriceSheet: 'Lookup Price Sheet',
    finePrint: 'Fine Print',
    linkAfterSubmit: 'Available after Submit',
    pdfDelivery: 'PDF delivery',
  });
});

test('formatMoney', () => {
  assert.equal(formatMoney(1234.5), '$1,234.50');
  assert.equal(formatMoney(-5), '-$5.00');
  assert.equal(formatMoney(NaN), '$0.00');
  assert.equal(formatMoney(0), '$0.00');
});

test('lineItemTotal rounds to cents', () => {
  assert.equal(lineItemTotal({ quantity: 3, unitCost: 1.005 }), 3.01);
  assert.equal(lineItemTotal({ quantity: 2, unitCost: 10.25 }), 20.5);
});

const totalsLines = [{ quantity: 2, unitCost: 10.25 }, { quantity: 1, unitCost: 5 }];

test('computeTotals: an applied contingency adds to total', () => {
  const t = computeTotals(totalsLines, [{ description: 'a', price: 100, applies: true }]);
  assert.deepEqual(t, { subtotal: 25.5, contingencyTotal: 100, total: 125.5 });
});

test('computeTotals: an unapplied contingency adds nothing', () => {
  const t = computeTotals(totalsLines, [{ description: 'a', price: 100, applies: false }]);
  assert.deepEqual(t, { subtotal: 25.5, contingencyTotal: 0, total: 25.5 });
});

test('computeTotals: a legacy contingency with no applies field adds nothing', () => {
  const t = computeTotals(totalsLines, [{ description: 'a', price: 100 }]);
  assert.deepEqual(t, { subtotal: 25.5, contingencyTotal: 0, total: 25.5 });
});

test('computeTotals: an applied contingency with a null price adds 0', () => {
  const t = computeTotals(totalsLines, [{ description: 'a', price: null, applies: true }]);
  assert.deepEqual(t, { subtotal: 25.5, contingencyTotal: 0, total: 25.5 });
});

test('materialsOnsiteLabel', () => {
  assert.equal(materialsOnsiteLabel(true), 'Yes');
  assert.equal(materialsOnsiteLabel(false), 'No');
});
