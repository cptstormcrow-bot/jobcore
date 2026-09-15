/**
 * Reviews stub for the field-tech module's `AppChrome` H menu.
 *
 * No Reviews feature exists yet in field-tech; this is a placeholder
 * destination so the menu item resolves to a real screen instead of a
 * dead `onPress`. Mirrors the `EmptyState` placeholder pattern already
 * used by `sales-marketing/src/screens/SalesMarketingRoot.tsx`'s
 * `composer` sub-view fallback.
 */

import * as React from 'react';
import { EmptyState } from '@jobcore/ui';

export function Reviews(): React.ReactElement {
  return React.createElement(EmptyState, {
    title: 'Reviews',
    message: 'Reviews are coming soon.',
  });
}

export default Reviews;
