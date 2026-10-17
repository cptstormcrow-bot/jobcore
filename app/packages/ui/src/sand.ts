import { createElement } from 'react';
import { Pressable, Text } from 'react-native';

import { colors } from './tokens';

export const SAND_BG = colors.sand;
export const SAND_TEXT = '#000';

export const sandButtonStyle = {
  backgroundColor: SAND_BG,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
  alignItems: 'center',
} as const;

export const sandButtonTextStyle = { color: SAND_TEXT, fontWeight: '700' } as const;

export interface SandButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function SandButton({ label, onPress, disabled, testID, accessibilityLabel }: SandButtonProps) {
  return createElement(
    Pressable,
    {
      onPress: disabled ? undefined : onPress,
      disabled,
      accessibilityRole: 'button',
      accessibilityLabel: accessibilityLabel ?? label,
      accessibilityState: { disabled: !!disabled },
      testID,
      style: [sandButtonStyle, disabled ? { opacity: 0.5 } : null],
    },
    createElement(Text, { style: sandButtonTextStyle }, label),
  );
}
