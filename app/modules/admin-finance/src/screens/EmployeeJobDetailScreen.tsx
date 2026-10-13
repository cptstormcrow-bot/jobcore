// JobCore screen #0044 - af-employee-job-detail - Employee Job Detail
/**
 * Employee job-detail screen (Employee Roster feature) — READ-ONLY.
 *
 * Renders status, address, schedule/date, and assigned technician name for
 * a single job, using this module's Card/ListItem layout conventions
 * (`PriceSheetEditorScreen.tsx`). No job-action buttons and no mutation
 * calls — status changes/reassignment are explicitly out of scope here.
 *
 * `job.assignedTechId` is an id, not a name (`@jobcore/core`'s `Job` type
 * has no denormalized technician-name field) — the caller resolves it to a
 * display name and passes it in as `techName`; this screen falls back to
 * the raw id if no name is supplied. Navigation is a caller-supplied
 * `onBack` callback only, matching this module's no-router / no-Modal
 * convention.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ListItem, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Job } from '@jobcore/core';

export interface EmployeeJobDetailScreenProps {
  job: Job;
  techName?: string;
  onBack: () => void;
}

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
  return parsed.toLocaleString();
}

export function EmployeeJobDetailScreen(props: EmployeeJobDetailScreenProps) {
  const { job, techName, onBack } = props;

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Job Details" subtitle={job.address ?? undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.action} />

        <Card style={styles.card}>
          <ListItem title="Status" subtitle={job.status} />
          <ListItem title="Address" subtitle={job.address ?? 'No address'} />
          <ListItem title="Scheduled" subtitle={formatDate(job.scheduledStart)} />
          <ListItem title="Assigned Technician" subtitle={techName ?? job.assignedTechId ?? 'Unassigned'} />
        </Card>
      </ScrollView>
    </View>
  );
}

export default EmployeeJobDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
});
