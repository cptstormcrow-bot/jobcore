/**
 * Employee detail / drilldown screen (Employee Roster feature).
 *
 * Read-heavy scope ONLY. This screen does no fetching of its own, mirroring
 * `PriceSheetEditorScreen.tsx`'s prop-driven data pattern but WITHOUT a load
 * state machine, since there is nothing to load here.
 *
 * Contents, top to bottom: the employee name header, the Back/Edit/Deactivate
 * action buttons, a detail card (one label/value row per field), the Skills
 * card (wrapped chips), and the Service Areas card.
 *
 * Navigation is caller-supplied callback props only (no router, no Modal,
 * in this module) — `onEdit`, `onBack`, `onDeactivate`, `onReactivate`,
 * named to match `PriceSheetEditorScreen.tsx`'s `onSave`/`onPublished`
 * verb-first convention.
 *
 * Deactivate/Reactivate is a simple callback invocation with no local
 * loading/error state — the caller (a later pipeline stage) owns that,
 * per the plan.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import { getModulePorts } from '../lib/module-ports';
import type { ProfilePrivate } from '../data/ports';

export interface EmployeeDetailScreenProps {
  employee: Profile;
  /** This employee's assigned skills, already filtered by the caller. */
  skills?: string[];
  /** This employee's service areas (names), supplied by the caller. */
  serviceAreas?: string[];
  hoursWorked?: { week: number; month: number; year: number };
  onEdit: () => void;
  onBack: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

/** Masks a driver's license number to its last 4 characters, e.g. "•••• 1234". Full value is only ever shown in the editor. */
function maskSsn(last4: string | null): string { return last4 ? `•••-••-${last4}` : 'Not on file'; }

function maskDriversLicense(value: string | null): string {
  if (!value) return 'Not on file';
  if (value.length <= 4) return value;
  return `•••• ${value.slice(-4)}`;
}

/** Local label/value row for the identity-fields card — fixed label column, flexible value column, used only here. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelCell}>
        <Text style={styles.infoLabel}>{`${label}:`}</Text>
      </View>
      <View style={styles.infoValueCell}>
        {typeof value === 'string' ? <Text style={styles.infoValue}>{value}</Text> : value}
      </View>
    </View>
  );
}

export function EmployeeDetailScreen(props: EmployeeDetailScreenProps) {
  const { employee, skills, serviceAreas, hoursWorked, onEdit, onBack, onDeactivate, onReactivate } = props;
  const [priv, setPriv] = useState<ProfilePrivate | null>(null);
  const [privFailed, setPrivFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getModulePorts().employees.getPrivate(employee.id).then((r) => { if (!cancelled) { setPriv(r); setPrivFailed(false); } }).catch(() => { if (!cancelled) { setPriv(null); setPrivFailed(true); } });
    return () => { cancelled = true; };
  }, [employee.id]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={employee.fullName} />

        <View style={styles.actionsRow}>
          <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.actionInline} />
          <Button label="Edit" size="sm" onPress={onEdit} style={styles.actionInline} />
          {employee.active ? (
            <Button label="Deactivate" variant="secondary" size="sm" onPress={onDeactivate} style={styles.actionInline} />
          ) : (
            <Button label="Reactivate" variant="secondary" size="sm" onPress={onReactivate} style={styles.actionInline} />
          )}
        </View>

        <Card style={styles.card}>
          <InfoRow label="Role" value={employee.role} />
          <InfoRow label="Status" value={employee.active ? 'Active' : 'Inactive'} />
          {employee.isTest ? <InfoRow label="Test Employee" value="Yes" /> : null}
          <InfoRow label="Email" value={employee.email ?? 'Not on file'} />
          <InfoRow label="Address" value={employee.address ?? 'Not on file'} />
          <InfoRow label="Driver's License" value={maskDriversLicense(employee.driversLicenseNumber)} />
          <InfoRow label="SSN" value={privFailed ? 'Unavailable' : maskSsn(priv?.ssnLast4 ?? null)} />
          <InfoRow label="Emergency Contact" value={privFailed ? 'Unavailable' : (priv?.emergencyContactName ? [priv.emergencyContactName, priv.emergencyContactPhone].filter(Boolean).join(' · ') : 'Not on file')} />
          <InfoRow label="Vehicle Status" value={employee.vehicleStatus ?? 'Not set'} />
          <InfoRow label="Tool Status" value={employee.toolStatus ?? 'Not set'} />
          <InfoRow
            label="Hours Worked"
            value={
              hoursWorked ? (
                <View>
                  <Text style={styles.infoValue}>{`This week: ${hoursWorked.week.toFixed(1)}`}</Text>
                  <Text style={styles.infoValue}>{`This month: ${hoursWorked.month.toFixed(1)}`}</Text>
                  <Text style={styles.infoValue}>{`This year: ${hoursWorked.year.toFixed(1)}`}</Text>
                </View>
              ) : 'Not available'
            }
          />
          <InfoRow label="Hourly Rate" value={employee.defaultHourlyRateCents != null ? `$${(employee.defaultHourlyRateCents / 100).toFixed(2)}/hr` : 'Not set'} />
        </Card>

        <Text style={styles.heading}>Skills</Text>
        <Card style={styles.card}>
          {skills && skills.length > 0 ? (
            <View style={styles.chipWrap}>
              {skills.map((skill) => (
                <View key={skill} style={styles.chip}>
                  <Text style={styles.chipText}>{skill}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.note}>No skills on file for this employee.</Text>
          )}
        </Card>

        <Text style={styles.heading}>Service Areas</Text>
        <Card style={styles.card}>
          {serviceAreas && serviceAreas.length > 0 ? (
            <Text style={styles.note}>{serviceAreas.join(', ')}</Text>
          ) : (
            <Text style={styles.note}>No service areas on file for this employee.</Text>
          )}
        </Card>
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
    padding: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionInline: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  infoLabelCell: {
    width: 140,
    flexShrink: 0,
  },
  infoValueCell: {
    flex: 1,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipText: {
    color: colors.text,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
});
