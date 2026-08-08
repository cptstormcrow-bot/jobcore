/**
 * Qualify screen (P3f.4).
 *
 * `03-P3-admin-finance.md` §3: Qualify confirms the three axis fields
 * (source, payer, attach_timing) on a lead before it becomes a job. This
 * screen lets staff pick/correct those three fields via `AxisPicker`
 * (P3f.3), shows exactly which required field(s) are still missing (mirrors
 * `LeadInboxScreen.tsx`'s "never hide a gap" rule), and disables Submit
 * until the lead — merged with the staff's axis picks — is qualify-ready.
 *
 * "Qualify-ready" here is `domain/qualify.ts`'s `validateQualify` (AC:
 * `classifyLead(lead) !== 'needs_info'`, i.e. `preferredDate` + `address`
 * present) AND all three axis fields selected — the axis fields are this
 * screen's whole reason to exist, so leaving one unpicked must also block
 * Submit even though `validateQualify` itself does not check them.
 *
 * Props-in/callbacks-out: this screen never imports sqlite/fetch/Supabase,
 * never calls `flows/qualify-lead.ts` itself, and never touches
 * `JobRepository`/`LeadRepository` directly — it hands the confirmed axis
 * selections to `onSubmit` and lets the caller (which holds the repositories
 * and `Ctx`) run the flow. Composed entirely from `@jobcore/ui` primitives
 * plus `AxisPicker`; styled purely from tokens — AC-11: zero raw hex/rgba
 * color literals in this file.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, Button, EmptyState, colors, spacing, typography } from '@jobcore/ui';
import type { Lead } from '../domain/lead';
import { validateQualify } from '../domain/qualify';
import {
  AxisPicker,
  SOURCE_VALUES,
  PAYER_VALUES,
  ATTACH_TIMING_VALUES,
  type SourceValue,
  type PayerValue,
  type AttachTimingValue,
} from '../components/AxisPicker';

export interface QualifyAxisSelection {
  source: SourceValue;
  payer: PayerValue;
  attachTiming: AttachTimingValue;
}

export interface QualifyScreenProps {
  lead: Lead;
  onSubmit?: (selection: QualifyAxisSelection) => void;
  onCancel?: () => void;
}

function asAxisValue<T extends string>(values: readonly T[], value: string | null): T | null {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function QualifyScreen({ lead, onSubmit, onCancel }: QualifyScreenProps) {
  const [source, setSource] = useState<SourceValue | null>(() => asAxisValue(SOURCE_VALUES, lead.source));
  const [payer, setPayer] = useState<PayerValue | null>(() => asAxisValue(PAYER_VALUES, lead.payer));
  const [attachTiming, setAttachTiming] = useState<AttachTimingValue | null>(() =>
    asAxisValue(ATTACH_TIMING_VALUES, lead.attachTiming)
  );

  const validation = useMemo(
    () =>
      validateQualify({
        ...lead,
        source,
        payer,
        attachTiming,
      }),
    [lead, source, payer, attachTiming]
  );

  const axesSelected = source !== null && payer !== null && attachTiming !== null;
  const canSubmit = validation.valid && axesSelected;

  const blockingReasons = [
    ...validation.reasons,
    ...(source === null ? ['Missing required field: source'] : []),
    ...(payer === null ? ['Missing required field: payer'] : []),
    ...(attachTiming === null ? ['Missing required field: attach_timing'] : []),
  ];

  function handleSubmit() {
    if (!canSubmit || !onSubmit) {
      return;
    }
    onSubmit({ source, payer, attachTiming } as QualifyAxisSelection);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Qualify lead</Text>
          <Text style={styles.subtitle}>{lead.name}</Text>

          {lead.address ? (
            <Text style={styles.meta}>{lead.address}</Text>
          ) : (
            <Text style={styles.metaWarning}>Address unknown</Text>
          )}
          {lead.preferredDate ? (
            <Text style={styles.meta}>
              Requested: {lead.preferredDate}
              {lead.preferredTime ? ` ${lead.preferredTime}` : ''}
            </Text>
          ) : (
            <Text style={styles.metaWarning}>No requested date</Text>
          )}

          <AxisPicker label="Source" values={SOURCE_VALUES} selected={source} onSelect={setSource} />
          <AxisPicker label="Payer" values={PAYER_VALUES} selected={payer} onSelect={setPayer} />
          <AxisPicker
            label="Attach timing"
            values={ATTACH_TIMING_VALUES}
            selected={attachTiming}
            onSelect={setAttachTiming}
          />

          {blockingReasons.length > 0 && (
            <View style={styles.reasons}>
              {blockingReasons.map((reason) => (
                <Text key={reason} style={styles.reasonText}>
                  {reason}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {onCancel && <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />}
            <Button label="Qualify" onPress={handleSubmit} disabled={!canSubmit} style={styles.action} />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

export default QualifyScreen;

/** Renders when no lead is supplied — mirrors `LeadInboxScreen.tsx`'s no-data-source guard. */
export function QualifyScreenEmpty() {
  return (
    <View style={styles.screen}>
      <EmptyState title="Qualify" message="No lead selected." />
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
  card: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  metaWarning: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  reasons: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  reasonText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
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
