import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../Text';
import { colors, radius, spacing } from '../tokens';
import { useScreenNumber } from './ScreenNumberContext';
import { resolveScreen } from './screen-resolve';

export function ScreenNumberBadge({ pathname }: { pathname: string }) {
  const { enabled, registry, subView } = useScreenNumber();
  const insets = useSafeAreaInsets();
  if (!enabled) return null;
  const entry = resolveScreen(pathname, registry, subView);
  const label = entry ? '#' + String(entry.number).padStart(4, '0') : '#----';
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: spacing.sm,
        bottom: spacing.sm + insets.bottom,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ color: colors.white, fontSize: 14 }}>{label}</Text>
    </View>
  );
}
