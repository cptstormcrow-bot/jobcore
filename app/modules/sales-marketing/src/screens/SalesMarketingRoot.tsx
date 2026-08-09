/**
 * sales-marketing module top-level nav container.
 *
 * Mirrors `field-tech/src/index.ts`'s `FieldTechRoot` state-driven tab
 * pattern (never a navigator — the host's single `path` segment is the
 * only route entry this module owns). Wires the module's four screens
 * (Review Library, Pitch Picker, Composer, Reporting) as sibling tabs.
 *
 * `./ReviewLibrary`, `./PitchPicker`, `./Composer`, `./Reporting` do not
 * exist yet as of this pass — this file wires the import contract ahead
 * of their landing, same-pattern as field-tech importing its own screens
 * directly in `index.ts`.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '@jobcore/ui';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';

type SubView = 'reviewLibrary' | 'pitchPicker' | 'composer' | 'reporting';

const TABS: Array<{ key: SubView; label: string }> = [
  { key: 'reviewLibrary', label: 'Review Library' },
  { key: 'pitchPicker', label: 'Pitch Picker' },
  { key: 'composer', label: 'Composer' },
  { key: 'reporting', label: 'Reporting' },
];

export function SalesMarketingRoot(): React.ReactElement {
  const [subView, setSubView] = React.useState<SubView>('reviewLibrary');

  let content: React.ReactElement;
  switch (subView) {
    case 'pitchPicker':
      content = React.createElement(PitchPicker, null);
      break;
    case 'composer':
      content = React.createElement(Composer, null);
      break;
    case 'reporting':
      content = React.createElement(Reporting, null);
      break;
    case 'reviewLibrary':
    default:
      content = React.createElement(ReviewLibrary, null);
      break;
  }

  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(
      View,
      { style: styles.tabRow },
      ...TABS.map((tab) =>
        React.createElement(Button, {
          key: tab.key,
          label: tab.label,
          variant: subView === tab.key ? 'primary' : 'outline',
          size: 'sm',
          onPress: () => setSubView(tab.key),
          style: styles.tabButton,
        }),
      ),
    ),
    content,
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  tabButton: {
    borderRadius: 6,
  },
});

export default SalesMarketingRoot;
