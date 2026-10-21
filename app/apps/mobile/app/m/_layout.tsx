import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { colors, spacing, typography } from '@jobcore/ui';
import { useSession } from '../../src/lib/session';

// G6: module screens (#0011 Calendar, #0023 Reports) drop the Back button, so a
// bottom tab bar keeps a visible way out. Mirrors the (tabs) bar: Calendar | Jobs.
// Jobs is role-routed (see jobsHref): owner/admin land on #0012, not the #0009 placeholder.
const TABS: { label: string; href: string; testID: string }[] = [
  { label: 'Calendar', href: '/calendar', testID: 'module-tab-calendar' },
  { label: 'Jobs', href: '/jobs', testID: 'module-tab-jobs' },
];

export default function ModuleLayout() {
  const router = useRouter();
  const session = useSession();
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  // #0012 is the 'jobs' sub-view of AdminFinanceRoot (registry route: null), reached by deep link.
  // The ts nonce changes the params on every tap so its effect re-fires when already mounted.
  const hrefFor = (t: { href: string }) =>
    t.href === '/jobs' && (role === 'owner' || role === 'admin')
      ? `/m/admin-finance?view=jobs&ts=${Date.now()}`
      : t.href;
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
            onPress={() => router.push(hrefFor(t) as never)}
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
