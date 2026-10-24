import { useEffect, useMemo, useState } from 'react';
import type { Job } from '@jobcore/core';
import { STAGE_KEYS, STAGE_LABELS } from '@jobcore/core';
import type { JobEstimate, JobInvestigation } from '../../../../modules/admin-finance/src/data/ports';
import {
  createEstimateRepository,
  createJobInvestigationRepository,
  createJobAssignmentRepository,
} from './admin-finance-repos';
import { supabase } from './supabase';
import { buildReadCacheKey, cachedRead, getReadCacheIdentity } from './read-cache';
import { buildJobStageResults, type JobStageExtras } from './job-stage-results';

const stageList = STAGE_KEYS.map((key) => ({ key, label: STAGE_LABELS[key] }));

export function useJobStageTimeline(job: Job | null, enabled: boolean) {
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [investigation, setInvestigation] = useState<JobInvestigation | null>(null);
  const [investigatorTechId, setInvestigatorTechId] = useState<string | null>(null);
  const [stageExtras, setStageExtras] = useState<JobStageExtras | null>(null);

  const jobId = job?.id;
  useEffect(() => {
    if (!enabled || !jobId) return undefined;
    let cancelled = false;
    void createEstimateRepository().getForJob(jobId).then((v) => {
      if (!cancelled) setEstimate(v);
    }).catch(() => {
      if (!cancelled) setEstimate(null);
    });
    void createJobInvestigationRepository().getForJob(jobId).then((v) => {
      if (!cancelled) setInvestigation(v);
    }).catch(() => {
      if (!cancelled) setInvestigation(null);
    });
    void createJobAssignmentRepository().getInvestigatorTechId(jobId).then((v) => {
      if (!cancelled) setInvestigatorTechId(v);
    }).catch(() => {
      if (!cancelled) setInvestigatorTechId(null);
    });
    const fetchLive = async () => {
      const [jobRes, photoRes, leadRes] = await Promise.all([
        supabase.from('jobs').select('contacted_at, stage_marks, upstream_changed_at, created_at').eq('id', jobId).maybeSingle(),
        supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('job_id', jobId),
        supabase.from('leads').select('id').eq('converted_job_id', jobId).limit(1).maybeSingle(),
      ]);
      if (jobRes.error || photoRes.error || leadRes.error) throw jobRes.error ?? photoRes.error ?? leadRes.error;
      return { jobData: jobRes.data ?? null, photoCount: photoRes.count ?? 0, leadData: leadRes.data ?? null };
    };
    void (async () => {
      const identity = getReadCacheIdentity();
      let fetched: Awaited<ReturnType<typeof fetchLive>>;
      try {
        fetched = identity
          ? (await cachedRead(buildReadCacheKey(identity.orgId, identity.userId, 'app.jobs.stageExtras', { jobId }), fetchLive)).data
          : await fetchLive();
      } catch {
        return;
      }
      if (cancelled) return;
      const row = (fetched.jobData ?? null) as { contacted_at?: string | null; stage_marks?: Record<string, string> | null; upstream_changed_at?: string | null; created_at?: string | null } | null;
      setStageExtras({
        contactedAt: row?.contacted_at ?? null,
        stageMarks: row?.stage_marks ?? {},
        upstreamChangedAt: row?.upstream_changed_at ?? null,
        createdAt: row?.created_at ?? null,
        photoCount: fetched.photoCount ?? 0,
        lead: fetched.leadData ? { id: (fetched.leadData as { id: string }).id } : null,
      });
    })();
    return () => { cancelled = true; };
  }, [enabled, jobId]);

  const stageResults = useMemo(
    () => (enabled ? buildJobStageResults({ job, estimate, investigation, investigatorTechId, stageExtras }) : null),
    [enabled, job, estimate, investigation, investigatorTechId, stageExtras],
  );
  return { stageResults, stageList, estimate };
}
