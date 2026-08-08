/**
 * Price sheet list screen — list query (P3i.3a).
 *
 * List-query scope ONLY: reads `session.org.id` via `getModuleSession`
 * (mirrors `AdminFinanceRoot.tsx`), then queries
 * `PriceSheetRepository.listForOrganization` for every price sheet
 * belonging to the organization, in any status, and renders a flat list.
 *
 * Draft / published / superseded GROUPING is explicitly OUT OF SCOPE here —
 * that is P3i.3b. This screen never partitions `priceSheets` by `status`
 * and never assumes an ordering; it renders whatever
 * `listForOrganization` returns, in the order returned.
 *
 * Consumes the existing `PriceSheetRepository` read port (`../data/ports.ts`)
 * — not `price-sheet-repo.ts`'s publish-oriented `PriceSheetRepo`, which is
 * unrelated to a listing screen and still carries an unimplemented publish
 * write path (P3i.2b). No new data seam is introduced.
 *
 * Optional-props + honest-empty-view pattern, idle/loading/loaded/failed
 * state machine, and `formatDate` all mirror `AdminFinanceRoot.tsx`'s
 * `jobs` load exactly, so the two screens stay consistent.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, colors, spacing } from '@jobcore/ui';
import type { PriceSheet } from '../money/types';
import type { PriceSheetRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface PriceSheetListScreenProps {
  priceSheets?: PriceSheetRepository;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; sheets: PriceSheet[] }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not published';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not published';
  return parsed.toLocaleDateString();
}

export function PriceSheetListScreen(props: PriceSheetListScreenProps = {}) {
  const { priceSheets: priceSheetRepository } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !priceSheetRepository) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    priceSheetRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', sheets: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load price sheets.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, priceSheetRepository]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheets"
          message="Sign in to view this organization's price sheets."
        />
      </View>
    );
  }

  if (!priceSheetRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheets"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading price sheets..." />
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

  if (loadState.sheets.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Sheets" message="This organization has no price sheets on file." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          {loadState.sheets.map((sheet) => (
            <ListItem
              key={sheet.id}
              title={`Version ${sheet.version} — ${sheet.status}`}
              subtitle={formatDate(sheet.publishedAt)}
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

export default PriceSheetListScreen;

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
});
