import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from './tokens';
import type { BreadcrumbSegment } from './Breadcrumb';
import type { JobStatus } from '@jobcore/core';
import { getHelpStep, type ScreenKey, type WalkthroughStepId } from './walkthrough/walkthrough-content';
import { useWalkthrough } from './walkthrough/WalkthroughProvider';
import { useAppVersion } from './AppVersionContext';
import { useGlobalOptionsItems } from './GlobalOptionsContext';
import { formatVersionLabel } from './formatVersionLabel';
import { NavDrawer } from './NavDrawer';
import { MenuGlyph } from './MenuGlyph';
import { HelpCircle } from './HelpCircle';
import { DRAWER_ROW_HEIGHT, dividerBefore } from './drawer-geometry';

export type MenuActionItem = {
  id: string;
  label: string;
  kind?: 'action';
  onPress?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
  helpId?: WalkthroughStepId;
  section?: string;
  /** 'danger' renders the label bold red (e.g. Sync while writes are failing). */
  tone?: 'danger';
};
export type MenuToggleItem = {
  id: string;
  label: string;
  kind: 'toggle';
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  isActive?: boolean;
  submenu?: undefined;
  helpId?: WalkthroughStepId;
  section?: string;
};
export type MenuItem = MenuActionItem | MenuToggleItem;

export type AppChromeProps = {
  breadcrumbSegments: BreadcrumbSegment[];
  menuItems: MenuItem[];
  optionsItems?: MenuItem[];
  showBack?: boolean; // default true
  titleBar?: { title: string; subtitle?: string };
  titleBarTone?: 'primary' | 'gold';
  /** custom content rendered inside the title-bar pill instead of title/subtitle */
  titleContent?: ReactNode;
  helpContext?: { screenKey: ScreenKey; jobStatus?: JobStatus };
  gearItems?: MenuActionItem[]; // items for a \u2699 menu at the top-right of the drawer header (opt-in)
  gearTitle?: string; // optional highlighted title row at the top of the gear menu
  compactMenu?: boolean; // tighter drawer rows (opt-in)
  fitMenu?: boolean; // admin-only taller drawer sheet (opt-in)
  logoMenuItems?: MenuActionItem[]; // in-menu logo switcher list (opt-in)
  onLogoPress?: () => void; // logo acts as Back (opt-in)
  onTitlePress?: () => void; // header logo/title press -> overview (opt-in)
  titleBarInset?: number; // px to inset the title-bar pill on both sides (default 0)
};

function MenuRow({
  item,
  depth = 0,
  onLeafPress,
  compact,
  variant = 'sheet',
  onHelp,
}: {
  item: MenuItem;
  depth?: number;
  onLeafPress: (item: MenuItem) => void;
  compact?: boolean;
  variant?: 'sheet' | 'drawer';
  onHelp?: (id: WalkthroughStepId) => void;
}) {
  const drawer = variant === 'drawer';
  const [expanded, setExpanded] = useState(false);
  const hasSubmenu = !!item.submenu && item.submenu.length > 0;
  const pressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(pressAnim, { toValue, duration: 175, useNativeDriver: false }).start();
  };

  const animatedBg = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [item.isActive ? colors.sand : 'transparent', colors.sand],
  });

  return (
    <View>
      <Pressable
        onPress={() => {
          if (item.disabled) return;
          if (item.kind === 'toggle') { item.onToggle(!item.checked); return; }
          if (hasSubmenu) {
            setExpanded((prev) => !prev);
          } else {
            onLeafPress(item);
          }
        }}
        onPressIn={() => {
          if (item.disabled) return;
          animateTo(1);
        }}
        onPressOut={() => {
          if (item.disabled) return;
          if (!item.isActive) animateTo(0);
        }}
        disabled={item.disabled}
        accessibilityRole={item.kind === 'toggle' ? 'switch' : 'button'}
        accessibilityLabel={item.label}
        accessibilityState={{ disabled: item.disabled, selected: item.isActive, checked: item.kind === 'toggle' ? item.checked : undefined }}
      >
        <Animated.View
          style={[
            styles.row,
            { paddingLeft: spacing.md + depth * spacing.md },
            item.isActive && styles.rowActive,
            item.disabled && styles.rowDisabled,
            { backgroundColor: animatedBg },
            compact && styles.rowCompact,
            drawer && styles.rowDrawer,
            drawer && { paddingLeft: spacing.md + depth * spacing.md },
          ]}
        >
          <Text
            style={[
              styles.rowText,
              drawer && styles.rowTextDrawer,
              item.isActive && styles.rowTextActive,
              item.disabled && styles.rowTextDisabled,
              item.kind !== 'toggle' && item.tone === 'danger' && styles.rowTextDanger,
            ]}
          >
            {item.kind === 'toggle' ? (item.checked ? '☑  ' : '☐  ') : ''}{item.label}
            {hasSubmenu ? (expanded ? '  ▾' : '  ▸') : ''}
          </Text>
          {item.helpId ? (
            <View style={{ position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' }}>
              <HelpCircle size="sm" testID={`help-${item.id}`} onPress={() => onHelp?.(item.helpId!)} />
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
      {hasSubmenu && expanded && (
        <View>
          {item.submenu!.map((child) => (
            <MenuRow key={child.id} item={child} depth={depth + 1} onLeafPress={onLeafPress} compact={compact} variant={variant} onHelp={onHelp} />
          ))}
        </View>
      )}
    </View>
  );
}

export function AppChrome({
  breadcrumbSegments,
  menuItems,
  optionsItems,
  showBack = true,
  titleBar,
  titleBarTone = 'primary',
  titleContent,
  helpContext,
  gearItems,
  gearTitle,
  compactMenu,
  logoMenuItems,
  onLogoPress,
  onTitlePress,
  titleBarInset = 0,
}: AppChromeProps): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hMenuOpen, setHMenuOpen] = useState(false);
  const menuProgress = useRef(new Animated.Value(0)).current;
  const [oMenuOpen, setOMenuOpen] = useState(false);
  const [gMenuOpen, setGMenuOpen] = useState(false);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const logoTappable = !!logoMenuItems?.length || !!onLogoPress;
  const handleLogoPress = () => {
    if (logoMenuItems?.length) {
      setLogoMenuOpen((v) => !v);
    } else {
      setHMenuOpen(false);
      onLogoPress?.();
    }
  };
  const appVersion = useAppVersion();
  const wrapTitle = (node: React.ReactElement, fill = false): React.ReactElement =>
    onTitlePress ? (
      <Pressable
        style={fill ? { flex: 1 } : undefined}
        accessibilityRole="button"
        accessibilityLabel="Go to overview"
        onPress={() => {
          setGMenuOpen(false);
          setHMenuOpen(false);
          onTitlePress();
        }}
      >
        {node}
      </Pressable>
    ) : (
      node
    );
  const drawerItems: MenuItem[] = logoMenuOpen && logoMenuItems?.length ? logoMenuItems : menuItems;
  useEffect(() => {
    if (!hMenuOpen) setLogoMenuOpen(false);
  }, [hMenuOpen]);
  const canGoBack = router.canGoBack();
  const { standaloneStep, showHelp, dismissHelp } = useWalkthrough();
  const helpStep = helpContext ? getHelpStep(helpContext.screenKey, helpContext.jobStatus) : undefined;
  const helpId: WalkthroughStepId = helpStep?.id ?? 'help_general';
  const handleHelpPress = (id: WalkthroughStepId) => {
    setHMenuOpen(false);
    setOMenuOpen(false);
    setTimeout(() => showHelp(id), 300);
  };
  const globalOptionsItems = useGlobalOptionsItems();
  const resolvedOptionsItems = [
    { id: 'help', label: 'Help', onPress: () => { setOMenuOpen(false); setTimeout(() => showHelp(helpId), 300); } },
    ...(optionsItems ?? []),
    ...globalOptionsItems,
  ];

  const handleLeafPress = (item: MenuItem) => {
    setHMenuOpen(false);
    if (item.kind !== 'toggle') item.onPress?.();
  };

  const handleOptionPress = (item: MenuItem) => {
    if (item.kind === 'toggle') return; // toggles keep the options modal open
    setOMenuOpen(false);
    item.onPress?.();
  };

  const handleGearPress = (item: MenuActionItem) => {
    setHMenuOpen(false);
    setGMenuOpen(false);
    item.onPress?.();
  };

  const handleBackPress = () => {
    if (!canGoBack) return;
    setHMenuOpen(false);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => setHMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          hitSlop={8}
          style={styles.iconButton}
        >
          <MenuGlyph progress={menuProgress} color={colors.primary} />
        </Pressable>
        {(titleBar || titleContent) && wrapTitle(
          <View style={[styles.titleBar, titleBarTone === 'gold' && styles.titleBarGold, titleBarInset > 0 && { marginHorizontal: titleBarInset }]}>
            {titleContent ? titleContent : titleBar ? (<>
            <Text
              style={[styles.titleBarTitle, titleBarTone === 'gold' && styles.titleBarTextGold]}
              numberOfLines={1}
            >
              {titleBar.title}
            </Text>
            {titleBar.subtitle ? (
              <Text
                style={[styles.titleBarSubtitle, titleBarTone === 'gold' && styles.titleBarTextGold]}
                numberOfLines={1}
              >
                {titleBar.subtitle}
              </Text>
            ) : null}
            </>) : null}
          </View>,
          true
        )}
        <Pressable
          onPress={() => setOMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Options"
          hitSlop={8}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>⋮</Text>
        </Pressable>
      </View>

      <NavDrawer
        visible={hMenuOpen}
        onClose={() => setHMenuOpen(false)}
        progress={menuProgress}
        header={
          <View style={styles.drawerHeaderRow}>
            <View style={styles.drawerSideButton}>
              <HelpCircle onPress={() => handleHelpPress(helpId)} />
            </View>
            <Pressable disabled={!logoTappable} onPress={handleLogoPress} accessibilityRole={logoTappable ? 'button' : undefined} style={styles.drawerWordmarkPress}>
              <Text style={styles.drawerWordmarkText}>JobCore©</Text>
              <Text style={styles.drawerTagline} numberOfLines={1}>now get some work done</Text>
            </Pressable>
            <Pressable
              onPress={() => { setHMenuOpen(false); setTimeout(() => setGMenuOpen(true), 300); }}
              accessibilityRole="button"
              accessibilityLabel="Settings menu"
              hitSlop={8}
              style={styles.drawerSideButton}
            >
              <Text style={styles.gearGlyph}>{'\u2699\uFE0E'}</Text>
            </Pressable>
          </View>
        }
      >
        {showBack && (
          <>
            <Pressable
              onPress={handleBackPress}
              disabled={!canGoBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              accessibilityState={{ disabled: !canGoBack }}
              style={[styles.row, styles.rowDrawer, !canGoBack && styles.rowDisabled]}
            >
              <Text style={[styles.rowText, styles.rowTextDrawer, !canGoBack && styles.rowTextDisabled]}>‹ Back</Text>
            </Pressable>
            <View style={styles.divider} />
          </>
        )}
        {drawerItems.map((item, i) => (
          <React.Fragment key={item.id}>
            {i > 0 && dividerBefore(drawerItems[i - 1]?.kind === 'toggle' ? 'toggle' : 'action', item.kind === 'toggle' ? 'toggle' : 'action') ? (
              <View style={styles.divider} />
            ) : null}
            {item.section !== undefined && item.section !== drawerItems[i - 1]?.section ? (
              <Text style={styles.sectionHeader}>{item.section}</Text>
            ) : null}
            <MenuRow item={item} onLeafPress={handleLeafPress} variant="drawer" onHelp={handleHelpPress} />
          </React.Fragment>
        ))}
      </NavDrawer>

      <Modal visible={oMenuOpen} transparent animationType="fade" onRequestClose={() => setOMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOMenuOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView style={{ maxHeight: '100%' }}>
              {resolvedOptionsItems && resolvedOptionsItems.length > 0 ? (
                resolvedOptionsItems.map((item) => (
                  <MenuRow key={item.id} item={item} onLeafPress={handleOptionPress} variant="drawer" onHelp={handleHelpPress} />
                ))
              ) : (
                <View style={styles.row}>
                  <Text style={[styles.rowText, styles.rowTextDisabled]}>No options available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {true ? (
        <Modal visible={gMenuOpen} transparent animationType="fade" onRequestClose={() => setGMenuOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setGMenuOpen(false)}>
            <View style={[styles.sheet, styles.sheetFramed]}>
              <ScrollView style={{ maxHeight: '100%' }}>
                {true ? (
                  <>
                    <View style={styles.wordmarkRow}>
                      {wrapTitle(
                      <View style={styles.wordmarkChip}>
                        <Text style={styles.wordmarkText}>{gearTitle ?? 'Configuration'}</Text>
                      </View>
                      )}
                    </View>
                    <View style={styles.divider} />
                  </>
                ) : null}
                {(gearItems ?? []).map((item, i) => (
                  <View key={item.id}>
                    {i > 0 ? <View style={styles.gearSeparator} /> : null}
                    <MenuRow item={item} onLeafPress={(g) => handleGearPress(g as MenuActionItem)} compact={compactMenu} variant="drawer" onHelp={handleHelpPress} />
                  </View>
                ))}
                <View style={styles.gearSeparator} />
                <View style={styles.row}>
                  <Text style={[styles.rowText, styles.rowTextDisabled]}>{formatVersionLabel(appVersion)}</Text>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      ) : null}

    </View>
  );
}

export default AppChrome;

const styles = StyleSheet.create({
  container: { width: '100%' },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  iconText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.size.h5,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  // Title pill fills the row between the side buttons; equal top/bottom padding keeps the text vertically centered (JobCore header SOP).
  titleBar: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 14,
    marginHorizontal: 0,
    alignItems: 'center',
  },
  titleBarTitle: {
    fontFamily: typography.fontFamily.headingBold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.white,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  titleBarSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors.white,
  },
  titleBarGold: {
    backgroundColor: colors.sand,
  },
  titleBarTextGold: {
    color: colors.text,
    opacity: 1,
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  wordmarkRow: {
    position: 'relative',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  drawerSideButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerWordmarkPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerWordmarkText: {
    lineHeight: 32,
    textAlign: 'center',
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: '700',
    fontSize: 26,
    color: colors.primary,
  },
  drawerTagline: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    fontFamily: typography.fontFamily.body,
    color: colors.primary,
  },
  gearGlyph: {
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    fontSize: 28,
    lineHeight: 28,
    width: 28,
    height: 28,
    textAlign: 'center',
    includeFontPadding: false,
  },
  wordmarkChip: {
    alignSelf: 'center',
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  wordmarkText: {
    fontFamily: typography.fontFamily.headingBold,
    color: colors.primary,
    fontSize: typography.size.h6,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '60%',
    paddingVertical: spacing.sm,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
  },
  sheetFramed: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  gearSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowCompact: {
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  rowActive: {
    backgroundColor: colors.sand,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 18,
    textAlign: 'center',
    color: colors.text,
  },
  rowTextActive: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: '700',
    color: '#000000',
  },
  rowTextDisabled: {
    color: colors.textMuted,
  },
  rowTextDanger: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: '700',
    color: colors.danger,
  },
  rowDrawer: {
    minHeight: DRAWER_ROW_HEIGHT,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  sectionHeader: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowTextDrawer: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    textAlign: 'left',
  },
});
