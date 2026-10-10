// JobCore screen #0053 - af-priceSheetCreate - New Price Sheet
/**
 * Price sheet create screen.
 *
 * Mirrors `LeadCreateScreen.tsx`'s props-in/callbacks-out pattern
 * (`onCreated`/`onCancel`), form-state handling via `React.useState`, and
 * submit-handler flow that calls the repository through `getModulePorts()`.
 *
 * Resolves `organizationId` via `getModuleSession()` (same session-getter
 * `LeadCreateScreen.tsx` uses) and the `PriceSheetRepository` via
 * `getModulePorts().priceSheets` (`../lib/module-ports.ts`). Builds a
 * `PriceSheetDraft` (`../data/ports.ts` — `Omit<PriceSheet, 'id' | 'status'
 * | 'publishedAt'>`, i.e. `organizationId` + `version`) from local form
 * state and calls `priceSheets.create`.
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, Button, EmptyState, colors, spacing, typography, Text } from '@jobcore/ui';
import type { PriceSheetDraft } from '../data/ports';
import type { PriceSheet } from '../money/types';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

export interface PriceSheetCreateScreenProps {
  onCreated?: (priceSheet: PriceSheet) => void;
  onCancel?: () => void;
}

export function PriceSheetCreateScreen({ onCreated, onCancel }: PriceSheetCreateScreenProps) {
  const session = getModuleSession();
  const { priceSheets } = getModulePorts();

  const [version, setVersion] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="New price sheet" message="Sign in to create a price sheet." />
      </View>
    );
  }

  const parsedVersion = Number(version);
  const canSubmit = version.trim().length > 0 && Number.isFinite(parsedVersion) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !session) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const draft: PriceSheetDraft = {
        organizationId: session.org.id,
        version: parsedVersion,
      };
      const priceSheet = await priceSheets.create(draft);
      onCreated?.(priceSheet);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create the price sheet.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>New price sheet</Text>

          <Text style={styles.label}>Version</Text>
          <TextInput
            style={styles.input}
            value={version}
            onChangeText={setVersion}
            placeholder="Version number"
            placeholderTextColor={colors.textLight}
            keyboardType="numeric"
          />

          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          <View style={styles.actions}>
            {onCancel && <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />}
            <Button
              label={submitting ? 'Creating...' : 'Create price sheet'}
              onPress={() => {
                void handleSubmit();
              }}
              disabled={!canSubmit}
              style={styles.action}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

export default PriceSheetCreateScreen;

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
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  action: {
    marginLeft: spacing.sm,
  },
});
