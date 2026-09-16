import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { AppChrome, Select, colors, spacing, typography } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
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
  jobDetailMenuItems: MenuItem[];
  onContact: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onPaid: () => void;
  busyAction?: string | null;
  statusError?: string | null;
  totalLaborSeconds: number;
  isAdmin: boolean;
};

export function JobHeader({
  job,
  customer = null,
  assignedTechName = null,
  serviceAreaName = null,
  techs,
  onAssignTech,
  assigningTech,
  jobDetailMenuItems,
  onContact,
  onArrive,
  onComplete,
  onPaid,
  busyAction = null,
  statusError = null,
  totalLaborSeconds,
  isAdmin,
}: JobHeaderProps) {
  const paidEligible = job.status === 'completed';
  const paidHint =
    !paidEligible && job.status !== 'paid' && job.status !== 'closed'
      ? 'Complete the job before marking it paid.'
      : null;
  const arriveEligible = Boolean(assignedTechName);
  const arriveHint = !arriveEligible ? 'Assign a tech before starting.' : null;
  const totalHoursLabel =
    totalLaborSeconds > 0
      ? formatElapsed(new Date(0).toISOString(), new Date(totalLaborSeconds * 1000))
      : null;

  return (
    <View style={styles.root}>
      <AppChrome
        menuItems={jobDetailMenuItems}
        optionsItems={[]}
        breadcrumbSegments={[
          { label: 'Jobs' },
          { label: abbreviate(job.address) },
          { label: `#${job.jobNumber ?? '—'}` },
        ]}
        titleBar={{ title: customer?.name ?? 'Unknown Customer', subtitle: job.address ?? undefined }}
      />
      <Text style={styles.heading}>Job Details</Text>
      {totalHoursLabel ? <Text style={styles.totalHours}>Total Hours: {totalHoursLabel}</Text> : null}
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
      {paidHint ? <Text style={styles.paidHint}>{paidHint}</Text> : null}
      {arriveHint ? <Text style={styles.arriveHint}>{arriveHint}</Text> : null}
    </View>
  );
}

export default JobHeader;

const styles = StyleSheet.create({
  root: { width: '100%' },
  heading: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h6,
    color: colors.textMutedDark,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  totalHours: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h6,
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  summary: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  summaryLine: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.text,
  },
  rule: {
    height: 3,
    backgroundColor: colors.text,
    width: '100%',
    marginVertical: spacing.sm,
  },
  techRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  techSelect: { flexGrow: 1, minWidth: 160, marginLeft: spacing.sm },
  statusError: { color: colors.danger, fontSize: typography.size.small, marginTop: 4 },
  paidHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingHorizontal: spacing.md, paddingTop: 4 },
  arriveHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingHorizontal: spacing.md, paddingTop: 4 },
  serviceAreaUnassigned: { color: colors.textMutedDark },
});
