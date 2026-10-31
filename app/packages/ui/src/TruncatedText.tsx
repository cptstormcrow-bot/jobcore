import React from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { Text, type TextProps } from './Text';
import { PayrollButton } from './PayrollButton';
import { colors, spacing, typography } from './tokens';

// Truncation detection uses a hidden measuring copy: the same Text with the same style but no
// numberOfLines, absolutely positioned and invisible. If its laid-out height exceeds the visible
// one-line Text's height, the visible text is being cut off, so it becomes tappable and opens a
// popup with the full text.

export type TruncatedTextProps = Omit<TextProps, 'numberOfLines' | 'ellipsizeMode' | 'children' | 'style'> & {
  children: string;
  style?: StyleProp<TextStyle>;
  popupTitle?: string;
  /** Set false inside a pressable parent so a tap reaches the parent; the parent then drives the popup via open/onClose. */
  tappable?: boolean;
  open?: boolean;
  onClose?: () => void;
};

export function TruncatedText({ children, style, popupTitle, tappable = true, open: openProp, onClose, ...rest }: TruncatedTextProps) {
  const [visibleHeight, setVisibleHeight] = React.useState(0);
  const [hiddenHeight, setHiddenHeight] = React.useState(0);
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    if (!v) onClose?.();
  };

  const truncated = visibleHeight > 0 && hiddenHeight > 0 && hiddenHeight > visibleHeight + 1;

  const visible = (
    <Text
      {...rest}
      style={style}
      numberOfLines={1}
      ellipsizeMode="tail"
      onLayout={(e) => setVisibleHeight(e.nativeEvent.layout.height)}
    >
      {children}
    </Text>
  );

  return (
    <View style={styles.container}>
      {truncated && tappable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={children}
          accessibilityHint="Shows the complete text"
          onPress={() => setOpen(true)}
        >
          {visible}
        </Pressable>
      ) : (
        visible
      )}
      <View style={styles.measure} pointerEvents="none">
      <Text
        {...rest}
        style={style}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setHiddenHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </Text>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => undefined}>
            {popupTitle ? <Text style={styles.title}>{popupTitle}</Text> : null}
            <Text selectable style={styles.body}>{children}</Text>
            <View style={styles.buttonRow}>
              <PayrollButton label="Close" textStyle={{ fontWeight: '700' }} onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.md,
  },
  body: {
    color: colors.text,
    fontSize: typography.size.body,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
