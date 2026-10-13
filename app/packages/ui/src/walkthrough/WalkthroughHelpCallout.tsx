import React from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { colors, spacing, typography } from '../tokens';

import { useWalkthrough } from './WalkthroughProvider';

export function WalkthroughHelpCallout() {
  const { standaloneStep, dismissHelp } = useWalkthrough();

  if (!standaloneStep) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissHelp}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{standaloneStep.title}</Text>
          <Pressable onPress={dismissHelp} hitSlop={8}>
            <Text style={styles.closeButton}>×</Text>
          </Pressable>
        </View>

        <Text style={styles.body}>{standaloneStep.body}</Text>

        {standaloneStep.whereHint && (
          <Text style={styles.hintText}>{standaloneStep.whereHint}</Text>
        )}

        <Pressable style={styles.dismissButton} onPress={dismissHelp}>
          <Text style={styles.dismissButtonText}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    flexShrink: 1,
  },
  closeButton: {
    color: colors.textMuted,
    fontSize: typography.size.h4,
    paddingHorizontal: spacing.xs,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body * typography.size.body,
    marginBottom: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body * typography.size.body,
    marginBottom: spacing.sm,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dismissButtonText: {
    color: colors.text,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});

export default WalkthroughHelpCallout;
