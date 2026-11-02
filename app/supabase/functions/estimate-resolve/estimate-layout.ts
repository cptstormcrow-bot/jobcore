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

/** Default Fine Print, adapted from the SDAssemblypro provider policies; not legal advice. */
export const DEFAULT_FINE_PRINT_PLACEHOLDER = [
  'Scope of work: We perform only the work listed in this estimate. We will not ask you to pay for extra services, products or parts beyond that scope unless you ask for them.',
  'Change orders: If we find conditions during the job that change the scope or the price, we will explain the change and the reason for it and get your approval before we go on. If you decline, we can finish the original scope at the original price, or cancel the job if the original scope cannot be completed. Travel time, scheduling and items already in the listed scope are never a reason for a price change.',
  'Payment: All payments, refunds and discounts for this job are handled through SD Assembly Pros.',
  'Trip charges: Travel to your home is included in the price. There is no separate trip charge.',
  'Rescheduling and cancellation: Please contact us as early as you can if you need to change or cancel your appointment, and we will offer a new date and time that works for you.',
  'Adult present: A parent, guardian or other adult must be present for the whole visit. We will not work in the home while an unaccompanied minor is inside.',
  'Safety and conduct: Our technicians are background checked. We have zero tolerance for fraudulent, offensive or illegal behavior on the job, and we may stop work if conditions are unsafe.',
  'Photos: We take before and after photos of the work, and may take a photo of the technician on site to verify the visit. Photos are used only for job records and service claims.',
  'Communication: We use your contact details only for this job, never for unrelated marketing.',
  'Guarantee: If the listed work was not completed to your satisfaction, or your property or product was damaged as a direct result of our work, tell us within 90 days of completion. We will review the photos and messages from both sides and work with you on a fair resolution.',
].join('\n\n');

/** Wording earlier builds saved as the default; treated as unset so the new default shows. */
export const LEGACY_FINE_PRINT_PLACEHOLDER =
  '[PLACEHOLDER - Fine Print wording not yet supplied. Replace it with your own text using Edit Fine Print Template. This is not legal advice.]';

/** True when fine print text is blank or still the legacy placeholder. */
export function isUnsetFinePrint(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  return t === '' || t === LEGACY_FINE_PRINT_PLACEHOLDER;
}

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
