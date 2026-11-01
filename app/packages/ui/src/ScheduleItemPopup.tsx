/**
 * ScheduleItemPopup - presentational drill-down popup for one calendar item (a scheduled job or a
 * blackout). Shows when / name / address / phone / description. No fetching, no navigation: the
 * screen supplies the detail and handles onOpenJob.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from './tokens';
import { Text } from './Text';
import { PayrollButton } from './PayrollButton';

export type ScheduleItemDetail = {
  kind: 'job' | 'blackout';
  title: string;
  whenLabel: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  openJobId?: string | null;
};

export type ScheduleItemPopupProps = {
  visible: boolean;
  detail: ScheduleItemDetail | null;
  onClose: () => void;
  onOpenJob?: (jobId: string) => void;
};

function show(value: string | null | undefined): string {
  return value && value.trim() ? value : '-';
}

export function ScheduleItemPopup({ visible, detail, onClose, onOpenJob }: ScheduleItemPopupProps) {
  if (!detail) return null;
  const rows: Array<{ label: string; value: string | null | undefined }> = [{ label: 'Name', value: detail.title }];
  if (detail.address !== undefined) rows.push({ label: 'Address', value: detail.address });
  if (detail.phone !== undefined) rows.push({ label: 'Phone', value: detail.phone });
  if (detail.description !== undefined) rows.push({ label: 'Description', value: detail.description });
  const jobId = detail.openJobId;
  const canOpen = detail.kind === 'job' && !!jobId && !!onOpenJob;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}} testID="schedule-item-popup">
          <View
            style={[styles.accent, { backgroundColor: detail.kind === 'job' ? colors.primary : colors.danger }]}
          />
          <View style={styles.body}>
            <Text style={styles.kind}>{detail.kind === 'job' ? 'Job' : 'Blackout'}</Text>
            <Text style={styles.heading}>{detail.whenLabel}</Text>
            {rows.map((r) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text selectable style={styles.rowValue}>
                  {show(r.value)}
                </Text>
              </View>
            ))}
            <View style={styles.footer}>
              {canOpen ? (
                <PayrollButton
                  label="Open job"
                  accessibilityLabel="Open job"
                  testID="schedule-item-popup-open-job"
                  onPress={() => {
                    onClose();
                    onOpenJob?.(jobId as string);
                  }}
                />
              ) : null}
              <PayrollButton
                label="Close"
                accessibilityLabel="Close"
                testID="schedule-item-popup-close"
                onPress={onClose}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  accent: { width: 6 },
  body: { flex: 1, padding: spacing.lg },
  kind: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.label,
    color: colors.textMuted,
  },
  heading: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
    color: colors.text,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: {
    width: 80,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.size.label,
    color: colors.textMuted,
  },
  rowValue: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.label,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
