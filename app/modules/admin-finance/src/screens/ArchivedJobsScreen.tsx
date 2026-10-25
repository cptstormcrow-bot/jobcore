// JobCore screen #0092 - af-archivedJobs - Archived Jobs
// Archived jobs list opened from the Jobs board: one row per job with an Unarchive button, empty state, back button.
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, EmptyState, PayrollButton } from '@jobcore/ui';

export type ArchivedJobRow = { id: string; title: string; subtitle: string | null };

export type ArchivedJobsScreenProps = {
  rows: ArchivedJobRow[];
  busyJobId: string | null;
  message: string | null;
  onUnarchive: (jobId: string) => void;
  onOpenJob: (jobId: string) => void;
  onBack: () => void;
  variant?: 'archived' | 'closed';
};

export function ArchivedJobsScreen(props: ArchivedJobsScreenProps) {
  const { rows, busyJobId, message, onUnarchive, onOpenJob, onBack, variant = 'archived' } = props;
  const isClosed = variant === 'closed';
  return (
    <View style={styles.screen}>
      <View style={styles.backRow}>
        <PayrollButton label="Back" onPress={onBack} testID={isClosed ? 'closed-jobs-back' : 'archived-jobs-back'} />
      </View>
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {rows.length === 0 ? (
        <EmptyState title={isClosed ? 'No closed jobs.' : 'No archived jobs.'} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          {rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <Pressable testID={`${isClosed ? 'closed' : 'archived'}-job-open-${row.id}`} onPress={() => onOpenJob(row.id)} style={styles.rowText}>
                <Text style={styles.title}>{row.title}</Text>
                {row.subtitle !== null ? <Text style={styles.subtitle}>{row.subtitle}</Text> : null}
              </Pressable>
              {isClosed ? null : (
                <PayrollButton
                  label={busyJobId === row.id ? 'Unarchiving...' : 'Unarchive'}
                  testID={`job-unarchive-${row.id}`}
                  disabled={busyJobId !== null}
                  onPress={() => onUnarchive(row.id)}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default ArchivedJobsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  backRow: { padding: spacing.xs },
  message: {
    color: colors.danger,
    fontSize: typography.size.body,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: { flex: 1 },
  content: { padding: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  rowText: { flexShrink: 1, paddingRight: spacing.sm },
  title: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
  subtitle: { color: colors.textMuted, fontSize: typography.size.body },
});
