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
import { Button, Card, ListItem, ScreenTitle, colors, spacing, typography } from '@jobcore/ui';
import { DayList } from '@jobcore/field-tech';
import type { Profile, Job } from '@jobcore/core';

export interface EmployeeDetailScreenProps {
  employee: Profile;
  /** This employee's assigned + completed jobs, already filtered by the caller. */
  jobs: Job[];
  /** This employee's assigned skills, already filtered by the caller — same pattern as `jobs`. */
  skills?: string[];
  hoursWorked?: number;
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

/** Masks a driver's license number to its last 4 characters, e.g. "•••• 1234". Full value is only ever shown in the editor. */
function maskDriversLicense(value: string | null): string {
  if (!value) return 'Not on file';
  if (value.length <= 4) return value;
  return `•••• ${value.slice(-4)}`;
}

/** Local label/value row for the identity-fields card — value dominant, label secondary (inverse of `ListItem`'s hierarchy), used only here. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function EmployeeDetailScreen(props: EmployeeDetailScreenProps) {
  const { employee, jobs, skills, hoursWorked, onEdit, onBack, onSelectJob, onDeactivate, onReactivate } = props;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={employee.fullName} />

        <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.action} />

        <Card style={styles.card}>
          <InfoRow label="Role" value={employee.role} />
          <InfoRow label="Status" value={employee.active ? 'Active' : 'Inactive'} />
          {employee.isTest ? <InfoRow label="Test Employee" value="Yes" /> : null}
          <InfoRow label="Address" value={employee.address ?? 'Not on file'} />
          <InfoRow label="Driver's License" value={maskDriversLicense(employee.driversLicenseNumber)} />
          <InfoRow label="Vehicle Status" value={employee.vehicleStatus ?? 'Not set'} />
          <InfoRow label="Tool Status" value={employee.toolStatus ?? 'Not set'} />
          <InfoRow label="Hours Worked" value={hoursWorked != null ? hoursWorked.toFixed(1) : 'Not available'} />
        </Card>

        <Text style={styles.heading}>Skills</Text>
        <Card style={styles.card}>
          {skills && skills.length > 0 ? (
            skills.map((skill) => <ListItem key={skill} title={skill} />)
          ) : (
            <Text style={styles.note}>No skills on file for this employee.</Text>
          )}
        </Card>

        <Text style={styles.heading}>Schedule</Text>
        <Card style={styles.card}>
          <DayList techId={employee.id} />
        </Card>

        <Text style={styles.heading}>Job History</Text>
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

        <View style={styles.actionsRow}>
          <Button label="Edit" onPress={onEdit} style={styles.actionInline} />
          {employee.active ? (
            <Button label="Deactivate" variant="secondary" onPress={onDeactivate} style={styles.actionInline} />
          ) : (
            <Button label="Reactivate" variant="secondary" onPress={onReactivate} style={styles.actionInline} />
          )}
        </View>
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
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionInline: {
    flex: 1,
  },
  infoRow: {
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: 2,
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
});
