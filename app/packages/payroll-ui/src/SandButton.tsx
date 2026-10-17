import { Pressable, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '@jobcore/ui';

export const sandButtonStyle = {
  backgroundColor: colors.sand,
  paddingHorizontal: 12,
  paddingVertical: 6,
  minHeight: 44,
  borderRadius: 6,
} as const;

export const sandButtonTextStyle = { color: '#000', fontWeight: '700' } as const;

export interface SandButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function SandButton({
  label,
  onPress,
  disabled,
  testID,
  style,
  accessibilityLabel,
}: SandButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[sandButtonStyle, disabled ? { backgroundColor: colors.sandInactive } : null, style]}
    >
      <Text style={sandButtonTextStyle}>{label}</Text>
    </Pressable>
  );
}
