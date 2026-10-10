import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { GLYPH_BAR_GAP, GLYPH_BAR_LENGTH, glyphBarTransforms, type GlyphBar } from './drawer-geometry';

export type MenuGlyphProps = { progress: Animated.Value; color: string; size?: number };

const BAR_HEIGHT = 2;
const FROM = glyphBarTransforms(0, GLYPH_BAR_LENGTH, GLYPH_BAR_GAP);
const TO = glyphBarTransforms(1, GLYPH_BAR_LENGTH, GLYPH_BAR_GAP);

function lin(progress: Animated.Value, a: number, b: number, unit = '') {
  const fmt = (n: number) => (unit ? `${n}${unit}` : n);
  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fmt(a), fmt(b)] as unknown as number[] | string[],
  });
}

function barStyle(progress: Animated.Value, from: GlyphBar, to: GlyphBar, top: number, left: number) {
  const transform: any[] = [];
  if (from.translateX !== to.translateX) transform.push({ translateX: lin(progress, from.translateX, to.translateX) });
  if (from.translateY !== to.translateY) transform.push({ translateY: lin(progress, from.translateY, to.translateY) });
  if (from.rotateDeg !== to.rotateDeg) transform.push({ rotate: lin(progress, from.rotateDeg, to.rotateDeg, 'deg') });
  if (from.scaleX !== to.scaleX) transform.push({ scaleX: lin(progress, from.scaleX, to.scaleX) });
  return {
    position: 'absolute' as const,
    top,
    left,
    width: GLYPH_BAR_LENGTH,
    height: BAR_HEIGHT,
    borderRadius: 1,
    transform,
    opacity: from.opacity !== to.opacity ? lin(progress, from.opacity, to.opacity) : from.opacity,
  };
}

export function MenuGlyph({ progress, color, size = 24 }: MenuGlyphProps) {
  const bars = useMemo(() => {
    const left = (size - GLYPH_BAR_LENGTH) / 2;
    const mid = (size - BAR_HEIGHT) / 2;
    return {
      top: barStyle(progress, FROM.top, TO.top, mid - GLYPH_BAR_GAP, left),
      middle: barStyle(progress, FROM.middle, TO.middle, mid, left),
      bottom: barStyle(progress, FROM.bottom, TO.bottom, mid + GLYPH_BAR_GAP, left),
    };
  }, [progress, size]);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[bars.top, { backgroundColor: color }]} />
      <Animated.View style={[bars.middle, { backgroundColor: color }]} />
      <Animated.View style={[bars.bottom, { backgroundColor: color }]} />
    </View>
  );
}
