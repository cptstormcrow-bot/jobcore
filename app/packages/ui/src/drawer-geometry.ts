export const DRAWER_SCREEN_GUTTER = 56;
export const DRAWER_MAX_WIDTH = 320;
export const DRAWER_HEADER_HEIGHT = 96;
export const DRAWER_ROW_HEIGHT = 48;

export function drawerWidth(screenW: number): number {
  return Math.max(0, Math.min(screenW - DRAWER_SCREEN_GUTTER, DRAWER_MAX_WIDTH));
}

export type DrawerRowKind = 'action' | 'toggle';

export function dividerBefore(prev: DrawerRowKind | null, kind: DrawerRowKind): boolean {
  return prev === 'action' && kind === 'toggle';
}

export function shouldClaimSwipe(dx: number, dy: number): boolean {
  return dx < -10 && Math.abs(dx) > 1.5 * Math.abs(dy);
}

export function shouldDismiss(dx: number, vx: number, width: number): boolean {
  return dx < 0 && (Math.abs(dx) > 0.35 * width || vx < -0.5);
}

export function clamp01(p: number): number {
  return Math.max(0, Math.min(1, p));
}

export const GLYPH_BAR_LENGTH = 18;
export const GLYPH_BAR_GAP = 6;
export const GLYPH_HEAD_SCALE = 0.55;

export type GlyphBar = {
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scaleX: number;
  opacity: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpBar(a: GlyphBar, b: GlyphBar, t: number): GlyphBar {
  return {
    translateX: lerp(a.translateX, b.translateX, t),
    translateY: lerp(a.translateY, b.translateY, t),
    rotateDeg: lerp(a.rotateDeg, b.rotateDeg, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    opacity: lerp(a.opacity, b.opacity, t),
  };
}

// React Native applies the transform array [translateX, translateY, rotate, scaleX]
// with scale about the centre first, then rotation about the centre, then translation;
// positive rotate is clockwise on screen (y down).
export function glyphBarTransforms(
  progress: number,
  length = GLYPH_BAR_LENGTH,
  gap = GLYPH_BAR_GAP,
): { top: GlyphBar; middle: GlyphBar; bottom: GlyphBar } {
  const t = clamp01(progress);
  const h = (length * GLYPH_HEAD_SCALE) / 2;
  const c = Math.cos(Math.PI / 4);
  const s = Math.sin(Math.PI / 4);
  const rest: GlyphBar = { translateX: 0, translateY: 0, rotateDeg: 0, scaleX: 1, opacity: 1 };
  const topEnd: GlyphBar = {
    translateX: -length / 2 + h * c,
    translateY: gap - h * s,
    rotateDeg: -45,
    scaleX: GLYPH_HEAD_SCALE,
    opacity: 1,
  };
  const bottomEnd: GlyphBar = {
    translateX: -length / 2 + h * c,
    translateY: h * s - gap,
    rotateDeg: 45,
    scaleX: GLYPH_HEAD_SCALE,
    opacity: 1,
  };
  return {
    top: lerpBar(rest, topEnd, t),
    middle: lerpBar(rest, rest, t),
    bottom: lerpBar(rest, bottomEnd, t),
  };
}
