import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, typography } from './tokens';

export function HelpCircle({
  onPress,
  size = 'md',
  testID,
  accessibilityLabel = 'Help',
}: {
  onPress: () => void;
  size?: 'sm' | 'md';
  testID?: string;
  accessibilityLabel?: string;
}) {
  const small = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      testID={testID}
    >
      <View style={[styles.helpCircle, small && styles.helpCircleSm]}>
        <Text style={[styles.helpCircleText, small && styles.helpCircleTextSm]}>?</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  helpCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpCircleSm: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  helpCircleText: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.primary,
  },
  helpCircleTextSm: {
    fontSize: 11,
  },
});
