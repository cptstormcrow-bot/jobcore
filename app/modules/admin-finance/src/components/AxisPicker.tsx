/**
 * Three-way axis picker (P3f.3).
 *
 * Qualify asks staff to confirm the three axis fields the master spec
 * defines (`00-MASTER-SPEC.md` lines 122-129) — `source`, `payer`,
 * `attach_timing` — each a closed enum, byte-exact to the master spec (the
 * DB columns themselves are untyped `text`, deliberately, per the doc
 * comments in `domain/lead.ts` and `packages/core/src/index.ts`'s `Job`
 * fields, so the master spec — not the SQL — is the source of truth for the
 * legal value set):
 *   - source:         direct | home_depot | wayfair | other_partner
 *   - payer:          customer | partner
 *   - attach_timing:  at_purchase | after_the_fact
 *
 * `@jobcore/ui` has no Picker/Select/SegmentedControl primitive
 * (`packages/ui/src/index.ts` exports only `Button`, `Card`, `ListItem`,
 * `EmptyState`, `LoadingState`, `ErrorState`), so this is composed from
 * `Button` plus a plain `View`/`Text` label, styled purely from
 * `tokens.ts` — the same "compose from primitives + tokens when no
 * dedicated primitive exists" rule `LeadRow.tsx` follows. AC-11: zero raw
 * hex/rgba color literals in this file.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, colors, spacing, radius, typography } from '@jobcore/ui';

export const SOURCE_VALUES = ['direct', 'home_depot', 'wayfair', 'other_partner', 'costco', 'ikea', 'owm'] as const;
export const PAYER_VALUES = ['customer', 'partner'] as const;
export const ATTACH_TIMING_VALUES = ['at_purchase', 'after_the_fact'] as const;

export type SourceValue = (typeof SOURCE_VALUES)[number];
export type PayerValue = (typeof PAYER_VALUES)[number];
export type AttachTimingValue = (typeof ATTACH_TIMING_VALUES)[number];

/** Human-readable labels for each enum value — display only, not the stored value. */
const LABELS: Record<string, string> = {
  direct: 'Direct',
  home_depot: 'Home Depot',
  wayfair: 'Wayfair',
  other_partner: 'Other partner',
  customer: 'Customer',
  partner: 'Partner',
  at_purchase: 'At purchase',
  after_the_fact: 'After the fact',
};

export interface AxisPickerProps<T extends string> {
  label: string;
  values: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
}

/** One axis (source, payer, or attach_timing) as a row of selectable buttons. */
export function AxisPicker<T extends string>({ label, values, selected, onSelect }: AxisPickerProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {values.map((value) => (
          <Button
            key={value}
            label={LABELS[value] ?? value}
            variant={selected === value ? 'primary' : 'outline'}
            onPress={() => onSelect(value)}
            size="sm"
            style={styles.option}
          />
        ))}
      </View>
    </View>
  );
}

export default AxisPicker;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  option: {
    borderRadius: radius.sm,
  },
});
