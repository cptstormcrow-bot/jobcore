/**
 * Assertions for job-detail screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock
 * (each timestamp used below is a fixed ISO literal, never `Date.now()`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractZip,
  matchServiceAreaByZip,
  seedPlanningFromInvestigation,
  formatElapsed,
  abbreviate,
  type PlanningSeedFields,
} from '../job-detail-helpers';

// --- extractZip ---

test('extractZip: finds a 5-digit zip in a free-form address', () => {
  assert.equal(extractZip('123 Main St, Springfield, IL 62704'), '62704');
});

test('extractZip: prefers the LAST match when multiple zip-like sequences exist', () => {
  assert.equal(extractZip('12345 Main St, Springfield, IL 62704'), '62704');
});

test('extractZip: handles zip+4 by returning only the first 5 digits', () => {
  assert.equal(extractZip('123 Main St, Springfield, IL 62704-1234'), '62704');
});

test('extractZip: returns null when no zip-like sequence is present', () => {
  assert.equal(extractZip('123 Main St, Springfield, IL'), null);
});

test('extractZip: returns null for null/undefined input', () => {
  assert.equal(extractZip(null), null);
  assert.equal(extractZip(undefined), null);
});

// --- matchServiceAreaByZip ---

test('matchServiceAreaByZip: finds the area whose zipCodes contains the zip', () => {
  const areas = [
    { id: 'area-1', zipCodes: ['60601', '60602'] },
    { id: 'area-2', zipCodes: ['62704'] },
  ];
  const result = matchServiceAreaByZip(areas, '62704');
  assert.equal(result?.id, 'area-2');
});

test('matchServiceAreaByZip: returns null when no area matches', () => {
  const areas = [{ id: 'area-1', zipCodes: ['60601'] }];
  assert.equal(matchServiceAreaByZip(areas, '99999'), null);
});

test('matchServiceAreaByZip: returns null when zip is null', () => {
  const areas = [{ id: 'area-1', zipCodes: ['60601'] }];
  assert.equal(matchServiceAreaByZip(areas, null), null);
});

// --- matchServiceAreaByZip: city-name fallback ---

const cityAreas = [
  { id: 'a-sd', name: 'San Diego', zipCodes: ['92101'] },
  { id: 'a-lj', name: 'La Jolla', zipCodes: ['92037'] },
];

test('matchServiceAreaByZip: zip match still wins over city name', () => {
  const r = matchServiceAreaByZip(cityAreas, '92101', '412 Prospect St, La Jolla, CA 92101');
  assert.equal(r?.id, 'a-sd');
});

test('matchServiceAreaByZip: no zip falls back to city name', () => {
  const r = matchServiceAreaByZip(cityAreas, null, '412 Prospect St, La Jolla, CA');
  assert.equal(r?.id, 'a-lj');
});

test('matchServiceAreaByZip: unmapped zip falls back to city name', () => {
  const r = matchServiceAreaByZip(cityAreas, '99999', '412 Prospect St, La Jolla, CA 99999');
  assert.equal(r?.id, 'a-lj');
});

test('matchServiceAreaByZip: no zip and no city match returns null', () => {
  assert.equal(matchServiceAreaByZip(cityAreas, null, '1 Main St, Fresno, CA'), null);
  assert.equal(matchServiceAreaByZip(cityAreas, null, 'La Jollaville Rd'), null);
});

test('matchServiceAreaByZip: city fallback is case-insensitive', () => {
  const r = matchServiceAreaByZip(cityAreas, null, '412 prospect st, LA JOLLA, ca');
  assert.equal(r?.id, 'a-lj');
});

// --- seedPlanningFromInvestigation ---

function makePlanning(overrides: Partial<PlanningSeedFields> = {}): PlanningSeedFields {
  return {
    ingressNotes: null,
    logisticsNotes: null,
    parkingNotes: null,
    stateAssessment: null,
    ...overrides,
  };
}

test('seedPlanningFromInvestigation: fills only null/empty fields from investigation', () => {
  const planning = makePlanning({ parkingNotes: '' });
  const investigation = { ingressNotes: 'via side gate', parkingNotes: 'street only' };

  const result = seedPlanningFromInvestigation(planning, investigation);

  assert.equal(result.ingressNotes, 'via side gate');
  assert.equal(result.parkingNotes, 'street only');
  assert.equal(result.logisticsNotes, null);
  assert.equal(result.stateAssessment, null);
});

test('seedPlanningFromInvestigation: keeps existing non-empty planning fields unchanged', () => {
  const planning = makePlanning({ ingressNotes: 'already set' });
  const investigation = { ingressNotes: 'would overwrite' };

  const result = seedPlanningFromInvestigation(planning, investigation);

  assert.equal(result.ingressNotes, 'already set');
});

test('seedPlanningFromInvestigation: null investigation returns a copy of planning unchanged', () => {
  const planning = makePlanning({ ingressNotes: 'kept' });

  const result = seedPlanningFromInvestigation(planning, null);

  assert.deepEqual(result, planning);
  assert.notEqual(result, planning);
});

// --- formatElapsed ---

test('formatElapsed: formats days and hours for >=1 day elapsed', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');
  assert.equal(formatElapsed('2026-08-08T06:00:00.000Z', now), '2d 6h');
});

test('formatElapsed: formats hours and minutes for >=1 hour elapsed', () => {
  const now = new Date('2026-08-08T12:30:00.000Z');
  assert.equal(formatElapsed('2026-08-08T10:00:00.000Z', now), '2h 30m');
});

test('formatElapsed: formats minutes only for <1 hour elapsed', () => {
  const now = new Date('2026-08-08T12:30:00.000Z');
  assert.equal(formatElapsed('2026-08-08T12:15:00.000Z', now), '15m');
});

test('formatElapsed: clamps negative elapsed time to "0m"', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');
  assert.equal(formatElapsed('2026-08-08T13:00:00.000Z', now), '0m');
});

test('formatElapsed: returns null when fromIso is absent', () => {
  assert.equal(formatElapsed(null), null);
  assert.equal(formatElapsed(undefined), null);
});

// --- abbreviate ---

test('abbreviate: returns the street portion before the first comma', () => {
  assert.equal(abbreviate('123 Main St, Springfield, IL 62704'), '123 Main St');
});

test('abbreviate: truncates with a trailing ellipsis when longer than max', () => {
  assert.equal(abbreviate('1234567890123 Long Street Name, Springfield', 10), '123456789…');
});

test('abbreviate: returns "" for empty/absent input', () => {
  assert.equal(abbreviate(''), '');
  assert.equal(abbreviate(null), '');
  assert.equal(abbreviate(undefined), '');
});
