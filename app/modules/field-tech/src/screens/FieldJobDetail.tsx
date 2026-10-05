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
import { View, Linking, StyleSheet } from 'react-native';

import type { Job } from '@jobcore/core';
import { Button, telUrl, colors, spacing, typography, Text } from '@jobcore/ui';
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
export function FieldJobDetail({ jobId, customerPhone }: FieldJobDetailProps): React.ReactElement {
  const session = getModuleSession();

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
      setLoading(true);
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
  }, [jobId, session]);

  const handleCall = React.useCallback(() => {
    if (!customerPhone) return;
    void Linking.openURL(telUrl(customerPhone));
  }, [customerPhone]);

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

  const headerLine = [`Job ${job.id}`, job.status, job.address].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{headerLine}</Text>

      {job.description ? <Text style={styles.description}>{job.description}</Text> : null}

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
        {job.customerName ? (
          <>
            <Text style={styles.label}>Customer name</Text>
            <Text style={styles.value}>{job.customerName}</Text>
          </>
        ) : null}
        {job.ingressInstructions ? (
          <>
            <Text style={styles.label}>Ingress instructions</Text>
            <Text style={styles.value}>{job.ingressInstructions}</Text>
          </>
        ) : null}
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
        <Button
          label={customerPhone ? `Call ${customerPhone}` : 'No phone on file'}
          onPress={handleCall}
          variant="primary"
          size="sm"
          disabled={!customerPhone}
        />
        <Button
          label={job.address ?? 'No address on file'}
          onPress={handleMap}
          variant="primary"
          size="sm"
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
    marginBottom: spacing.md,
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
