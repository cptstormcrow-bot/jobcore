import React from 'react';
import { View } from 'react-native';

export type GearGlyphProps = { color: string; holeColor: string; size?: number };

const TOOTH_ANGLES = [0, 45, 90, 135];

/**
 * Settings gear drawn from Views, like MenuGlyph, so no font metrics can clip it.
 * Four full-width bars rotated 45deg apart make the 8 teeth; a disc and a
 * hole the color of the background sit on top.
 */
export function GearGlyph({ color, holeColor, size = 28 }: GearGlyphProps) {
  const tooth = Math.round(size * 0.22);
  const body = Math.round(size * 0.72);
  const hole = Math.round(size * 0.3);
  const centered = (d: number) => ({ position: 'absolute' as const, top: (size - d) / 2, left: (size - d) / 2 });
  return (
    <View style={{ width: size, height: size }}>
      {TOOTH_ANGLES.map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            top: (size - tooth) / 2,
            left: 0,
            width: size,
            height: tooth,
            borderRadius: 1,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
      <View style={[centered(body), { width: body, height: body, borderRadius: body / 2, backgroundColor: color }]} />
      <View style={[centered(hole), { width: hole, height: hole, borderRadius: hole / 2, backgroundColor: holeColor }]} />
    </View>
  );
}
