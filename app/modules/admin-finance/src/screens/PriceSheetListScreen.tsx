// JobCore screen #0019 - af-priceSheetList - Price Sheets
/**
 * Price sheet list screen — list query (P3i.3a).
 *
 * List-query scope ONLY: reads `session.org.id` via `getModuleSession`
 * (mirrors `AdminFinanceRoot.tsx`), then queries
 * `PriceSheetRepository.listForOrganization` for every price sheet
 * belonging to the organization, in any status, and renders a flat list.
 *
 * P3i.3b implements draft / published / archived GROUPING: sheets are
 * partitioned by the DOMAIN value of `sheet.status` (`'draft' | 'published' |
 * 'archived'` — `../money/types.ts`'s `PriceSheetStatus`), rendered as
 * Published → Draft → Archived, one `<Card>` per non-empty group. The
 * ledger's "superseded" is DB-only vocabulary; `DB_TO_APP_STATUS`
 * (`../data/price-sheet-repo.ts`) already translates it to `'archived'`
 * before a row reaches this screen, so `'superseded'` never appears here.
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

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, ScrollView, StyleSheet } from 'react-native';
import { PayrollButton, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { PriceSheet, PriceSheetStatus } from '../money/types';
import type { PriceSheetRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface PriceSheetListScreenProps {
  priceSheets?: PriceSheetRepository;
  /** Fired when a sheet row is selected, mirrors `LeadInboxScreen.tsx`'s `onSelectLead`. */
  onSelectSheet?: (sheet: PriceSheet) => void;
  /** Fired when the "create new price sheet" action is pressed. Optional/no-op-safe. */
  onCreateNew?: () => void;
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
  const { priceSheets: priceSheetRepository, onSelectSheet, onCreateNew } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !priceSheetRepository) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    priceSheetRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
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
  }, [session, priceSheetRepository, rev]);

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
        {onCreateNew && (
          <PayrollButton label="Create price sheet" onPress={onCreateNew} style={styles.createButton} />
        )}
      </View>
    );
  }

  const groups: Array<{ status: PriceSheetStatus; label: string }> = [
    { status: 'published', label: 'Published' },
    { status: 'draft', label: 'Drafts' },
    { status: 'archived', label: 'Archived' },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Price Sheets" />
        {onCreateNew && (
          <View style={styles.toolbar}>
            <PayrollButton label="Create price sheet" onPress={onCreateNew} />
          </View>
        )}
        {groups.map(({ status, label }) => {
          const sheetsInGroup = loadState.sheets.filter((sheet) => sheet.status === status);
          if (sheetsInGroup.length === 0) {
            return null;
          }
          return (
            <View key={status} style={styles.group}>
              <Text style={styles.groupHeading}>{label}</Text>
              <Card style={styles.card}>
                {sheetsInGroup.map((sheet) => (
                  <ListItem
                    key={sheet.id}
                    title={`Version ${sheet.version}`}
                    subtitle={formatDate(sheet.publishedAt)}
                    onPress={onSelectSheet ? () => onSelectSheet(sheet) : undefined}
                  />
                ))}
              </Card>
            </View>
          );
        })}
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
  group: {
    marginBottom: spacing.md,
  },
  groupHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  toolbar: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  createButton: {
    marginTop: spacing.md,
  },
});
