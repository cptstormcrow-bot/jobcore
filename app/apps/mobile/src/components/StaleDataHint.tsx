// Small plain-language hint shown while a screen is serving saved (cached) data
// that could not be refreshed - offline, or the refresh failed. Hidden when fresh.
import { StyleSheet, View } from 'react-native';
import { colors, spacing, typography, Text } from '@jobcore/ui';
import { useStaleDataSummary } from '../lib/read-cache';
import { staleHintText } from '../lib/stale-hint';

export interface StaleDataHintProps {
  /** Cached query-name prefixes this screen shows (e.g. ['app.jobs.byId']); omit for any. */
  queries?: readonly string[];
}

export function StaleDataHint({ queries }: StaleDataHintProps) {
  const summary = useStaleDataSummary(queries);
  const text = staleHintText(summary);
  if (!text) return null;
  return (
    <View style={styles.wrap} accessibilityRole="text" testID="stale-data-hint">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceAlt },
  text: { fontSize: typography.size.small, color: colors.textLight, textAlign: 'center' },
});
