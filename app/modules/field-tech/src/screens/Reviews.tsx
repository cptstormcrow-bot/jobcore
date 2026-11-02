// JobCore screen #0067 - ft-Reviews - Reviews
/**
 * Reviews stub for the field-tech module's `AppChrome` H menu.
 *
 * No Reviews feature exists yet in field-tech; this is a placeholder
 * destination so the menu item resolves to a real screen instead of a
 * dead `onPress`. The title uses `ScreenTitle` at the same size and
 * place as the Jobs tab.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenTitle, colors, spacing, Text, typography } from '@jobcore/ui';

export function Reviews(): React.ReactElement {
  return (
    <View style={styles.container}>
      <ScreenTitle title="Reviews" />
      <Text style={styles.emptyText}>Reviews are coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  emptyText: { fontSize: typography.text.body, color: colors.textMutedDark },
});

export default Reviews;
