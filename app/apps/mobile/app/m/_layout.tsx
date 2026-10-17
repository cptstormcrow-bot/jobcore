import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { colors, spacing, typography } from '@jobcore/ui';

// G6: module screens (#0011 Calendar, #0023 Reports) drop the Back button, so a
// bottom tab bar keeps a visible way out. Mirrors the (tabs) bar: Calendar | Jobs.
const TABS: { label: string; href: string; testID: string }[] = [
  { label: 'Calendar', href: '/calendar', testID: 'module-tab-calendar' },
  { label: 'Jobs', href: '/jobs', testID: 'module-tab-jobs' },
];

export default function ModuleLayout() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Slot />
      </View>
      <View style={styles.bar} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.href}
            accessibilityRole="tab"
            testID={t.testID}
            style={styles.tab}
            onPress={() => router.push(t.href as never)}
          >
            <Text style={styles.label}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  body: { flex: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.textMuted,
    backgroundColor: colors.white,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  label: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
});
