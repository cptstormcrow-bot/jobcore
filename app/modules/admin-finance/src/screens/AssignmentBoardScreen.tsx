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

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { Job } from '@jobcore/core';
import { Card, EmptyState, colors, spacing, radius, typography } from '@jobcore/ui';
import { TechColumn, type TechColumnTech } from '../components/TechColumn';
import { WarningSheet } from '../components/WarningSheet';
import { warningsFor } from '../domain/assignment-warnings';

export interface AssignmentBoardScreenProps {
  /** Jobs in `qualified` or `scheduled` status — the board's whole scope. */
  jobs: Job[];
  techs: TechColumnTech[];
  /** Resolves a job's seeded `service_areas` id, or `null` if unresolved. */
  resolveServiceAreaId: (job: Job) => string | null;
  /** Fired once the assignment is confirmed (warnings shown, never blocking). */
  onAssign?: (job: Job, techId: string) => void;
}

interface PendingAssignment {
  job: Job;
  tech: TechColumnTech;
}

export function AssignmentBoardScreen({
  jobs,
  techs,
  resolveServiceAreaId,
  onAssign,
}: AssignmentBoardScreenProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAssignment | null>(null);

  const unassignedJobs = useMemo(() => jobs.filter((job) => !job.assignedTechId), [jobs]);

  const jobsByTech = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const tech of techs) {
      map.set(
        tech.id,
        jobs.filter((job) => job.assignedTechId === tech.id)
      );
    }
    return map;
  }, [jobs, techs]);

  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null;

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

  const pendingWarnings = pending
    ? warningsFor(pending.job, jobsByTech.get(pending.tech.id) ?? [], resolveServiceAreaId(pending.job))
    : [];

  if (jobs.length === 0 && techs.length === 0) {
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
          <Text style={styles.poolTitle}>Unassigned</Text>
          {unassignedJobs.length === 0 ? (
            <Text style={styles.empty}>No unassigned jobs.</Text>
          ) : (
            unassignedJobs.map((job) => {
              const selected = job.id === selectedJobId;
              return (
                <Pressable key={job.id} onPress={() => handleSelectUnassignedJob(job)}>
                  <View style={[styles.poolRow, selected ? styles.poolRowSelected : null]}>
                    <Text style={styles.poolRowText}>{job.address ?? 'No address on file'}</Text>
                    <Text style={styles.poolRowStatus}>{job.status.replace(/_/g, ' ')}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
          {selectedJob && (
            <Text style={styles.hint}>Tap a tech below to assign this job.</Text>
          )}
        </Card>

        <ScrollView horizontal contentContainerStyle={styles.board}>
          {techs.map((tech) => (
            <Pressable key={tech.id} onPress={() => handleSelectTech(tech)}>
              <TechColumn tech={tech} jobs={jobsByTech.get(tech.id) ?? []} style={styles.column} />
            </Pressable>
          ))}
        </ScrollView>
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
  poolRowText: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  poolRowStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  board: {
    flexDirection: 'row',
  },
  column: {
    marginRight: spacing.md,
  },
});
