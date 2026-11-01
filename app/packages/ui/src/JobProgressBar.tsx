// JobProgressBar — 15-stage job progress dots in two rows (8 + 7), with a 4px connector
// line colored like the lit dot to its right (gray when that dot is not reached), plus a "Next Steps:" line
// with a "?" that opens a compact dot legend.
// Plain react-native primitives only, so it renders on web and Android.
import React, { useState } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import type { StageResult, StageState } from '@jobcore/core';
import { yellowReasonText } from '@jobcore/core';
import { Text } from './Text';
import { HelpCircle } from './HelpCircle';
import { PayrollButton } from './PayrollButton';
import { colors, radius, spacing, typography } from './tokens';

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

const LEGEND: ReadonlyArray<{ state: StageState; text: string }> = [
  { state: 'gray', text: 'Not reached yet' },
  { state: 'green', text: 'Done' },
  { state: 'yellow', text: 'Needs review: an earlier step changed, info is missing, or it is under way' },
  { state: 'red', text: 'Incomplete: a later step is done, so redo this one' },
];
const SHARED_MENU = [
  'Prem available and Complete Prem share the Prelim menu item.',
  'Estimate and Approval share the Estimate menu item.',
  'Lead, Photos and History have no menu item.',
  'Prem, Estimate, Approval, Contact, Start and Complete stay green once done.',
];

export function JobProgressBar({ stages, states, nextStep, onStagePress, disabledKeys, testID }: JobProgressBarProps) {
  const [legendOpen, setLegendOpen] = useState(false);
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
        const result = states[i];
        const why = state === 'yellow' && result ? yellowReasonText(result) : '';
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
            accessibilityLabel={`${stage.label}, ${STATE_WORD[state]}${why ? `, ${why}` : ''}`}
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
      <View style={styles.nextRow}>
        <Text style={styles.next} numberOfLines={1}>{nextStep}</Text>
        <HelpCircle
          size="sm"
          onPress={() => setLegendOpen(true)}
          accessibilityLabel="What the timeline dots mean"
          testID={testID ? `${testID}-legend-open` : 'job-progress-legend-open'}
        />
      </View>
      <Modal visible={legendOpen} transparent animationType="fade" onRequestClose={() => setLegendOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setLegendOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}} testID="job-progress-legend">
            <Text style={styles.legendTitle}>Timeline dots</Text>
            {LEGEND.map((l) => (
              <View key={l.state} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: STATE_COLOR[l.state] }]} />
                <Text style={styles.legendText}>{l.text}</Text>
              </View>
            ))}
            {SHARED_MENU.map((t) => (
              <Text key={t} style={styles.legendNote}>{t}</Text>
            ))}
            <View style={styles.legendFooter}>
              <PayrollButton label="Close" accessibilityLabel="Close" testID="job-progress-legend-close" onPress={() => setLegendOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xs, paddingTop: 0, paddingBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // flex:1 cells keep a 44px minimum tap target in both directions.
  cell: { flex: 1, minWidth: 44, minHeight: 30, alignItems: 'center', justifyContent: 'flex-start' },
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
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  next: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 1,
    fontSize: typography.size.small,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
  },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: spacing.md,
  },
  legendTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1, fontSize: typography.size.small, color: colors.text, fontFamily: typography.fontFamily.body },
  legendNote: {
    fontSize: typography.size.small,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.xs,
  },
  legendFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
});
