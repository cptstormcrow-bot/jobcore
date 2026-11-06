// JobProgressBar — 10-stage job progress dots in two rows (5 + 5), with a 4px connector
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
import { TooltipCard } from './BadgeTooltip';
import { colors, radius, spacing, typography } from './tokens';

export type JobProgressBarProps = {
  stages: ReadonlyArray<{ key: string; label: string }>;
  states: ReadonlyArray<StageResult>;
  nextStep: string;
  onStagePress?: (key: string) => void;
  disabledKeys?: string[];
  /** Stage key whose screen is currently in view; its dot renders 20% larger (double breadcrumb with the menu). */
  activeKey?: string;
  testID?: string;
};

const DOT = 18;
const DOT_ACTIVE = DOT * 1.2; // 21.6 - current-screen badge
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
  'Prem available and Complete Prem share the Prem menu item.',
  'The Estimate dot turns green only once the estimate is approved.',
  'Lead and History have no menu item.',
  'A dimmed dot is a step your role cannot open, or one that is waiting on an earlier step.',
  'Prem, Estimate, Contact, Start and Complete stay green once done.',
];

export function JobProgressBar({ stages, states, nextStep, onStagePress, disabledKeys, activeKey, testID }: JobProgressBarProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [tip, setTip] = useState<{ label: string; state: StageState; text: string; why: string; disabled: boolean } | null>(null);
  const stateAt = (i: number): StageState => states[i]?.state ?? 'gray';
  // A connector takes the color of the dot on its right: that dot's state color when lit, border gray when not reached.
  const lineColor = (toIndex: number) => (stateAt(toIndex) === 'gray' ? colors.border : STATE_COLOR[stateAt(toIndex)]);

  // Balanced rows: top gets the extra dot when the count is odd (10 stages: 5 + 5).
  const split = Math.ceil(stages.length / 2);

  const renderRow = (from: number, to: number) => (
    <View style={styles.row}>
      {stages.slice(from, to).map((stage, k) => {
        const i = from + k;
        const state = stateAt(i);
        const disabled = !!disabledKeys?.includes(stage.key);
        // Gray (not started) dots are tappable too, so the next stage can be started from the bar.
        const tappable = !!onStagePress && !disabled;
        const result = states[i];
        const why = state === 'yellow' && result ? yellowReasonText(result) : '';
        const content = (
          <>
            <View style={styles.dotLine}>
              <View style={[styles.half, i > 0 && { backgroundColor: lineColor(i) }]} />
              <View style={[styles.dot, { backgroundColor: STATE_COLOR[state] }, stage.key === activeKey && styles.dotActive]} />
              <View style={[styles.half, i < stages.length - 1 && { backgroundColor: lineColor(i + 1) }]} />
            </View>
            <Text style={styles.label} numberOfLines={1}>{stage.label}</Text>
          </>
        );
        const stateText = LEGEND.find((l) => l.state === state)?.text ?? STATE_WORD[state];
        // Every dot opens its tooltip on press-and-hold, dimmed ones too, so no `disabled` prop here
        // (a disabled Pressable swallows the long-press). A tap only fires on a tappable dot.
        return (
          <Pressable
            key={stage.key}
            onPress={tappable ? () => onStagePress?.(stage.key) : undefined}
            onLongPress={() => setTip({ label: stage.label, state, text: stateText, why, disabled })}
            delayLongPress={350}
            accessibilityRole={tappable ? 'button' : undefined}
            accessibilityLabel={`${stage.label}${stage.key === activeKey ? ', current screen' : ''}, ${STATE_WORD[state]}${why ? `, ${why}` : ''}`}
            accessibilityHint="Press and hold for details"
            accessibilityState={{ disabled }}
            style={[styles.cell, disabled && styles.disabled]}
            testID={`job-progress-dot-${stage.key}`}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View testID={testID} style={styles.wrap}>
      {renderRow(0, split)}
      {renderRow(split, stages.length)}
      <View style={styles.nextRow}>
        <Text style={styles.next} numberOfLines={1}>{nextStep}</Text>
        <HelpCircle
          size="sm"
          onPress={() => setLegendOpen(true)}
          accessibilityLabel="What the timeline dots mean"
          testID={testID ? `${testID}-legend-open` : 'job-progress-legend-open'}
        />
      </View>
      <TooltipCard
        visible={!!tip}
        title={tip ? `${tip.label} step` : ''}
        state={tip ? tip.text : ''}
        detail={tip ? [tip.why, tip.disabled ? 'Your role cannot open this step, or it is waiting on an earlier step.' : ''].filter(Boolean).join(' ') : undefined}
        color={tip ? STATE_COLOR[tip.state] : undefined}
        onClose={() => setTip(null)}
        testID="job-progress-dot-tooltip"
      />
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
  wrap: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  // Cells are sized by their label (flexBasis auto) and then share the spare width, so a long label such as
  // Complete or Estimate is never squeezed into an equal slot and broken mid-word (Jeff 2026-11-05).
  cell: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minWidth: 44, minHeight: 30, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'flex-start' },
  disabled: { opacity: 0.4 },
  dotLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 20 },
  half: { flex: 1, height: 4 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  // Grows from its centre inside the fixed 20px dotLine, so no other dot, connector or row shifts.
  dotActive: { width: DOT_ACTIVE, height: DOT_ACTIVE, borderRadius: DOT_ACTIVE / 2 },
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
    // A touch under the small size so the line sits quieter under the dots.
    fontSize: typography.size.small - 2,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
  },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: spacing.md,
  },
  legendTitle: {
    fontSize: typography.text.title,
    fontWeight: typography.weight.bold,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { flex: 1, fontSize: typography.text.body, color: colors.text, fontFamily: typography.fontFamily.body },
  legendNote: {
    fontSize: typography.text.hint,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.xs,
  },
  legendFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
});
