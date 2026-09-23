/**
 * Assignment board screen (P3g.5a, P3g.5b).
 *
 * `03-P3-admin-finance.md` §4: "A day/week board of `qualified` and
 * `scheduled` jobs against the roster of active techs." Renders one
 * unassigned pool plus one `TechColumn` (P3g.3) per active tech, and wires
 * the tap-to-assign interaction: tap a job in the unassigned pool to select
 * it, then tap a tech column to assign that job to that tech.
 *
 * Tap-to-assign, not drag-and-drop: React Native has no built-in
 * drag-and-drop primitive and `@jobcore/ui` adds none, so this follows the
 * same "select then act" interaction `LeadInboxScreen`/`QualifyScreen`
 * already use elsewhere in this module rather than pull in a new
 * gesture-handling dependency. Satisfies P3g.5b's "drag/tap assign
 * interaction" as the tap half of that requirement.
 *
 * Before assigning, `domain/assignment-warnings.ts`'s `warningsFor` is run
 * for the (job, tech) pair and shown via `WarningSheet` (P3g.4) — but
 * confirming ALWAYS proceeds regardless of what `warningsFor` returns
 * (warn-only, never a hard block, same rule `WarningSheet.tsx`'s own doc
 * comment states). This screen never calls `warningsFor` as a gate — only
 * to decide what to show.
 *
 * Props-in/callbacks-out: this screen never imports sqlite/fetch/Supabase
 * and never calls `flows/assign-job.ts` itself — it hands the confirmed
 * (job, techId) pair to `onAssign` and lets the caller (which holds the
 * repositories and `Ctx`) run the flow, mirroring `QualifyScreen.tsx`'s
 * handoff-to-caller pattern. `resolveServiceAreaId` is likewise a caller
 *-supplied function, since `assignment-warnings.ts`'s `serviceAreaId` is
 * caller-resolved, not a field on `Job` (see that file's own doc comment).
 *
 * Composed entirely from `@jobcore/ui` primitives plus `TechColumn`/
 * `WarningSheet`; styled purely from tokens — AC-11: zero raw hex/rgba
 * color literals in this file.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import type { Job } from '@jobcore/core';
import { isBetaVisible, isTestVisible } from '@jobcore/core';
import { Card, EmptyState, Button, Select, ListItem, Checkbox, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import type { TechColumnTech } from '../components/TechColumn';
import { WarningSheet } from '../components/WarningSheet';
import { warningsFor, type AssignmentTimeOffRequest } from '../domain/assignment-warnings';
import { candidatesFor, type TechServiceAreaCoverage } from '../domain/segway-candidates';
import { overlaps, type TimeWindow } from '../domain/time-window';

export interface AssignmentBoardScreenProps {
  /** Jobs in `qualified` or `scheduled` status — the board's whole scope. */
  jobs: Job[];
  techs: TechColumnTech[];
  /** Resolves a job's seeded `service_areas` id, or `null` if unresolved. */
  resolveServiceAreaId: (job: Job) => string | null;
  /**
   * Resolves a tech's `time_off_requests` rows (Workstream G) — caller-
   * supplied, same "screen never touches Supabase directly" rule
   * `resolveServiceAreaId` already follows. Optional so existing callers
   * that have not wired time-off data keep working unchanged (availability
   * then renders as "all available").
   */
  resolveTimeOffForTech?: (techId: string) => AssignmentTimeOffRequest[];
  /**
   * All `tech_service_areas` coverage rows for the org (P3 §3,
   * `domain/segway-candidates.ts`'s `candidatesFor`) — caller-supplied, same
   * "screen never touches Supabase directly" rule `resolveServiceAreaId`/
   * `resolveTimeOffForTech` already follow. Optional so existing callers
   * that have not wired coverage data keep working unchanged (every tech
   * then renders as covered, no chip).
   */
  techServiceAreas?: TechServiceAreaCoverage[];
  /** Fired once the assignment is confirmed (warnings shown, never blocking). */
  onAssign?: (job: Job, techId: string) => void;
  /** Fired to assign a prem-visit investigator tech to a job (AD-32). */
  onAssignInvestigator?: (job: Job, techId: string) => void;
  investigatorTechIdByJob?: Record<string, string>;
  /** Fired to clear a job's assigned tech (AD-34). */
  onUnassign?: (job: Job) => void;
  /** Fired when an admin toggles a tech's "Assign only to Test Jobs" flag (AD-35). */
  onToggleTestJobsOnly?: (techId: string, next: boolean) => void;
  /**
   * Workstream K: "Show Test Jobs" toggle, default OFF — hides jobs.is_beta
   * rows spawned by sales-marketing's "Spawn Test Jobs" flow. Lifted to the
   * caller (`AdminFinanceRoot`) so the value survives this screen unmounting
   * on a `subView` switch.
   */
  showTestJobs: boolean;
  /**
   * "Show Test Employees" toggle, default OFF — hides profiles.is_test rows
   * via `isTestVisible`, mirroring `showTestJobs`/`isBetaVisible` above. Also
   * lifted to the caller for the same unmount-survival reason.
   */
  showTestEmployees: boolean;
  onSelectEmployee?: (techId: string) => void;
}

interface PendingAssignment {
  job: Job;
  tech: TechColumnTech;
}

export function jobCategoryOf(job: Pick<Job, 'isBeta' | 'source'>): 'real' | 'beta' | 'test' {
  return job.source === 'job-simulator' ? 'test' : job.isBeta ? 'beta' : 'real';
}

export function AssignmentBoardScreen({
  jobs,
  techs,
  resolveServiceAreaId,
  resolveTimeOffForTech,
  techServiceAreas,
  onAssign,
  onAssignInvestigator,
  investigatorTechIdByJob,
  onUnassign,
  onToggleTestJobsOnly,
  showTestJobs,
  showTestEmployees,
  onSelectEmployee,
}: AssignmentBoardScreenProps) {
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAssignment | null>(null);
  const [category, setCategory] = useState<'real' | 'beta' | 'test' | 'all'>('real');
  useEffect(() => { if (!showTestJobs) setCategory('real'); }, [showTestJobs]);
  const [visitKind, setVisitKind] = useState<Record<string, 'service' | 'prem'>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});

  const visibleTechs = useMemo(
    () => techs.filter((tech) => isTestVisible(tech, showTestEmployees)),
    [techs, showTestEmployees]
  );

  const techById = useMemo(() => new Map(techs.map((t) => [t.id, t])), [techs]);

  const poolJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          isBetaVisible(job, showTestJobs) &&
          (category === 'all' || jobCategoryOf(job) === category)
      ),
    [jobs, showTestJobs, category]
  );

  const jobsByTech = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const tech of visibleTechs) {
      map.set(
        tech.id,
        jobs.filter((job) => job.assignedTechId === tech.id && isBetaVisible(job, showTestJobs))
      );
    }
    return map;
  }, [jobs, visibleTechs, showTestJobs]);

  const premVisitCountByTech = useMemo(() => {
    const map = new Map<string, number>();
    for (const techId of Object.values(investigatorTechIdByJob ?? {})) {
      map.set(techId, (map.get(techId) ?? 0) + 1);
    }
    return map;
  }, [investigatorTechIdByJob]);

  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null;

  /**
   * Availability (Workstream G) is computed against the SELECTED job's
   * window only — the board has no other notion of "the job's window"
   * until a job is chosen from the unassigned pool, mirroring how
   * `pendingWarnings` below is likewise only meaningful once a job is
   * selected. Techs render with `isAvailable: undefined` (no chip) when no
   * job is selected or `resolveTimeOffForTech` was not supplied.
   */
  const techsWithAvailability: TechColumnTech[] = useMemo(() => {
    let result = visibleTechs;

    if (selectedJob && selectedJob.scheduledStart && selectedJob.scheduledEnd && resolveTimeOffForTech) {
      const window: TimeWindow = { start: selectedJob.scheduledStart, end: selectedJob.scheduledEnd };
      result = result.map((tech) => {
        const requests = resolveTimeOffForTech(tech.id);
        const hasApprovedConflict = requests.some(
          (request) =>
            request.status === 'approved' && overlaps(window, { start: request.startDate, end: request.endDate }),
        );
        return { ...tech, isAvailable: !hasApprovedConflict };
      });
    }

    if (selectedJob && techServiceAreas) {
      const candidates = candidatesFor(
        result.map((tech) => tech.id),
        resolveServiceAreaId(selectedJob),
        techServiceAreas,
      );
      const coverageByTechId = new Map(candidates.map((c) => [c.techId, c.coversServiceArea]));
      result = result.map((tech) => ({
        ...tech,
        coversServiceArea: coverageByTechId.get(tech.id),
      }));
    }

    return result;
  }, [selectedJob, visibleTechs, resolveTimeOffForTech, techServiceAreas, resolveServiceAreaId]);

  const availableCount = useMemo(
    () => techsWithAvailability.filter((tech) => tech.isAvailable !== false).length,
    [techsWithAvailability],
  );
  const showAvailabilitySummary = selectedJob !== null && Boolean(resolveTimeOffForTech);

  function handleSelectUnassignedJob(job: Job) {
    setSelectedJobId(job.id === selectedJobId ? null : job.id);
  }

  function handleSelectTech(tech: TechColumnTech) {
    if (!selectedJob) {
      return;
    }
    setPending({ job: selectedJob, tech });
  }

  function handleConfirm() {
    if (!pending || !onAssign) {
      setPending(null);
      setSelectedJobId(null);
      return;
    }
    onAssign(pending.job, pending.tech.id);
    setPending(null);
    setSelectedJobId(null);
  }

  function handleCancelWarning() {
    setPending(null);
  }

  function confirmDialog(title: string, body: string, onPress: () => void, onCancel?: () => void) {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${body}`)) {
        onPress();
      } else {
        onCancel?.();
      }
    } else {
      Alert.alert(title, body, [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Yes', onPress },
      ]);
    }
  }

  function eligibleTechs(job: Job): TechColumnTech[] {
    return techsWithAvailability.filter((t) => jobCategoryOf(job) !== 'real' || !t.testJobsOnly);
  }

  function handleRowConfirm(job: Job) {
    const techId = choice[job.id];
    if (techId === undefined) {
      return;
    }
    if (techId === '') {
      confirmDialog(
        'Unassign job?',
        'Remove the assigned tech from this job?',
        () => {
          onUnassign?.(job);
          setChoice((prev) => {
            const next = { ...prev };
            delete next[job.id];
            return next;
          });
        },
        () => {
          setChoice((prev) => {
            const next = { ...prev };
            delete next[job.id];
            return next;
          });
        },
      );
      return;
    }
    const tech = eligibleTechs(job).find((t) => t.id === techId);
    if (!tech) {
      return;
    }
    if (visitKind[job.id] === 'prem') {
      confirmDialog(
        'Assign Prem?',
        `Assign ${tech.fullName} to the Prem for this job?`,
        () => {
          onAssignInvestigator?.(job, techId);
          setChoice((prev) => {
            const next = { ...prev };
            delete next[job.id];
            return next;
          });
        },
        () => {
          setChoice((prev) => {
            const next = { ...prev };
            delete next[job.id];
            return next;
          });
        },
      );
      return;
    }
    setPending({ job, tech });
    setChoice((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });
  }

  const pendingWarnings = pending
    ? warningsFor(
        pending.job,
        jobsByTech.get(pending.tech.id) ?? [],
        resolveServiceAreaId(pending.job),
        resolveTimeOffForTech ? resolveTimeOffForTech(pending.tech.id) : [],
        pending.tech.id,
        techServiceAreas ?? [],
      )
    : [];

  if (jobs.length === 0 && visibleTechs.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Assignment board" message="No jobs or techs to show." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.poolCard}>
          <Text style={styles.poolTitle}>Jobs</Text>
          <View style={styles.categorySegmentRow}>
            {(showTestJobs ? (['real', 'beta', 'test', 'all'] as const) : (['real'] as const)).map((cat) => (
              <Button
                key={cat}
                label={cat === 'real' ? 'Real' : cat === 'beta' ? 'Beta' : cat === 'test' ? 'Test' : 'All'}
                variant={category === cat ? 'primary' : 'outline'}
                size="sm"
                onPress={() => setCategory(cat)}
              />
            ))}
          </View>
          {poolJobs.length === 0 ? (
            <Text style={styles.empty}>No unassigned jobs.</Text>
          ) : (
            poolJobs.map((job) => {
              const selected = job.id === selectedJobId;
              const kind = visitKind[job.id] ?? 'service';
              const premTechId = investigatorTechIdByJob?.[job.id];
              return (
                <Pressable key={job.id} onPress={() => handleSelectUnassignedJob(job)}>
                  <View style={[styles.poolRow, selected ? styles.poolRowSelected : null]}>
                    <View style={styles.poolRowInfo}>
                      <Text style={styles.poolRowText}>{job.address ?? 'No address on file'}</Text>
                      <Text style={styles.poolRowStatus}>{job.status.replace(/_/g, ' ')}</Text>
                      <Text style={styles.assignedLine}>{job.assignedTechId ? [techById.get(job.assignedTechId)?.fullName ?? 'Unknown tech', techById.get(job.assignedTechId)?.phone ?? 'No phone'].join(' · ') : premTechId ? [techById.get(premTechId)?.fullName ?? 'Unknown tech', techById.get(premTechId)?.phone ?? 'No phone'].join(' · ') : 'Unassigned'}</Text>
                      {job.assignedTechId && premTechId ? (
                        <Text style={styles.assignedLine}>Prem: {[techById.get(premTechId)?.fullName ?? 'Unknown tech', techById.get(premTechId)?.phone ?? 'No phone'].join(' · ')}</Text>
                      ) : null}
                    </View>
                    <View style={styles.visitKindSegmentRow}>
                      <Button
                        label="Service"
                        variant={kind === 'service' ? 'primary' : 'outline'}
                        size="sm"
                        onPress={() => setVisitKind((prev) => ({ ...prev, [job.id]: 'service' }))}
                      />
                      <Button
                        label="Prem"
                        variant={kind === 'prem' ? 'primary' : 'outline'}
                        size="sm"
                        onPress={() => setVisitKind((prev) => ({ ...prev, [job.id]: 'prem' }))}
                      />
                    </View>
                    {/* Own Pressable (via Button/Select) so RN's nested-touch-responder
                        priority keeps this tap from also firing the row's
                        select-for-assignment Pressable above. */}
                    <Select
                      options={[
                        { label: 'Unassigned', value: '' },
                        ...eligibleTechs(job).map((t) => ({ label: t.fullName, value: t.id })),
                      ]}
                      value={choice[job.id] ?? job.assignedTechId ?? ''}
                      onChange={(v) => setChoice((prev) => ({ ...prev, [job.id]: v }))}
                      style={styles.assignSelect}
                    />
                    {job.id in choice && choice[job.id] !== (job.assignedTechId ?? '') && (
                      <Button
                        label="Confirm"
                        variant="primary"
                        size="sm"
                        onPress={() => handleRowConfirm(job)}
                      />
                    )}
                    <Button
                      label="View"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push('/job/' + job.id)}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
          {selectedJob && (
            <Text style={styles.hint}>Tap a tech below to assign this job.</Text>
          )}
        </Card>

        {showAvailabilitySummary ? (
          <Text style={styles.availabilitySummary}>
            {availableCount} of {techsWithAvailability.length} techs available
          </Text>
        ) : null}

        <Card>
          <Text style={styles.poolTitle}>Employees</Text>
          {visibleTechs.map((tech) => (
            <ListItem
              key={tech.id}
              title={tech.fullName}
              subtitle={`Jobs Assigned: ${jobsByTech.get(tech.id)?.length ?? 0} · Prems: ${premVisitCountByTech.get(tech.id) ?? 0}`}
              onPress={() => onSelectEmployee?.(tech.id)}
              right={
                <Checkbox
                  label="Assign only to Test Jobs"
                  checked={!!tech.testJobsOnly}
                  onChange={(next) => onToggleTestJobsOnly?.(tech.id, next)}
                />
              }
            />
          ))}
        </Card>
      </ScrollView>

      <WarningSheet
        visible={pending !== null}
        warnings={pendingWarnings}
        onConfirm={handleConfirm}
        onCancel={handleCancelWarning}
      />
    </View>
  );
}

export default AssignmentBoardScreen;

/** Renders when no board data is supplied — mirrors `QualifyScreenEmpty`'s no-data-source guard. */
export function AssignmentBoardScreenEmpty() {
  return (
    <View style={styles.screen}>
      <EmptyState title="Assignment board" message="No jobs or techs to show." />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  poolCard: {
    marginBottom: spacing.md,
  },
  poolTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textLight,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  categorySegmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  visitKindSegmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginRight: spacing.sm,
  },
  poolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  poolRowSelected: {
    backgroundColor: colors.info,
  },
  poolRowInfo: {
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  poolRowText: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  assignSelect: {
    width: 140,
    marginRight: spacing.sm,
  },
  poolRowStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
  },
  assignedLine: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  availabilitySummary: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  board: {
    flexDirection: 'row',
  },
  column: {
    marginRight: spacing.md,
  },
});
