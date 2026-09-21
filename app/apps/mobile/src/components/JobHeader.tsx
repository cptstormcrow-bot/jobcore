import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Job } from '@jobcore/core';
import { AppChrome, Select, colors, spacing, typography } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import type { Customer } from '../../../../modules/admin-finance/src/data/ports';
import { formatElapsed, abbreviate } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';

export type JobRegion = 'details' | 'plan' | 'evisit' | 'estimate' | 'assign' | 'schedule';

export type JobHeaderProps = {
  job: Job;
  customer?: Customer | null;
  jobDetailMenuItems: MenuItem[];
  totalLaborSeconds: number;
};

export function JobHeader({
  job,
  customer = null,
  jobDetailMenuItems,
  totalLaborSeconds,
}: JobHeaderProps) {
  const totalHoursLabel =
    totalLaborSeconds > 0
      ? formatElapsed(new Date(0).toISOString(), new Date(totalLaborSeconds * 1000))
      : null;
  const scheduledDate = job.scheduledStart ? new Date(job.scheduledStart) : null;
  const dOpts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } as const;
  const tOpts = { hour: 'numeric', minute: '2-digit' } as const;
  const datePart = scheduledDate ? scheduledDate.toLocaleDateString(undefined, dOpts) : '';
  const timePart = scheduledDate ? scheduledDate.toLocaleTimeString(undefined, tOpts).toLowerCase() : '';
  const scheduledLabel = scheduledDate ? `Scheduled - ${datePart} at ${timePart}` : 'Unscheduled';

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
        titleBarTone="gold"
        helpContext={{ screenKey: 'job-detail', jobStatus: job.status }}
      />
      {totalHoursLabel ? <Text style={styles.totalHours}>Total Hours: {totalHoursLabel}</Text> : null}
      <View style={styles.summary}>
        <Text style={styles.customerName}>{customer?.name ?? 'Unknown Customer'}</Text>
        <Text style={styles.summaryLine}>{job.address ?? '—'}</Text>
        <Text style={styles.summaryLine}>{customer?.phone ? `Phone: ${customer.phone}` : 'Phone: —'}</Text>
        <Text style={styles.summaryLine}>Job #{job.jobNumber ?? '—'}</Text>
        <Text style={styles.summaryLineRight}>{scheduledLabel}</Text>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

export default JobHeader;

export type JobSummaryRestProps = {
  job: Job;
  assignedTechName?: string | null;
  serviceAreaName?: string | null;
  techs?: { id: string; name: string }[];
  onAssignTech?: (techId: string | null) => void;
  assigningTech?: boolean;
  statusError?: string | null;
};

export function JobSummaryRest({
  job,
  assignedTechName = null,
  serviceAreaName = null,
  techs,
  onAssignTech,
  assigningTech,
  statusError = null,
}: JobSummaryRestProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const paidEligible = job.status === 'completed';
  const paidHint =
    !paidEligible && job.status !== 'paid' && job.status !== 'closed'
      ? 'Complete the job before marking it paid.'
      : null;
  const arriveEligible = Boolean(assignedTechName);
  const arriveHint = !arriveEligible ? 'Assign a tech before starting.' : null;

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        <Text style={styles.summaryLine}>Date Created: {new Date(job.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.summaryLine}>
          Progress: {[
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
          <Pressable
            disabled={!(techs && techs.length > 0 && onAssignTech) || assigningTech}
            onPress={() => setPickerOpen((open) => !open)}>
            <Text style={styles.summaryLine}>{assignedTechName ?? 'Unassigned'}</Text>
          </Pressable>
        </View>
        {pickerOpen && techs && onAssignTech ? (
          <View style={styles.techSelect}>
            <Select
              value={job.assignedTechId ?? ''}
              options={[{ label: 'Unassigned', value: '' }, ...techs.map((tech) => ({ label: tech.name, value: tech.id }))]}
              placeholder="Choose technician"
              disabled={assigningTech}
              onChange={(techId) => { setPickerOpen(false); onAssignTech(techId || null); }}
            />
          </View>
        ) : null}
        <View style={styles.techRow}>
          {serviceAreaName ? (
            <Text style={styles.summaryLine}>Service Area: {serviceAreaName}</Text>
          ) : (
            <Text style={[styles.summaryLine, styles.serviceAreaUnassigned]}>Service Area: Unassigned</Text>
          )}
        </View>
      </View>
      {paidHint ? <Text style={styles.paidHint}>{paidHint}</Text> : null}
      {arriveHint ? <Text style={styles.arriveHint}>{arriveHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
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
  customerName: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h4,
    color: colors.text,
  },
  summaryLine: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  summaryLineRight: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
    textAlign: 'right',
  },
  rule: {
    height: 3,
    backgroundColor: colors.text,
    width: '100%',
    marginVertical: spacing.sm,
  },
  techRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  techSelect: { marginTop: spacing.xs },
  statusError: { color: colors.danger, fontSize: typography.size.small, marginTop: 4 },
  paidHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingHorizontal: spacing.md, paddingTop: 4 },
  arriveHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingHorizontal: spacing.md, paddingTop: 4 },
  serviceAreaUnassigned: { color: colors.textMutedDark },
});
