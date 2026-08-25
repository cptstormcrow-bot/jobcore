// P2e.3a - Job Detail shared canvas. HARD ACCEPTANCE CRITERION: this file imports
// NOTHING from modules/. Module-contributed buttons arrive as the `actions` prop,
// resolved from the registry by the caller (P2e.3b). The JobAction type comes from
// @jobcore/module-sdk (the contract package), never from a module implementation.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Job } from '@jobcore/core';
import type { JobAction } from '@jobcore/module-sdk';
import { colors, spacing, typography, radius } from '@jobcore/ui';
import { JOB_STATUS_COLORS } from '@jobcore/ui';

export interface JobDetailProps {
  job: Job;
  actions?: JobAction[];
  onAction?: (actionId: string) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function JobDetail({ job, actions, onAction }: JobDetailProps) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{`Job #${job.id.slice(-4).toUpperCase()}`}</Text>
      <View style={[styles.statusBar, { backgroundColor: JOB_STATUS_COLORS[job.status] }]} />
      <Text style={styles.status}>{job.status}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Job Info</Text>
        <Row label="Address" value={job.address ?? 'No address'} />
        <Row label="Description" value={job.description ?? 'No description'} />
        <Row label="Scheduled" value={job.scheduledStart ?? 'Unscheduled'} />
        <Row label="Source" value={job.source ?? 'Unknown'} />
        <Row label="Payer" value={job.payer ?? 'Unknown'} />
        <Row label="Assigned tech" value={job.assignedTechId ?? 'Unassigned'} />
      </View>

      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              style={styles.actionButton}
              onPress={() => onAction?.(action.id)}
            >
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md, gap: spacing.md },
  title: {
    fontSize: typography.size.h5,
    lineHeight: typography.size.h5 * typography.lineHeight.heading,
    color: colors.text,
  },
  statusBar: { height: 6, borderRadius: radius.pill },
  status: {
    fontSize: typography.size.h5,
    lineHeight: typography.size.h5 * typography.lineHeight.heading,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.label,
    lineHeight: typography.size.label * typography.lineHeight.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: { gap: spacing.xs },
  rowLabel: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.heading,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    color: colors.text,
  },
  actions: { gap: spacing.sm },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.size.label,
    lineHeight: typography.size.label * typography.lineHeight.body,
    color: colors.white,
  },
});
