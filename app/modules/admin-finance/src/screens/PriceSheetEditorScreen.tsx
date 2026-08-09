/**
 * Price sheet editor screen — form scaffold (P3i.4a).
 *
 * Scaffold scope ONLY. Reads `session.org.id` via `getModuleSession`, loads the
 * organization's price sheets through the read-only `PriceSheetRepository`
 * port (`../data/ports.ts`), selects the one matching `priceSheetId`, and
 * renders its version, status and published date as READ-ONLY fields.
 *
 * Explicitly NOT in scope at P3i.4a:
 * - Save / publish wiring. That is P3i.4b; this screen performs no writes and
 *   never touches `price-sheet-repo.ts`'s publish port.
 * - Rate rows. `PriceSheetRepository` (the read port) exposes only
 *   `listForOrganization` and `getActive` — there is no rates method to call,
 *   so rate editing cannot be scaffolded honestly here.
 *
 * Status is displayed in the DOMAIN vocabulary (`'draft' | 'published' |
 * 'archived'` — `../money/types.ts`'s `PriceSheetStatus`). The DB's
 * "superseded" is already translated to `'archived'` by `DB_TO_APP_STATUS`
 * before a row reaches this screen, so it never appears here.
 *
 * Optional-props + honest-empty-view pattern, idle/loading/loaded/failed state
 * machine, and `formatDate` all mirror `PriceSheetListScreen.tsx` exactly so
 * the two screens stay consistent.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, colors, spacing, typography } from '@jobcore/ui';
import type { PriceSheet, PriceSheetStatus } from '../money/types';
import type { PriceSheetRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface PriceSheetEditorScreenProps {
  priceSheets?: PriceSheetRepository;
  priceSheetId?: string;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; sheet: PriceSheet | null }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not published';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not published';
  return parsed.toLocaleDateString();
}

/** Domain status → display label. No DB vocabulary reaches this screen. */
const STATUS_LABEL: Record<PriceSheetStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export function PriceSheetEditorScreen(props: PriceSheetEditorScreenProps = {}) {
  const { priceSheets: priceSheetRepository, priceSheetId } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !priceSheetRepository || !priceSheetId) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    priceSheetRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          const match = result.find((sheet) => sheet.id === priceSheetId) ?? null;
          setLoadState({ kind: 'loaded', sheet: match });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the price sheet.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, priceSheetRepository, priceSheetId]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheet"
          message="Sign in to view this organization's price sheets."
        />
      </View>
    );
  }

  if (!priceSheetRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheet"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (!priceSheetId) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Sheet" message="No price sheet was selected." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading price sheet..." />
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

  if (!loadState.sheet) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Sheet" message="That price sheet was not found." />
      </View>
    );
  }

  const sheet = loadState.sheet;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Price Sheet</Text>
        <Card style={styles.card}>
          <ListItem title="Version" subtitle={String(sheet.version)} />
          <ListItem title="Status" subtitle={STATUS_LABEL[sheet.status]} />
          <ListItem title="Published" subtitle={formatDate(sheet.publishedAt)} />
        </Card>
        <Text style={styles.note}>
          Rate rows and editing are not available yet. Saving and publishing arrive in a later slice.
        </Text>
      </ScrollView>
    </View>
  );
}

export default PriceSheetEditorScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
});
