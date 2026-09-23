import React from 'react';
import { Platform, StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from './tokens';

const { fontFamily: F, letterSpacing: LS } = typography;
const INTER: Record<string, string> = { '400': F.body, normal: F.body, '500': F.bodyMedium, '600': F.bodySemibold, '700': F.bodyBold, bold: F.bodyBold, '800': F.bodyBold };
const POPPINS: Record<string, string> = { '500': F.headingMedium, '600': F.heading, '700': F.headingBold, bold: F.headingBold, '800': F.headingBold };
const WEB = Platform.OS === 'web' ? ({ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' } as unknown as TextStyle) : null;
const Nested = React.createContext(false);

export type { TextProps };
export const Text = React.forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const nested = React.useContext(Nested);
  const { fontWeight, ...s } = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const fam = s.fontFamily ?? '';
  const w = fontWeight == null ? '' : String(fontWeight);
  const brand = fam === '' || fam.startsWith('Inter') || fam.startsWith('Poppins');
  const inherit = nested && fam === '' && w === '';
  const family = (fam.startsWith('Poppins') ? POPPINS : INTER)[w] ?? (fam || F.body);
  const size = s.fontSize ?? typography.size.label;
  const tracking = s.letterSpacing ?? (size >= 20 ? LS.tight : size >= 14 ? LS.normal : LS.wide);
  const face: TextStyle = !brand ? { fontWeight } : inherit ? {} : { fontFamily: family };
  const spacing: TextStyle = !nested || s.fontSize != null ? { letterSpacing: tracking } : {};
  return <Nested.Provider value><RNText ref={ref} {...rest} style={[nested ? null : { color: colors.text }, WEB, s, face, spacing]} /></Nested.Provider>;
});
