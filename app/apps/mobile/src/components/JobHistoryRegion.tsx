import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { useRouter } from 'expo-router';
import { PayrollButton, colors, spacing } from '@jobcore/ui';
import type { JobTimelineItem } from '../../../../modules/admin-finance/src/domain/job-timeline';
import type { CustomerJobHistoryItem } from '../../../../modules/admin-finance/src/data/ports';
import { buildAdminFinancePorts } from '../lib/admin-finance-repos';

export type JobHistoryRegionProps = {
  job: Job;
  role: string;
};

const QUERY_TEXT = "select id, job_number, status from jobs where status = 'archived';";

function statusLine(status: string): string {
  if (status === 'archived') return 'Archived';
  if (status === 'closed') return 'Closed';
  return 'Open';
}

function dateOf(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function JobHistoryRegion({ job, role }: JobHistoryRegionProps) {
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const router = useRouter();
  const [timeline, setTimeline] = useState<JobTimelineItem[]>([]);
  const [timelineError, setTimelineError] = useState(false);
  const [others, setOthers] = useState<CustomerJobHistoryItem[]>([]);
  const [othersError, setOthersError] = useState(false);
  const isAdmin = role === 'owner' || role === 'admin';
  const isClosed = job.status === 'closed' || job.status === 'archived';

  useEffect(() => {
    let cancelled = false;
    setTimelineError(false);
    ports.jobTimeline
      .listForJob(job.id)
      .then((items) => {
        if (!cancelled) setTimeline(items);
      })
      .catch(() => {
        if (!cancelled) {
          setTimeline([]);
          setTimelineError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, ports.jobTimeline]);

  useEffect(() => {
    const customerId = job.customerId;
    if (!customerId) {
      setOthers([]);
      return undefined;
    }
    let cancelled = false;
    setOthersError(false);
    ports.customers
      .listJobHistory(customerId)
      .then((rows) => {
        if (!cancelled) setOthers(rows.filter((r) => r.jobId !== job.id));
      })
      .catch(() => {
        if (!cancelled) {
          setOthers([]);
          setOthersError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.customerId, job.id, ports.customers]);

  const trail = useMemo(() => [...timeline].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)), [timeline]);

  const heading = { fontWeight: '700' as const, fontSize: 16, color: colors.text, marginBottom: spacing.xs };
  const muted = { color: colors.textMuted, marginBottom: spacing.xs };
  const section = { marginBottom: spacing.md };

  return (
    <View style={{ padding: spacing.sm }}>
      <View style={section}>
        <Text style={{ fontWeight: '700', fontSize: 20, color: colors.text, marginBottom: spacing.xs }}>History</Text>
        <Text style={{ color: colors.text }}>
          History is the permanent record of this job after Close-Out. Closed jobs stay on file with their photos, notes,
          payments and pay. Archiving a job only hides it from the Jobs board - nothing is deleted, and an archived job
          can be brought back.
        </Text>
      </View>

      <View style={section}>
        <Text style={heading}>This job</Text>
        <Text style={{ color: colors.text }}>Status: {statusLine(job.status)}</Text>
        {!isClosed ? <Text style={muted}>History fills in once this job is closed out.</Text> : null}
      </View>

      <View style={section}>
        <Text style={heading}>This job's trail</Text>
        {timelineError ? <Text style={muted}>Could not load this job's trail.</Text> : null}
        {!timelineError && trail.length === 0 ? <Text style={muted}>No entries yet.</Text> : null}
        {trail.map((item, i) => (
          <View key={`${item.at}-${i}`} style={{ marginBottom: spacing.xs }}>
            <Text style={{ color: colors.text }}>{item.label}</Text>
            <Text style={muted}>
              {dateOf(item.at)}
              {item.actor ? ` - ${item.actor}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={section}>
        <Text style={heading}>Other jobs for this customer</Text>
        {othersError ? <Text style={muted}>Could not load other jobs for this customer.</Text> : null}
        {!othersError && others.length === 0 ? <Text style={muted}>No other jobs on file.</Text> : null}
        {others.map((o) => (
          <Pressable
            key={o.jobId}
            onPress={() => router.push(`/job/${o.jobId}` as never)}
            style={{ paddingVertical: spacing.xs }}
          >
            <Text style={{ color: colors.text }}>
              {o.jobNumber != null ? `#${o.jobNumber} ` : ''}
              {o.title ?? 'Untitled job'} - {o.status} - {dateOf(o.createdAt)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isAdmin ? (
        <View style={section}>
          <PayrollButton
            label="Open Archived Jobs"
            onPress={() => router.push(`/m/admin-finance?view=archivedJobs&ts=${Date.now()}` as never)}
          />
          <Text style={[heading, { marginTop: spacing.md }]}>How to find archived records</Text>
          <Text style={{ color: colors.text }}>
            Archived jobs are rows in the jobs table with status = 'archived'. archive_job(job_id) hides a job and
            unarchive_job(job_id) restores it.
          </Text>
          <Text style={{ fontFamily: 'monospace', color: colors.text, marginTop: spacing.xs }}>{QUERY_TEXT}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default JobHistoryRegion;
