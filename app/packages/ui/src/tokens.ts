// Brand tokens for @jobcore/ui.
// Source of truth: the SD Assembly Pros website (local saved copy) —
//   wiki/admin/webpages/SDAssemblyPros/sdassemblypro.com/{styles.css,fonts.css}
// React Native consumes plain JS objects: no CSS custom properties, no clamp(),
// no box-shadow strings. CSS idioms are translated below, not copied.

export const colors = {
  primary: '#1B2A4A',
  primaryLight: '#2C4066',
  primaryDark: '#0F1A2E',
  secondary: '#1B2A4A',
  secondaryLight: '#2C4066',
  secondaryDark: '#0F1A2E',
  accent: '#E1AF80',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F5',
  text: '#212529',
  textLight: '#495057',
  textMuted: '#868E96',
  textMutedDark: '#78818A',
  gold: '#E1AF80',
  border: '#ADB5BD', // darkened for input visibility (Jeff 2026-10-30)
  divider: '#CED4DA', // light row/list separator, softer than border
  black: '#000000', // pure black for high-contrast outlines (checklist tick Checkbox)
  selected: '#2563eb', // selected-item underline (style sheet v0.4)
  sand: '#D9C7A0',
  sandInactive: '#F0EBDC',
  sandDisabled: '#F7F4EB',
  estimateApprovedBar: '#E0A800',
  paidBar: '#2E7D32',
  overlay: 'rgba(27, 42, 74, 0.85)',
  // Semantic status colors — NOT defined in the brand CSS (source has no status
  // UI). Each is a distinct hue harmonized with the navy/sand brand, chosen so
  // no status color collides with an existing brand/accent token.
  success: '#2E7D32', // harmonized green
  danger: '#C62828',  // harmonized red
  warning: '#FACC15', // yellow — lighter/yellower; distinct from danger red and brand orange
  info: '#4A9BE8',    // blue (lightened, Jeff 2026-10-31) — distinct from primary/primaryLight (navy)
} as const;

export const typography = {
  fontFamily: {
    heading: 'Poppins_600SemiBold',       // used for headings/buttons/nav in source
    headingBold: 'Poppins_700Bold',
    headingMedium: 'Poppins_500Medium',
    body: 'Inter_400Regular',            // body text
    bodyMedium: 'Inter_500Medium',
    bodySemibold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  // Source sizes are fluid clamp(); RN has no viewport units, so each collapses
  // to a fixed density-independent value (upper-mid of the clamp range).
  size: { h1: 40, h2: 32, h3: 24, h4: 20, h5: 18, h6: 16, body: 16, label: 14, small: 13, summary: 8, detail: 10 },
  lineHeight: { heading: 1.2, body: 1.6, relaxed: 1.7 },
  letterSpacing: { tight: 0, normal: 0.3, wide: 0.5 },
} as const;

// Named spacing scale — set by Jeff 2026-10-31 (replaces the earlier rem-derived scale).
export const spacing = { xs: 4, sm: 6, md: 10, lg: 15, xl: 20, xxl: 28 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

// CSS box-shadow → RN: iOS uses shadow*, Android uses elevation. One token = one object.
export const shadow = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.08, shadowRadius: 3,  elevation: 1 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 },  shadowOpacity: 0.10, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.12, shadowRadius: 30, elevation: 6 },
  xl: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 10 },
} as const;

/**
 * Shared selected-item look: a 2 px bottom border in `colors.selected`.
 * `keepSpace` reserves the border (transparent) when unselected so layout doesn't jump.
 */
export const selectedStyle = (selected: boolean, keepSpace = false) =>
  selected
    ? ({ borderBottomWidth: 2, borderBottomColor: colors.selected } as const)
    : keepSpace
      ? ({ borderBottomWidth: 2, borderBottomColor: 'transparent' } as const)
      : undefined;

export const tokens = { colors, typography, spacing, radius, shadow } as const;
export type Tokens = typeof tokens;
