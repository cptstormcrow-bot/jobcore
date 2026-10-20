import { createElement } from 'react';
import { Pressable, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from './tokens';

export const SAND_BG = colors.sand;
export const SAND_TEXT = '#000';

export const sandButtonStyle = {
  backgroundColor: SAND_BG,
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 6,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export const sandButtonTextStyle = {
  color: SAND_TEXT,
  fontSize: 14,
  fontWeight: '700',
  textAlign: 'center',
  includeFontPadding: false,
  textAlignVertical: 'center',
} as const;

export interface SandButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The JobCore "Payroll" button style - a standing SOP. This is the only button style for
 * in-screen action buttons: label centred on both axes, about 27px tall. Never inline a
 * one-off button or a local copy. `Button` (packages/ui/src/Button.tsx) now carries this same
 * Payroll look (same padding, 14px label, radius 6), so both are valid; SandButton adds the `selected` and `testID` extras. Use `selected` for a picker/toggle row (mirrors DefaultTabBar).
 */
export function SandButton({ label, onPress, disabled, selected, testID, accessibilityLabel, style }: SandButtonProps) {
  const hasSelected = selected !== undefined;
  const inactive = !!disabled || selected === false;
  return createElement(
    Pressable,
    {
      onPress: disabled ? undefined : onPress,
      disabled,
      hitSlop: { top: 6, bottom: 6, left: 3, right: 3 },
      accessibilityRole: 'button',
      accessibilityLabel: accessibilityLabel ?? label,
      accessibilityState: { disabled: !!disabled, selected: selected === true },
      testID,
      style: [
        sandButtonStyle,
        hasSelected
          ? { borderBottomWidth: 2, borderBottomColor: selected ? '#2563eb' : 'transparent' }
          : null,
        inactive ? { backgroundColor: colors.sandInactive } : null,
        style,
      ],
    },
    createElement(
      Text,
      { style: [sandButtonTextStyle, selected === false ? { fontWeight: '400' } : null] },
      label,
    ),
  );
}
