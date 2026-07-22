// Brand tokens for @jobcore/ui.
// Source of truth: the SD Assembly Pros website (local saved copy) —
//   wiki/admin/webpages/SDAssemblyPros/sdassemblypro.com/{styles.css,fonts.css}
// React Native consumes plain JS objects: no CSS custom properties, no clamp(),
// no box-shadow strings. CSS idioms are translated below, not copied.

export const colors = {
  primary: '#1B2A4A',
  primaryLight: '#2C4066',
  primaryDark: '#0F1A2E',
  secondary: '#E8740C',
  secondaryLight: '#F5921A',
  secondaryDark: '#C46000',
  accent: '#F5A623',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F5',
  text: '#212529',
  textLight: '#495057',
  textMuted: '#868E96',
  border: '#E9ECEF',
  overlay: 'rgba(27, 42, 74, 0.85)',
  // PLACEHOLDER — semantic status colors are NOT defined in the brand CSS.
  // These are reasonable defaults harmonized with the navy/orange brand;
  // confirm or replace before shipping status UI.
  success: '#2E7D32', // PLACEHOLDER
  danger: '#C62828',  // PLACEHOLDER
  warning: '#F5A623', // PLACEHOLDER — reuses brand accent
  info: '#2C4066',    // PLACEHOLDER — reuses primaryLight
} as const;

export const typography = {
  fontFamily: {
    heading: 'Poppins',       // used for headings/buttons/nav in source
    body: 'Inter',            // body text
    accent: 'DancingScript',  // declared-but-unused in source; kept for future use
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
  size: { h1: 40, h2: 32, h3: 24, h4: 20, h5: 18, h6: 16, body: 16, label: 14, small: 13 },
  lineHeight: { heading: 1.2, body: 1.6, relaxed: 1.7 },
} as const;

// Source spacing was ad-hoc rem literals (no --space-* tokens); this named scale
// is derived from the recurring values (base 16px: 0.25rem=4 … 3rem=48).
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

// CSS box-shadow → RN: iOS uses shadow*, Android uses elevation. One token = one object.
export const shadow = {
  sm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.08, shadowRadius: 3,  elevation: 1 },
  md: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 },  shadowOpacity: 0.10, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.12, shadowRadius: 30, elevation: 6 },
  xl: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 10 },
} as const;

export const tokens = { colors, typography, spacing, radius, shadow } as const;
export type Tokens = typeof tokens;
