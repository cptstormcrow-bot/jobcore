import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button, colors, spacing, typography } from '@jobcore/ui';

import { useWalkthrough } from './WalkthroughProvider';
import { WALKTHROUGH_STEPS } from './walkthrough-content';

export function WalkthroughOverlay() {
  const { isOpen, currentStep, currentIndex, next, prev, skip, finish } = useWalkthrough();

  if (!isOpen || !currentStep) {
    return null;
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === WALKTHROUGH_STEPS.length - 1;
  const isInfo = currentStep.kind === 'info';

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={skip}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{currentStep.title}</Text>

          <Text style={styles.body}>{currentStep.body}</Text>

          {!isInfo && currentStep.whereScreen && (
            <View style={styles.hintBox}>
              <Text style={styles.hintLabel}>{currentStep.whereScreen}</Text>
              {currentStep.whereHint && (
                <Text style={styles.hintText}>{currentStep.whereHint}</Text>
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button label="Skip" variant="outline" onPress={skip} />
            <View style={styles.buttonRowRight}>
              {!isInfo && !isFirst && (
                <Button label="Back" variant="outline" onPress={prev} />
              )}
              {isInfo || isLast ? (
                <Button label="Finish" variant="primary" onPress={finish} />
              ) : (
                <Button label="Next" variant="primary" onPress={next} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  container: {
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
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body * typography.size.body,
    marginBottom: spacing.md,
  },
  hintBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  hintLabel: {
    color: colors.text,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body * typography.size.body,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonRowRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

export default WalkthroughOverlay;
