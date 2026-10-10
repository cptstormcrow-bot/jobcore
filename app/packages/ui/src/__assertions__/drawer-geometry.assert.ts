import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawerWidth,
  dividerBefore,
  shouldClaimSwipe,
  shouldDismiss,
  glyphBarTransforms,
  GLYPH_BAR_LENGTH,
  GLYPH_BAR_GAP,
} from '../drawer-geometry';

test('drawerWidth', () => {
  assert.equal(drawerWidth(360), 304);
  assert.equal(drawerWidth(412), 320);
  assert.equal(drawerWidth(320), 264);
  assert.equal(drawerWidth(50), 0);
});

test('dividerBefore truth table', () => {
  assert.equal(dividerBefore(null, 'action'), false);
  assert.equal(dividerBefore(null, 'toggle'), false);
  assert.equal(dividerBefore('action', 'action'), false);
  assert.equal(dividerBefore('action', 'toggle'), true);
  assert.equal(dividerBefore('toggle', 'toggle'), false);
  assert.equal(dividerBefore('toggle', 'action'), false);
});

test('shouldClaimSwipe', () => {
  assert.equal(shouldClaimSwipe(-20, 5), true);
  assert.equal(shouldClaimSwipe(-20, 20), false);
  assert.equal(shouldClaimSwipe(20, 0), false);
  assert.equal(shouldClaimSwipe(-8, 0), false);
});

test('shouldDismiss', () => {
  assert.equal(shouldDismiss(-120, 0, 300), true);
  assert.equal(shouldDismiss(-50, -0.6, 300), true);
  assert.equal(shouldDismiss(-50, -0.1, 300), false);
  assert.equal(shouldDismiss(50, -0.9, 300), false);
});

const FIELDS = ['translateX', 'translateY', 'rotateDeg', 'scaleX', 'opacity'] as const;

test('glyph progress 0 is identity', () => {
  const g = glyphBarTransforms(0);
  for (const bar of [g.top, g.middle, g.bottom]) {
    assert.deepEqual(
      { ...bar },
      { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, opacity: 1 },
    );
  }
});

test('glyph progress 1 is back arrow', () => {
  const g = glyphBarTransforms(1);
  assert.deepEqual(
    { ...g.middle },
    { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, opacity: 1 },
  );
  assert.equal(g.top.rotateDeg, -45);
  assert.equal(g.bottom.rotateDeg, 45);
  const len = GLYPH_BAR_LENGTH;
  const gap = GLYPH_BAR_GAP;
  const cases = [
    { bar: g.top, cy: -gap },
    { bar: g.bottom, cy: gap },
  ];
  for (const { bar, cy } of cases) {
    const h = (len * bar.scaleX) / 2;
    const th = (bar.rotateDeg * Math.PI) / 180;
    const cx = bar.translateX;
    const cyy = cy + bar.translateY;
    const lx = cx - h * Math.cos(th);
    const ly = cyy - h * Math.sin(th);
    assert.ok(Math.abs(lx - -len / 2) < 1e-9, `lx ${lx}`);
    assert.ok(Math.abs(ly) < 1e-9, `ly ${ly}`);
  }
});

test('glyph clamps progress', () => {
  assert.deepEqual(glyphBarTransforms(-1), glyphBarTransforms(0));
  assert.deepEqual(glyphBarTransforms(2), glyphBarTransforms(1));
});

test('glyph midpoint and finiteness', () => {
  const a = glyphBarTransforms(0);
  const b = glyphBarTransforms(1);
  const m = glyphBarTransforms(0.5);
  for (const k of ['top', 'middle', 'bottom'] as const) {
    for (const f of FIELDS) {
      assert.ok(Math.abs(m[k][f] - (a[k][f] + b[k][f]) / 2) < 1e-12, `${k}.${f}`);
      assert.ok(Number.isFinite(m[k][f]));
      assert.ok(Number.isFinite(a[k][f]));
      assert.ok(Number.isFinite(b[k][f]));
    }
  }
});
