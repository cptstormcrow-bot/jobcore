/**
 * Assignment-board tech column (P3g.3).
 *
 * One tech's jobs for the day/week board (`03-P3-admin-finance.md` §4,
 * "A day/week board of `qualified` and `scheduled` jobs against the roster
 * of active techs"). Each job shows a local status chip styled from
 * `colors.info`/`colors.warning` — a NEW, admin-finance-local chip, not the
 * `JOB_STATUS_COLORS` constant in `apps/mobile/src/lib/job-status-colors.ts`,
 * which stays scoped to `apps/mobile` (P3g.3 keeps this module's styling
 * self-contained, same reasoning `LeadRow.tsx`'s badge already follows).
 *
 * `@jobcore/ui` has no dedicated column/list primitive, so this is composed
 * from `Card` plus plain `View`/`Text`, styled purely from `tokens.ts` — the
 * same "compose from primitives + tokens when no dedicated primitive
 * exists" rule `AxisPicker.tsx` and `LeadRow.tsx` follow. AC-11: zero raw
 * hex/rgba color literals in this file.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import type { Job } from '@jobcore/core';
import { Card, colors, spacing, radius, typography } from '@jobcore/ui';

/**
 * The tech shape this column needs. `@jobcore/core` has no dedicated `Tech`
 * type — a tech is a `Profile` with `role: 'tech'` — but this component only
 * needs an id and a display name, so it takes that narrow structural slice
 * instead of depending on the full `Profile` shape.
 */
export interface TechColumnTech {
  id: string;
  fullName: string;
}

export interface TechColumnProps {
  tech: TechColumnTech;
  jobs: Job[];
  onSelectJob?: (job: Job) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Statuses that read as "on track" for the assignment board (info chip);
 * everything else — `needs_reschedule`, `declined`, `cancelled` — reads as
 * "needs attention" (warning chip). This is a display grouping only, not a
 * gate: every status still renders, nothing is hidden or blocked.
 */
const ATTENTION_STATUSES: ReadonlySet<Job['status']> = new Set([
  'needs_reschedule',
  'declined',
  'cancelled',
]);

function chipVariant(status: Job['status']): 'info' | 'warning' {
  return ATTENTION_STATUSES.has(status) ? 'warning' : 'info';
}

function chipLabel(status: Job['status']): string {
  return status.replace(/_/g, ' ');
}

export function TechColumn({ tech, jobs, onSelectJob, style }: TechColumnProps) {
  return (
    <View style={[styles.column, style]}>
      <Text style={styles.techName}>{tech.fullName}</Text>
      {jobs.length === 0 ? (
        <Text style={styles.empty}>No jobs assigned</Text>
      ) : (
        jobs.map((job) => {
          const variant = chipVariant(job.status);
          const content = (
            <Card style={styles.jobCard}>
              <Text style={styles.jobAddress}>{job.address ?? 'No address on file'}</Text>
              <View
                style={[
                  styles.chip,
                  variant === 'warning' ? styles.chipWarning : styles.chipInfo,
                ]}
              >
                <Text style={styles.chipLabel}>{chipLabel(job.status)}</Text>
              </View>
            </Card>
          );
          return onSelectJob ? (
            <Pressable key={job.id} onPress={() => onSelectJob(job)}>
              {content}
            </Pressable>
          ) : (
            <View key={job.id}>{content}</View>
          );
        })
      )}
    </View>
  );
}

export default TechColumn;

const styles = StyleSheet.create({
  column: {
    minWidth: 220,
    paddingHorizontal: spacing.sm,
  },
  techName: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textLight,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  jobCard: {
    marginBottom: spacing.sm,
  },
  jobAddress: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipInfo: {
    backgroundColor: colors.info,
  },
  chipWarning: {
    backgroundColor: colors.warning,
  },
  chipLabel: {
    color: colors.white,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    textTransform: 'capitalize',
  },
});
