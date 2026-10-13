// JobProgressBar — 15-stage job progress dots in two rows (8 + 7), with a 4px connector
// line colored like the lit dot to its right (gray when that dot is not reached), plus a "Next Steps:" line.
// Plain react-native primitives only, so it renders on web and Android.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import type { StageResult, StageState } from '@jobcore/core';
import { Text } from './Text';
import { colors, spacing, typography } from './tokens';

export type JobProgressBarProps = {
  stages: ReadonlyArray<{ key: string; label: string }>;
  states: ReadonlyArray<StageResult>;
  nextStep: string;
  onStagePress?: (key: string) => void;
  disabledKeys?: string[];
  testID?: string;
};

const ROW_SPLIT = 8;
const DOT = 18;
const STATE_COLOR: Record<StageState, string> = {
  gray: colors.textMuted,
  green: colors.success,
  yellow: colors.warning,
  red: colors.danger,
};
const STATE_WORD: Record<StageState, string> = {
  gray: 'not reached',
  green: 'complete',
  yellow: 'needs review',
  red: 'incomplete',
};

export function JobProgressBar({ stages, states, nextStep, onStagePress, disabledKeys, testID }: JobProgressBarProps) {
  const stateAt = (i: number): StageState => states[i]?.state ?? 'gray';
  // A connector takes the color of the dot on its right: that dot's state color when lit, border gray when not reached.
  const lineColor = (toIndex: number) => (stateAt(toIndex) === 'gray' ? colors.border : STATE_COLOR[stateAt(toIndex)]);

  const renderRow = (from: number, to: number) => (
    <View style={styles.row}>
      {stages.slice(from, to).map((stage, k) => {
        const i = from + k;
        const state = stateAt(i);
        const disabled = !!disabledKeys?.includes(stage.key);
        const tappable = !!onStagePress && (state === 'green' || state === 'yellow' || state === 'red');
        const content = (
          <>
            <View style={styles.dotLine}>
              <View style={[styles.half, i > 0 && { backgroundColor: lineColor(i) }]} />
              <View style={[styles.dot, { backgroundColor: STATE_COLOR[state] }]} />
              <View style={[styles.half, i < stages.length - 1 && { backgroundColor: lineColor(i + 1) }]} />
            </View>
            <Text style={styles.label}>{stage.label}</Text>
          </>
        );
        if (!tappable) {
          return (
            <View key={stage.key} style={[styles.cell, disabled && styles.disabled]}>
              {content}
            </View>
          );
        }
        return (
          <Pressable
            key={stage.key}
            onPress={() => onStagePress?.(stage.key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${stage.label}, ${STATE_WORD[state]}`}
            accessibilityState={{ disabled }}
            style={[styles.cell, disabled && styles.disabled]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View testID={testID} style={styles.wrap}>
      {renderRow(0, ROW_SPLIT)}
      {renderRow(ROW_SPLIT, stages.length)}
      {nextStep ? <Text style={styles.next}>{nextStep}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // flex:1 cells keep a 44px minimum tap target in both directions.
  cell: { flex: 1, minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'flex-start' },
  disabled: { opacity: 0.4 },
  dotLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 20 },
  half: { flex: 1, height: 4 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  label: {
    fontSize: typography.size.detail,
    color: colors.textLight,
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
  },
  next: {
    marginTop: 2,
    fontSize: typography.size.small,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
  },
});
