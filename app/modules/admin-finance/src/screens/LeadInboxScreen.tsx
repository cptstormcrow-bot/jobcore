// JobCore screen #0014 - af-leadInbox - Leads
/**
 * Lead inbox screen (P3e.5).
 *
 * Props-in / callbacks-out against `../data/ports.ts`'s `LeadRepository` —
 * the host app injects the concrete repository as a prop; this screen never
 * imports sqlite/fetch/Supabase directly. Mirrors `AdminFinanceRoot.tsx`'s
 * session seam (`getModuleSession`) and `LoadState` discriminated-union
 * pattern.
 *
 * Shows unconverted leads, newest first (`selectInboxLeads`, P3d domain).
 * Never filters by readiness: a `needs_info` lead is first-class and must
 * render like any other row, badge included (P3e.6b, `03-P3-admin-finance.md`
 * lines 48-53).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing } from '@jobcore/ui';
import type { Lead } from '../domain/lead';
import { selectInboxLeads } from '../domain/lead-inbox';
import type { LeadRepository } from '../data/ports';
import { LeadRow } from '../components/LeadRow';
import { getModuleSession } from '../lib/module-session';

export interface LeadInboxScreenProps {
  leads?: LeadRepository;
  onSelectLead?: (lead: Lead) => void;
  onCreateLead?: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; leads: Lead[] }
  | { kind: 'failed'; message: string };

export function LeadInboxScreen({ leads: leadRepository, onSelectLead, onCreateLead }: LeadInboxScreenProps = {}) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !leadRepository) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    leadRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) { hasLoadedRef.current = true; setLoadState({ kind: 'loaded', leads: result }); }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load leads.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, leadRepository, rev]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Leads" message="Sign in to view this organization's leads." />
      </View>
    );
  }

  if (!leadRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Leads" message="No data source is connected for this module yet." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading leads..." />
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

  const inboxLeads = selectInboxLeads(loadState.leads);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Leads" />
        <Button label="New Lead" onPress={() => onCreateLead?.()} disabled={!onCreateLead} style={styles.action} />
        {inboxLeads.length === 0 ? (
          <EmptyState title="No leads" message="This organization has no unconverted leads." />
        ) : (
          <Card style={styles.card}>
            {inboxLeads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} onPress={onSelectLead} />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default LeadInboxScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.xs,
  },
});
