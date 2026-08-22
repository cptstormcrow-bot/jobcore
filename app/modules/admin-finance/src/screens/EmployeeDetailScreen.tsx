/**
 * Employee detail / drilldown screen (Employee Roster feature).
 *
 * Read-heavy scope ONLY. Jobs are supplied by the caller, already filtered
 * to this employee's assigned + completed jobs — this screen does no
 * fetching of its own, mirroring `PriceSheetEditorScreen.tsx`'s prop-driven
 * data pattern but WITHOUT a load state machine, since there is nothing to
 * load here.
 *
 * Navigation is caller-supplied callback props only (no router, no Modal,
 * in this module) — `onEdit`, `onBack`, `onSelectJob`, `onDeactivate`,
 * `onReactivate`, named to match `PriceSheetEditorScreen.tsx`'s
 * `onSave`/`onPublished` verb-first convention.
 *
 * `WeekView` (`@jobcore/ui`) is a dumb renderer with no fetching/filtering
 * of its own (see its header comment) — this screen forwards the employee's
 * jobs and its own `onSelectJob` prop straight through, and `anchorDay`
 * defaults to "today" since no anchor is supplied by the caller.
 *
 * Deactivate/Reactivate is a simple callback invocation with no local
 * loading/error state — the caller (a later pipeline stage) owns that,
 * per the plan.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ListItem, colors, spacing, typography, WeekView } from '@jobcore/ui';
import type { Profile, Job } from '@jobcore/core';

export interface EmployeeDetailScreenProps {
  employee: Profile;
  /** This employee's assigned + completed jobs, already filtered by the caller. */
  jobs: Job[];
  onEdit: () => void;
  onBack: () => void;
  onSelectJob: (job: Job) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
  return parsed.toLocaleDateString();
}

export function EmployeeDetailScreen(props: EmployeeDetailScreenProps) {
  const { employee, jobs, onEdit, onBack, onSelectJob, onDeactivate, onReactivate } = props;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.action} />

        <Card style={styles.card}>
          <Text style={styles.heading}>{employee.fullName}</Text>
          <ListItem title="Role" subtitle={employee.role} />
          <ListItem title="Status" subtitle={employee.active ? 'Active' : 'Inactive'} />
          {employee.isTest ? <ListItem title="Test Employee" subtitle="Yes" /> : null}
        </Card>

        <Text style={styles.heading}>Schedule</Text>
        <Card style={styles.card}>
          <WeekView jobs={jobs} anchorDay={new Date()} onSelectJob={onSelectJob} />
        </Card>

        <Text style={styles.heading}>Jobs</Text>
        <Card style={styles.card}>
          {jobs.length > 0 ? (
            jobs.map((job) => (
              <ListItem
                key={job.id}
                title={job.address ?? 'No address'}
                subtitle={`${job.status} · ${formatDate(job.scheduledStart)}`}
                onPress={() => onSelectJob(job)}
              />
            ))
          ) : (
            <Text style={styles.note}>No jobs on file for this employee.</Text>
          )}
        </Card>

        <Button label="Edit" onPress={onEdit} style={styles.action} />
        {employee.active ? (
          <Button label="Deactivate" variant="secondary" onPress={onDeactivate} style={styles.action} />
        ) : (
          <Button label="Reactivate" variant="secondary" onPress={onReactivate} style={styles.action} />
        )}
      </ScrollView>
    </View>
  );
}

export default EmployeeDetailScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  action: {
    marginBottom: spacing.sm,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
});
