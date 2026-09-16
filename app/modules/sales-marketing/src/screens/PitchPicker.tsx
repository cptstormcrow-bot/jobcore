/**
 * PitchPicker — pitch angle selection screen (P6, Pitch picker and composer).
 *
 * Presents the four pitch angles a sales rep can build a post around: service
 * line, community, seasonal, before/after. Selecting one hands off to the
 * Composer screen with that angle as context, so Composer can pre-filter its
 * candidate `marketing_assets` / `reviews` to the ones matching the angle.
 *
 * This module has no React Navigation navigator of its own —
 * `SalesMarketingRoot` (`./SalesMarketingRoot.tsx`) wires its four screens as
 * state-driven sibling tabs, never a stack, matching field-tech's
 * `FieldTechRoot` precedent (see that file's module doc comment). So "navigate
 * to Composer with the angle as a param" here means the same thing
 * `FieldJobDetail` does with its own props: a caller-supplied prop function.
 * `onNavigateToComposer` is that hand-off — the host (`SalesMarketingRoot`,
 * once it threads this prop through) calls it to switch `subView` to
 * `'composer'` and pass `pitchAngle` down as `Composer`'s own prop, the same
 * way `customerPhone` flows into `FieldJobDetail` from its caller.
 *
 * `pitchAngle` intentionally reuses `post_drafts.pitch_angle`'s free-text
 * wire shape (`../data/ports.ts`'s `PostDraftRow.pitch_angle`) rather than
 * inventing a separate union — `PitchAngle` below is the same four values
 * Composer will write straight into that column on draft creation.
 */

import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScreenTitle, colors } from '@jobcore/ui';

/** The four pitch angles a sales rep can build a post around (spec § Pitch picker and composer). */
export type PitchAngle = 'service_line' | 'community' | 'seasonal' | 'before_after';

interface PitchAngleOption {
  angle: PitchAngle;
  label: string;
  description: string;
}

const PITCH_ANGLE_OPTIONS: readonly PitchAngleOption[] = [
  {
    angle: 'service_line',
    label: 'Service line',
    description: 'Highlight one specific service — assets and reviews tied to that service.',
  },
  {
    angle: 'community',
    label: 'Community',
    description: 'Highlight a service area — assets and reviews tied to that community.',
  },
  {
    angle: 'seasonal',
    label: 'Seasonal',
    description: 'Tie the post to the current season or a seasonal promotion.',
  },
  {
    angle: 'before_after',
    label: 'Before / after',
    description: 'Pair before/after job photos for a visual transformation story.',
  },
];

/**
 * Props for `PitchPicker`. `onNavigateToComposer` is this module's
 * navigation-param hand-off — see the module doc comment above for why a
 * callback prop stands in for a React Navigation param here.
 */
export interface PitchPickerProps {
  /**
   * Called with the selected pitch angle when a rep picks one. The caller
   * (`SalesMarketingRoot`) is responsible for switching to the Composer
   * screen and passing this same `angle` value through as Composer's
   * `pitchAngle` prop, so Composer can pre-filter candidate
   * `marketing_assets` / `reviews` to that angle.
   */
  onNavigateToComposer?: (angle: PitchAngle) => void;
}

/** Pitch angle selection screen — four selectable cards, one per angle. */
export function PitchPicker({ onNavigateToComposer }: PitchPickerProps): React.ReactElement {
  const handleSelect = React.useCallback(
    (angle: PitchAngle) => {
      onNavigateToComposer?.(angle);
    },
    [onNavigateToComposer],
  );

  return (
    <View style={styles.container}>
      <ScreenTitle title="Pick a Pitch Angle" />
      <Text style={styles.subtitle}>
        Choose an angle to build a post around — Composer will pre-filter matching assets and reviews.
      </Text>

      <View style={styles.cardList}>
        {PITCH_ANGLE_OPTIONS.map((option) => (
          <Pressable
            key={option.angle}
            accessibilityRole="button"
            onPress={() => handleSelect(option.angle)}
            style={styles.card}
          >
            <Text style={styles.cardLabel}>{option.label}</Text>
            <Text style={styles.cardDescription}>{option.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMutedDark,
    marginTop: 4,
    marginBottom: 16,
  },
  cardList: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 16,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMutedDark,
  },
});

export default PitchPicker;
