import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { Breadcrumb, Button, Select, colors, spacing, typography } from '@jobcore/ui';
import type { Customer } from '../../../../modules/admin-finance/src/data/ports';
import { formatElapsed, abbreviate } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';

export type JobRegion = 'details' | 'plan' | 'evisit' | 'estimate' | 'assign' | 'schedule';

export type JobHeaderProps = {
  job: Job;
  customer?: Customer | null;
  assignedTechName?: string | null;
  serviceAreaName?: string | null;
  techs?: { id: string; name: string }[];
  onAssignTech?: (techId: string) => void;
  assigningTech?: boolean;
  region: JobRegion;
  onSelectRegion: (r: JobRegion) => void;
  onContact: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onPaid: () => void;
  busyAction?: string | null;
  statusError?: string | null;
};

type RegionButton = { id: JobRegion; label: string };

const REGION_BUTTONS: RegionButton[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'evisit', label: 'E-visit' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'assign', label: 'Assign' },
  { id: 'schedule', label: 'Schedule' },
];

export function JobHeader({
  job,
  customer = null,
  assignedTechName = null,
  serviceAreaName = null,
  techs,
  onAssignTech,
  assigningTech,
  region,
  onSelectRegion,
  onContact,
  onArrive,
  onComplete,
  onPaid,
  busyAction = null,
  statusError = null,
}: JobHeaderProps) {
  const elapsedFrom = job.completedAt ?? job.inProgressAt ?? job.enRouteAt ?? job.createdAt ?? null;
  const elapsed = formatElapsed(elapsedFrom);

  return (
    <View style={styles.root}>
      <Breadcrumb
        segments={[
          { label: 'Jobs' },
          { label: abbreviate(job.address) },
          { label: `#${job.jobNumber ?? '—'}` },
        ]}
      />
      <Text style={styles.heading}>Job Details</Text>
      <View style={styles.summary}>
        <Text style={styles.summaryLine}>{customer?.name ?? 'Unknown Customer'}</Text>
        <Text style={styles.summaryLine}>{job.address ?? '—'}</Text>
        <Text style={styles.summaryLine}>{customer?.phone ? `Phone: ${customer.phone}` : 'Phone: —'}</Text>
        <Text style={styles.summaryLine}>
          {[
            job.enRouteAt ? 'En route' : null,
            job.inProgressAt ? 'Arrived' : null,
            job.completedAt ? 'Completed' : null,
            job.status === 'paid' ? 'Paid' : null,
            elapsed ? `Elapsed: ${elapsed}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Not started'}
        </Text>
        {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
        <View style={styles.techRow}>
          <Text style={styles.summaryLine}>Technician Assigned:</Text>
          {techs && techs.length > 0 && onAssignTech ? (
            <View style={styles.techSelect}>
              <Select
                value={job.assignedTechId ?? null}
                options={techs.map((tech) => ({ label: tech.name, value: tech.id }))}
                placeholder="Unassigned"
                onChange={(techId) => { if (techId) onAssignTech(techId); }}
                disabled={assigningTech}
              />
            </View>
          ) : (
            <Text style={styles.summaryLine}> {assignedTechName ?? 'Unassigned'}</Text>
          )}
        </View>
        <View style={styles.techRow}>
          {serviceAreaName ? (
            <Text style={styles.summaryLine}>Service Area: {serviceAreaName}</Text>
          ) : (
            <Text style={[styles.summaryLine, styles.serviceAreaUnassigned]}>Service Area: Unassigned</Text>
          )}
        </View>
      </View>
      <View style={styles.rule} />
      <View style={styles.buttonRow}>
        {REGION_BUTTONS.map((btn) => (
          <Button
            key={btn.id}
            label={btn.label}
            size="tab"
            variant={region === btn.id ? 'primary' : 'outline'}
            disabled={busyAction === btn.id}
            onPress={() => onSelectRegion(btn.id)}
          />
        ))}
        <Button
          label="Contact"
          size="tab"
          variant="outline"
          disabled={busyAction === 'contact'}
          onPress={onContact}
        />
        <Button
          label="Arrive"
          size="tab"
          variant="outline"
          disabled={busyAction === 'arrive'}
          onPress={onArrive}
        />
        <Button
          label="Complete"
          size="tab"
          variant="outline"
          disabled={busyAction === 'complete'}
          onPress={onComplete}
        />
        <Button
          label="Paid"
          size="tab"
          variant="outline"
          disabled={busyAction === 'paid'}
          onPress={onPaid}
        />
      </View>
    </View>
  );
}

export default JobHeader;

const styles = StyleSheet.create({
  root: { width: '100%' },
  heading: {
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h6,
    color: colors.textMutedDark,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  summary: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  summaryLine: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.summary,
    color: colors.text,
  },
  rule: {
    height: 3,
    backgroundColor: '#000',
    width: '100%',
    marginVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  techRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  techSelect: { flexGrow: 1, minWidth: 160, marginLeft: spacing.sm },
  statusError: { color: colors.danger, fontSize: typography.size.small, marginTop: 4 },
  serviceAreaUnassigned: { color: colors.textMutedDark },
});
