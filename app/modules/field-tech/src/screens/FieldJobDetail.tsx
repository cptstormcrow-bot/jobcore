// JobCore screen #0027 - ft-FieldJobDetail - Job Detail
/**
 * FieldJobDetail — module-local job detail screen (P4.S3.3).
 *
 * This is NOT `apps/mobile`'s shared `JobDetail.tsx`. field-tech's isolation
 * rule forbids importing anything from `apps/mobile`, so this screen is
 * self-contained: it only depends on this module's own data seam
 * (`../data/ports`) and session/port plumbing (`../lib/module-session`,
 * `../lib/module-ports`), mirroring `modules/admin-finance/src`'s layering.
 *
 * ZERO financial fields. This screen must never render anything sourced
 * from `price_sheets`, commissions, or payout data — grep-checked in S5.5.
 * If a job record happens to carry a financial field, it is simply never
 * read here.
 *
 * Ties to spec AC9.
 */

import * as React from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, Linking, StyleSheet } from 'react-native';

import type { Job } from '@jobcore/core';
import { PayrollButton, telUrl, colors, spacing, typography, Text, JobHeaderBlock, JobTitleBarHeader, formatJobHeaderLines, formatScheduleLabel } from '@jobcore/ui';
import { copyToClipboard } from '../lib/clipboard';
import type { JobNote } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

/** Props for `FieldJobDetail`. `jobId` selects the job; the rest is resolved via ports. */
export interface FieldJobDetailProps {
  jobId: string;
  /**
   * Customer phone number for tap-to-call. Not part of the `jobs` row
   * (see `../data/ports.ts`'s `JobRow`) — supplied by the caller from
   * wherever customer contact info is sourced, so this screen never has
   * to reach outside its own data seam to get it.
   */
  customerPhone?: string | null;
  /** Opens the calendar from the title bar schedule label. Absent = plain label. */
  onOpenCalendar?: () => void;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/** Builds a `maps:` URL for tap-to-map — no new native deps. */
function mapsUrl(address: string): string {
  return `maps:0,0?q=${encodeURIComponent(address)}`;
}

/**
 * Module-local job detail screen. Shows requested vs scheduled timing
 * distinctly, tap-to-call / tap-to-map actions, and read-only admin notes.
 * Renders nothing financial.
 */
export function FieldJobDetail({ jobId, customerPhone, onOpenCalendar }: FieldJobDetailProps): React.ReactElement {
  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = React.useRef(false);

  const [job, setJob] = React.useState<Job | null>(null);
  const [adminNotes, setAdminNotes] = React.useState<JobNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!hasLoadedRef.current) setLoading(true);
      hasLoadedRef.current = true;
      setError(null);
      try {
        const ports = getModulePorts();
        const [loadedJob, notes] = await Promise.all([
          ports.jobs.getById(jobId, session!.userId),
          ports.notes.listForJob(jobId),
        ]);
        if (cancelled) return;
        setJob(loadedJob);
        setAdminNotes(notes.filter((note) => note.kind === 'admin_correction'));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load job.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId, session, rev]);

  const resolvedPhone = customerPhone ?? job?.customerPhone ?? null;

  const handleCall = React.useCallback(() => {
    if (!resolvedPhone) return;
    void Linking.openURL(telUrl(resolvedPhone));
  }, [resolvedPhone]);

  const handleMap = React.useCallback(() => {
    if (!job?.address) return;
    void Linking.openURL(mapsUrl(job.address));
  }, [job]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Signing in…</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading job…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Text>Job not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <JobTitleBarHeader
        framed
        inset={5}
        jobLine={formatJobHeaderLines(job.jobNumber ?? job.id, job.createdAt).jobLine}
        dateLine={formatJobHeaderLines(job.jobNumber ?? job.id, job.createdAt).dateLine}
        scheduleLabel={formatScheduleLabel(job.scheduledStart)}
        onSchedulePress={onOpenCalendar}
        customerName={job.customerName}
        address={job.address}
        phone={resolvedPhone}
        ingressCode={job.ingressInstructions}
        onCopy={copyToClipboard}
      />
      <JobHeaderBlock
        hideJobLine
        jobNumber={job.jobNumber ?? job.id}
        createdAt={job.createdAt}
        scheduledStart={job.scheduledStart}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        {getModulePorts().renderTaskList?.({ jobId, mode: 'read' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timing</Text>
        <Text style={styles.label}>Requested window</Text>
        <Text style={styles.value}>{job.requestedWindow ?? 'Not requested'}</Text>
        <Text style={styles.label}>Scheduled start</Text>
        <Text style={styles.value}>{formatDateTime(job.scheduledStart)}</Text>
        <Text style={styles.label}>Scheduled end</Text>
        <Text style={styles.value}>{formatDateTime(job.scheduledEnd)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job details</Text>
        {job.permitStatus ? (
          <>
            <Text style={styles.label}>Permit status</Text>
            <Text style={styles.value}>{job.permitStatus}</Text>
          </>
        ) : null}
        {job.parkingAvailable ? (
          <>
            <Text style={styles.label}>Parking availability</Text>
            <Text style={styles.value}>{job.parkingAvailable}</Text>
          </>
        ) : null}
        {job.rooms && job.rooms.length > 0 ? (
          <>
            <Text style={styles.label}>Rooms needing work</Text>
            <Text style={styles.value}>{job.rooms.join(', ')}</Text>
          </>
        ) : null}
        {job.panelInfo ? (
          <>
            <Text style={styles.label}>Main panel size/style</Text>
            <Text style={styles.value}>{job.panelInfo}</Text>
          </>
        ) : null}
        {job.considerations ? (
          <>
            <Text style={styles.label}>Considerations</Text>
            <Text style={styles.value}>{job.considerations}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact & location</Text>
        <PayrollButton
          label={resolvedPhone ? `Call ${resolvedPhone}` : 'No phone on file'}
          onPress={handleCall}
          disabled={!resolvedPhone}
        />
        <PayrollButton
          label={job.address ?? 'No address on file'}
          onPress={handleMap}
          disabled={!job.address}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin notes</Text>
        {adminNotes.length === 0 ? (
          <Text style={styles.value}>No admin notes.</Text>
        ) : (
          adminNotes.map((note: JobNote) => (
            <View key={note.id} style={styles.noteRow}>
              <Text style={styles.noteTimestamp}>{formatDateTime(note.occurredAt)}</Text>
              <Text style={styles.value}>{note.body}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  description: {
    fontSize: typography.size.label,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.h6,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.size.small,
    color: colors.textMutedDark,
    marginTop: spacing.xs,
  },
  value: {
    fontSize: typography.size.label,
  },
  noteRow: {
    marginBottom: spacing.sm,
  },
  noteTimestamp: {
    fontSize: typography.size.detail,
    color: colors.textMutedDark,
  },
  error: {
    color: colors.danger,
  },
});
