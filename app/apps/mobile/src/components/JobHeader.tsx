import React from 'react';
import type { ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import type { Job } from '@jobcore/core';
import { AppChrome, JobHeaderBlock, JobTitleBarHeader, TechSelect, formatJobHeaderLines, formatScheduleLabel, colors, spacing, typography, Text } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import type { Customer } from '../../../../modules/admin-finance/src/data/ports';
import { formatElapsed, abbreviate } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';

export type JobRegion = 'details' | 'plan' | 'evisit' | 'estimate' | 'assign' | 'schedule' | 'closeout' | 'payment';

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
  optionsItems?: ComponentProps<typeof AppChrome>['optionsItems'];
  summaryRight?: React.ReactNode;
};

const copyToClipboard = async (text: string): Promise<void> => { await Clipboard.setStringAsync(text); };

const formatClock = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m < 10 ? `0${m}` : m}${h < 12 ? 'am' : 'pm'}`;
};

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
  optionsItems,
  children,
}: JobHeaderProps) {
  const totalHoursLabel =
    totalLaborSeconds > 0
      ? formatElapsed(new Date(0).toISOString(), new Date(totalLaborSeconds * 1000))
      : null;
  const ingressCode = job.ingressInstructions?.trim() ? job.ingressInstructions.trim() : null;
  const router = useRouter();
  const headerLines = formatJobHeaderLines(job.jobNumber, job.createdAt);
  const timeLines: string[] = [];
  const enRouteClock = formatClock(job.enRouteAt);
  const arrivedClock = formatClock(job.inProgressAt);
  const completedClock = formatClock(job.completedAt);
  if (enRouteClock) timeLines.push(`En route: ${enRouteClock}`);
  if (arrivedClock) timeLines.push(`Arrived: ${arrivedClock}`);
  if (completedClock) timeLines.push(`Completed: ${completedClock}`);
  if (job.inProgressAt && job.completedAt) {
    const billed = formatElapsed(job.inProgressAt, new Date(job.completedAt));
    if (billed) timeLines.push(`Billed: ${billed}`);
  }
  const onSchedulePress = () => {
    const d = job.scheduledStart ? new Date(job.scheduledStart) : null;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const datePart =
      d && !Number.isNaN(d.getTime())
        ? `date=${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}&`
        : '';
    const returnTo = encodeURIComponent(`/job/${job.id}?panel=plan`);
    router.push(`/calendar?${datePart}jobId=${job.id}&returnTo=${returnTo}` as never);
  };

  return (
    <View style={styles.root}>
      <AppChrome
        menuItems={jobDetailMenuItems}
        optionsItems={optionsItems ?? []}
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
            jobLine={headerLines.jobLine}
            dateLine={headerLines.dateLine}
            scheduleLabel={formatScheduleLabel(job.scheduledStart)}
            onSchedulePress={onSchedulePress}
            timeLines={timeLines}
          />
        }
        titleBarTone="gold"
        titleBarInset={5}
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
        hideJobLine
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
  summaryRight?: React.ReactNode;
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
  summaryRight,
}: JobSummaryRestProps) {
  const arriveEligible = Boolean(serviceTechId) || Boolean(serviceTechName);
  const arriveHint = !arriveEligible ? 'Assign a tech before starting.' : null;

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
        <View style={summaryRight ? { flexDirection: 'row', alignItems: 'flex-start' } : undefined}>
        <View style={summaryRight ? { flex: 1 } : undefined}>
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
        {summaryRight ? <View style={{ marginLeft: spacing.sm }}>{summaryRight}</View> : null}
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
    textAlign: 'center',
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
