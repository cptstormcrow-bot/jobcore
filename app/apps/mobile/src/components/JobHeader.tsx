import React from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Job } from '@jobcore/core';
import { AppChrome, JobHeaderBlock, JobTitleBarHeader, TechSelect, colors, spacing, typography, Text } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import type { Customer } from '../../../../modules/admin-finance/src/data/ports';
import { formatElapsed, abbreviate } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';

export type JobRegion = 'details' | 'plan' | 'evisit' | 'estimate' | 'assign' | 'schedule' | 'closeout';

export type JobHeaderProps = {
  job: Job;
  customer?: Customer | null;
  jobDetailMenuItems: MenuItem[];
  totalLaborSeconds: number;
  children?: React.ReactNode;
  gearItems?: ComponentProps<typeof AppChrome>['gearItems'];
  showBack?: ComponentProps<typeof AppChrome>['showBack'];
  compactMenu?: ComponentProps<typeof AppChrome>['compactMenu'];
  fitMenu?: ComponentProps<typeof AppChrome>['fitMenu'];
  onLogoPress?: ComponentProps<typeof AppChrome>['onLogoPress'];
  gearTitle?: ComponentProps<typeof AppChrome>['gearTitle'];
};

const copyToClipboard = async (text: string): Promise<void> => { await Clipboard.setStringAsync(text); };

export function JobHeader({
  job,
  customer = null,
  jobDetailMenuItems,
  totalLaborSeconds,
  gearItems,
  showBack,
  compactMenu,
  fitMenu,
  onLogoPress,
  gearTitle,
  children,
}: JobHeaderProps) {
  const totalHoursLabel =
    totalLaborSeconds > 0
      ? formatElapsed(new Date(0).toISOString(), new Date(totalLaborSeconds * 1000))
      : null;
  const ingressCode = job.ingressInstructions?.trim() ? job.ingressInstructions.trim() : null;

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
        titleContent={
          <JobTitleBarHeader
            customerName={customer?.name ?? 'Unknown Customer'}
            address={job.address}
            phone={customer?.phone}
            ingressCode={ingressCode}
            onCopy={copyToClipboard}
          />
        }
        titleBarTone="gold"
        helpContext={{ screenKey: 'job-detail', jobStatus: job.status }}
        gearItems={gearItems}
        showBack={showBack}
        compactMenu={compactMenu}
        fitMenu={fitMenu}
        onLogoPress={onLogoPress}
        gearTitle={gearTitle}
      />
      {totalHoursLabel ? <Text style={styles.totalHours}>Total Hours: {totalHoursLabel}</Text> : null}
      <JobHeaderBlock
        jobNumber={job.jobNumber}
        createdAt={job.createdAt}
        scheduledStart={job.scheduledStart}
      >
        {children}
      </JobHeaderBlock>
    </View>
  );
}

export default JobHeader;

export type JobSummaryRestProps = {
  job: Job;
  serviceAreaName?: string | null;
  techs?: { id: string; name: string }[];
  premTechId?: string | null;
  serviceTechId?: string | null;
  premTechName?: string | null;
  serviceTechName?: string | null;
  onRequestAssignPrem?: (techId: string | null) => void;
  onRequestAssignService?: (techId: string | null) => void;
  premBusy?: boolean;
  serviceBusy?: boolean;
  premIndicator?: string | null;
  statusError?: string | null;
};

type TechRowProps = {
  label: string;
  techId?: string | null;
  techName?: string | null;
  techs?: { id: string; name: string }[];
  onRequest?: (techId: string | null) => void;
  busy?: boolean;
  indicator?: string | null;
};

function TechRow({ label, techId, techName, techs, onRequest, busy, indicator }: TechRowProps) {
  return (
    <View style={styles.techRow}>
      <Text style={styles.summaryLine}>{label}:</Text>
      {indicator ? <Text style={styles.indicator}>{indicator}</Text> : null}
      {techs && onRequest ? (
        <View style={styles.techSelect}>
          <TechSelect
            value={techId ?? ''}
            options={[{ label: 'Unassigned', value: '' }, ...techs.map((tech) => ({ label: tech.name, value: tech.id }))]}
            placeholder="Choose technician"
            disabled={busy}
            onChange={(id) => { if ((id || null) === (techId ?? null)) return; onRequest(id || null); }}
          />
        </View>
      ) : (
        <Text style={styles.summaryLine}>{techName ?? 'Unassigned'}</Text>
      )}
    </View>
  );
}

export function JobSummaryRest({
  serviceAreaName = null,
  techs,
  premTechId = null,
  serviceTechId = null,
  premTechName = null,
  serviceTechName = null,
  onRequestAssignPrem,
  onRequestAssignService,
  premBusy,
  serviceBusy,
  premIndicator = null,
  statusError = null,
}: JobSummaryRestProps) {
  const arriveEligible = Boolean(serviceTechId) || Boolean(serviceTechName);
  const arriveHint = !arriveEligible ? 'Assign a tech before starting.' : null;

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
        <TechRow
          label="Prem Tech"
          techId={premTechId}
          techName={premTechName}
          techs={techs}
          onRequest={onRequestAssignPrem}
          busy={premBusy}
          indicator={premIndicator}
        />
        <TechRow
          label="Service Tech"
          techId={serviceTechId}
          techName={serviceTechName}
          techs={techs}
          onRequest={onRequestAssignService}
          busy={serviceBusy}
        />
        <View style={styles.techRow}>
          {serviceAreaName ? (
            <Text style={styles.summaryLine}>Service Area: {serviceAreaName}</Text>
          ) : (
            <Text style={[styles.summaryLine, styles.serviceAreaUnassigned]}>Service Area: Unassigned</Text>
          )}
        </View>
      </View>
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
  summaryLine: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  techRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  techSelect: { flex: 1 },
  indicator: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusError: { color: colors.danger, fontSize: typography.size.small, marginTop: 2 },
  arriveHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingHorizontal: spacing.md, paddingTop: 2 },
  serviceAreaUnassigned: { color: colors.textMutedDark },
});
