/**
 * Audit log screen (P7 Slice B).
 *
 * Props-in / callbacks-out against `../data/ports.ts`'s `AuditLogRepository`
 * — the host app injects the concrete repository as a prop; this screen
 * never imports sqlite/fetch/Supabase directly. Mirrors `LeadInboxScreen.tsx`'s
 * session seam (`getModuleSession`) and `LoadState` discriminated-union
 * pattern.
 *
 * Read-only: lists audit log entries for the org, newest first, with an
 * optional `entity`/`action` filter passed straight through to the
 * repository. No CSV export, no pagination — out of scope for this slice.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing } from '@jobcore/ui';
import type { AuditLogEntry, AuditLogFilter, AuditLogRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface AuditLogScreenProps {
  auditLog?: AuditLogRepository;
  filter?: AuditLogFilter;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: AuditLogEntry[] }
  | { kind: 'failed'; message: string };

export function AuditLogScreen({ auditLog: auditLogRepository, filter }: AuditLogScreenProps = {}) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const session = getModuleSession();

  useEffect(() => {
    if (!session || !auditLogRepository) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    auditLogRepository
      .listForOrganization(session.org.id, filter)
      .then((result) => {
        if (!cancelled) setLoadState({ kind: 'loaded', entries: result });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the audit log.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, auditLogRepository, filter]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Audit log" message="Sign in to view this organization's audit log." />
      </View>
    );
  }

  if (!auditLogRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Audit log" message="No data source is connected for this module yet." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading audit log..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  const entries = [...loadState.entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Audit Log" />
      <ScrollView contentContainerStyle={styles.content}>
        {entries.length === 0 ? (
          <EmptyState title="No audit entries" message="Nothing has been recorded for this organization yet." />
        ) : (
          <Card style={styles.card}>
            {entries.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <Text style={styles.action}>{entry.action}</Text>
                <Text style={styles.detail}>
                  {entry.entity} · {entry.entityId}
                </Text>
                <Text style={styles.detail}>{entry.actorId ?? 'system'}</Text>
                <Text style={styles.timestamp}>{entry.createdAt}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default AuditLogScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  action: {
    fontWeight: '600',
  },
  detail: {
    color: colors.textLight,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
