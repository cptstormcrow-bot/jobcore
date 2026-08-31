/**
 * DayList screen for the field-tech module (P4.S3.2).
 *
 * Renders the signed-in tech's jobs for the day. Scoping is PURELY via
 * Supabase RLS — this screen does NOT add any client-side role/tech filter
 * on top of the query. `TechJobRepository.listAssignedToTech` is called
 * with the session's own `userId`; RLS on the `jobs`/`job_assignments`
 * tables (see `0007_field_tech_tables.sql` comments referenced in
 * `data/ports.ts`) is what actually restricts the result set to jobs
 * assigned to this tech. Ties to spec AC1, VS1.
 *
 * Mirrors `modules/admin-finance/src` layering: screen reads session +
 * ports via the module seams, never constructs a repository itself.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { JOB_STATUS_COLORS, Toggle, ScreenTitle } from '@jobcore/ui';

/** Props for `DayList`. */
export interface DayListProps {
  /**
   * Optional row-selection callback. When provided, each job row becomes
   * pressable and invokes this with the tapped job. When omitted, rows
   * remain non-interactive — no behavior change for existing callers.
   */
  onSelectJob?: (job: Job) => void;
}

export function DayList({ onSelectJob }: DayListProps = {}): React.ReactElement {
  const session = getModuleSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Workstream K: "Show Test Jobs" toggle, default OFF — hides jobs.is_beta
  // rows spawned by sales-marketing's "Spawn Test Jobs" flow.
  const [showBeta, setShowBeta] = useState(false);
  const visibleJobs = jobs.filter((job) => isBetaVisible(job, showBeta));

  useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const { jobs: jobsRepository } = getModulePorts();

    jobsRepository
      .listAssignedToTech(session.userId)
      .then((result: Job[]) => {
        if (!cancelled) {
          setJobs(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (session === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to see your jobs.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.listContent}>
      <ScreenTitle title="Today's Jobs" />
      <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
      {visibleJobs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No jobs scheduled.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleJobs}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => {
            const rowContent = (
              <View style={styles.row}>
                <View style={[styles.statusChip, { backgroundColor: JOB_STATUS_COLORS[item.status] }]} />
                <View style={styles.rowBody}>
                  <Text style={styles.address}>{item.address ?? 'No address'}</Text>
                  <Text style={styles.window}>{item.requestedWindow ?? item.scheduledStart ?? 'Unscheduled'}</Text>
                </View>
              </View>
            );

            if (onSelectJob === undefined) {
              return rowContent;
            }

            return <Pressable onPress={() => onSelectJob(item)}>{rowContent}</Pressable>;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#666',
  },
  errorText: {
    color: '#b00020',
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  statusChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  address: {
    fontSize: 16,
    fontWeight: '600',
  },
  window: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});
