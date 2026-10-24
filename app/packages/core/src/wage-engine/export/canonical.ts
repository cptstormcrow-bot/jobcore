import type { CanonicalPayrollExport, IsoDate, RunLine } from '../types.js';
import { parseIsoDate } from '../periods.js';

/**
 * Format-neutral canonical payroll export. Pure data: no I/O, no clock, no
 * Node built-ins (this code ships to Hermes on a phone). Every formatter
 * (CSV, QBO journal, IIF) consumes the document built here.
 */

export interface CanonicalExportInput {
  batchId: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  lines: RunLine[];
}

export interface CanonicalTotals {
  regularMin: number;
  otMin: number;
  dtMin: number;
  grossCents: number;
  reimbursementCents: number;
  bonusCents: number;
  totalCents: number;
}

function assertNonNegInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer, got ${value}`);
  }
}

/** Plain code-unit ordering by employeeName then userId (no locale). */
function compareLines(a: RunLine, b: RunLine): number {
  if (a.employeeName < b.employeeName) return -1;
  if (a.employeeName > b.employeeName) return 1;
  if (a.userId < b.userId) return -1;
  if (a.userId > b.userId) return 1;
  return 0;
}

function copyLine(l: RunLine): RunLine {
  return {
    userId: l.userId,
    employeeName: l.employeeName,
    regularMin: l.regularMin,
    otMin: l.otMin,
    dtMin: l.dtMin,
    segments: l.segments.map((s) => ({
      hourlyRateCents: s.hourlyRateCents,
      regularMin: s.regularMin,
      otMin: s.otMin,
      dtMin: s.dtMin,
    })),
    grossCents: l.grossCents,
    reimbursementCents: l.reimbursementCents,
    ...((l.bonusCents ?? 0) > 0 ? { bonusCents: l.bonusCents } : {}),
    totalCents: l.totalCents,
  };
}

function sortedCopy(lines: RunLine[]): RunLine[] {
  return lines.map(copyLine).sort(compareLines);
}

/** cyrb53 string hash (Math.imul based, 53-bit result). */
function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Stable hash of period + sorted lines; batchId is deliberately excluded. 14 lowercase hex chars. */
export function canonicalSourceHash(periodStart: IsoDate, periodEnd: IsoDate, lines: RunLine[]): string {
  const sorted = sortedCopy(lines);
  const json = JSON.stringify([
    periodStart,
    periodEnd,
    sorted.map((l) => [
      l.userId,
      l.employeeName,
      l.regularMin,
      l.otMin,
      l.dtMin,
      l.segments.map((s) => [s.hourlyRateCents, s.regularMin, s.otMin, s.dtMin]),
      l.grossCents,
      l.reimbursementCents,
      // appended only when present so hashes of bonus-free runs are unchanged
      ...((l.bonusCents ?? 0) > 0 ? [l.bonusCents] : []),
      l.totalCents,
    ]),
  ]);
  return cyrb53(json, 0).toString(16).padStart(14, '0');
}

function validateLine(l: RunLine): void {
  if (typeof l.userId !== 'string' || l.userId === '') {
    throw new RangeError(`line userId must be non-empty, got '${l.userId}'`);
  }
  const who = `line ${l.userId}`;
  assertNonNegInt(l.regularMin, `${who} regularMin`);
  assertNonNegInt(l.otMin, `${who} otMin`);
  assertNonNegInt(l.dtMin, `${who} dtMin`);
  assertNonNegInt(l.grossCents, `${who} grossCents`);
  assertNonNegInt(l.reimbursementCents, `${who} reimbursementCents`);
  assertNonNegInt(l.bonusCents ?? 0, `${who} bonusCents`);
  assertNonNegInt(l.totalCents, `${who} totalCents`);
  let reg = 0;
  let ot = 0;
  let dt = 0;
  l.segments.forEach((s, i) => {
    assertNonNegInt(s.hourlyRateCents, `${who} segment ${i} hourlyRateCents`);
    assertNonNegInt(s.regularMin, `${who} segment ${i} regularMin`);
    assertNonNegInt(s.otMin, `${who} segment ${i} otMin`);
    assertNonNegInt(s.dtMin, `${who} segment ${i} dtMin`);
    reg += s.regularMin;
    ot += s.otMin;
    dt += s.dtMin;
  });
  if (l.totalCents !== l.grossCents + (l.bonusCents ?? 0) + l.reimbursementCents) {
    throw new RangeError(
      `${who} totalCents ${l.totalCents} != grossCents ${l.grossCents} + bonusCents ${l.bonusCents ?? 0} + reimbursementCents ${l.reimbursementCents}`,
    );
  }
  if (l.regularMin !== reg) throw new RangeError(`${who} regularMin ${l.regularMin} != segment sum ${reg}`);
  if (l.otMin !== ot) throw new RangeError(`${who} otMin ${l.otMin} != segment sum ${ot}`);
  if (l.dtMin !== dt) throw new RangeError(`${who} dtMin ${l.dtMin} != segment sum ${dt}`);
}

/** Validate, deep-copy, sort and hash. Throws RangeError naming the offender. */
export function buildCanonicalExport(input: CanonicalExportInput): CanonicalPayrollExport {
  if (typeof input.batchId !== 'string' || input.batchId === '') {
    throw new RangeError('batchId must be non-empty');
  }
  const start = parseIsoDate(input.periodStart);
  const end = parseIsoDate(input.periodEnd);
  if (start > end) {
    throw new RangeError(`periodStart ${input.periodStart} is after periodEnd ${input.periodEnd}`);
  }
  const seen: Record<string, true> = Object.create(null);
  for (const l of input.lines) {
    validateLine(l);
    if (seen[l.userId]) throw new RangeError(`duplicate userId: ${l.userId}`);
    seen[l.userId] = true;
  }
  const lines = sortedCopy(input.lines);
  return {
    batchId: input.batchId,
    sourceHash: canonicalSourceHash(input.periodStart, input.periodEnd, lines),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    lines,
  };
}

/** Integer cents -> '1234.56' (no separators, no symbol); negative -> '-2.50'. */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`cents must be a safe integer, got ${cents}`);
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs - whole * 100;
  return `${cents < 0 ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`;
}

/** Integer minutes -> decimal hours to 2 dp, exact integer math, round half up. */
export function formatHours(minutes: number): string {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a non-negative safe integer, got ${minutes}`);
  }
  const hundredths = Math.floor((200 * minutes + 60) / 120);
  const whole = Math.floor(hundredths / 100);
  return `${whole}.${String(hundredths - whole * 100).padStart(2, '0')}`;
}

export function canonicalTotals(exp: CanonicalPayrollExport): CanonicalTotals {
  const t: CanonicalTotals = { regularMin: 0, otMin: 0, dtMin: 0, grossCents: 0, reimbursementCents: 0, bonusCents: 0, totalCents: 0 };
  for (const l of exp.lines) {
    t.regularMin += l.regularMin;
    t.otMin += l.otMin;
    t.dtMin += l.dtMin;
    t.grossCents += l.grossCents;
    t.reimbursementCents += l.reimbursementCents;
    t.bonusCents += l.bonusCents ?? 0;
    t.totalCents += l.totalCents;
  }
  return t;
}
