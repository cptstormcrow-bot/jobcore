// Canonical shared estimate layout module.
//
// PURE, import-free TypeScript, portable to Node and Deno. This file is copied
// byte-identical to supabase/functions/estimate-resolve/estimate-layout.ts, so
// never add an import, environment access, or config-dependent syntax here.
//
// Line-item field names mirror JobEstimateLineItem in data/ports.ts
// (kind, description, quantity, unitCost, lineTotal); money is dollars.

/** Minimal structural line item (subset of JobEstimateLineItem). */
export interface EstimateLayoutLineItem {
  kind: 'material' | 'labor' | 'other';
  description: string;
  quantity: number;
  unitCost: number;
}

/** A "what if?" contingency; price may be unset. */
export interface ContingencyItem {
  description: string;
  price: number | null;
  /** true = this row adds its price to the estimate total; absent/false = off (legacy rows). */
  applies?: boolean;
}

/** Top-to-bottom section order of the estimate screen and PDF. */
export const ESTIMATE_SECTION_ORDER = [
  'techs',
  'summaryRow',
  'estimateLink',
  'description',
  'contingencies',
  'lineItems',
  'addButtons',
  'finePrint',
] as const;

/** Exact on-screen labels. */
export const ESTIMATE_LABELS = {
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
} as const;

/** Neutral placeholder boilerplate; not legal advice. */
export const DEFAULT_FINE_PRINT_PLACEHOLDER =
  '[PLACEHOLDER - Fine Print wording not yet supplied. Replace it with your own text using Edit Fine Print Template. This is not legal advice.]';

function roundCents(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Formats dollars as '$1,234.50'; negatives '-$5.00'; non-finite '$0.00'. */
export function formatMoney(n: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '$0.00';
  const cents = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracStr = frac < 10 ? '0' + frac : String(frac);
  const sign = n < 0 && cents > 0 ? '-' : '';
  return sign + '$' + wholeStr + '.' + fracStr;
}

/** quantity * unit cost, rounded to cents. */
export function lineItemTotal(
  item: { quantity: number; unitCost: number },
): number {
  return roundCents(item.quantity * item.unitCost);
}

/**
 * Totals for an estimate. Only contingencies with applies === true are summed
 * into contingencyTotal, and total = subtotal + contingencyTotal.
 */
export function computeTotals(
  lineItems: ReadonlyArray<{ quantity: number; unitCost: number }>,
  contingencies: ReadonlyArray<ContingencyItem>,
): { subtotal: number; contingencyTotal: number; total: number } {
  let sub = 0;
  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    if (li) sub += lineItemTotal(li);
  }
  let cont = 0;
  for (let j = 0; j < contingencies.length; j++) {
    const c = contingencies[j];
    if (!c || c.applies !== true) continue;
    const p = c.price ?? null;
    if (p !== null && isFinite(p)) cont += p;
  }
  const subtotal = roundCents(sub);
  const contingencyTotal = roundCents(cont);
  return { subtotal, contingencyTotal, total: roundCents(subtotal + contingencyTotal) };
}

export function materialsOnsiteLabel(b: boolean): 'Yes' | 'No' {
  return b ? 'Yes' : 'No';
}
