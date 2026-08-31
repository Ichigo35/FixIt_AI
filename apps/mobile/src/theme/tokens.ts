/**
 * Tokens de design FixIt AI — moderne, premium, minimaliste, rassurant.
 * Une seule source pour les couleurs (clair/sombre), espacements, rayons, typo.
 */

export const palette = {
  brand600: '#2563EB',
  brand500: '#3B82F6',
  brand100: '#DBEAFE',

  green600: '#16A34A',
  green100: '#DCFCE7',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  red600: '#DC2626',
  red100: '#FEE2E2',
  orange600: '#EA580C',

  white: '#FFFFFF',
  black: '#000000',

  slate950: '#0B1120',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryText: string;
  success: string;
  successBg: string;
  caution: string;
  cautionBg: string;
  danger: string;
  dangerBg: string;
  advanced: string;
}

export const lightColors: ThemeColors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceElevated: palette.white,
  border: palette.slate200,
  text: palette.slate900,
  textMuted: palette.slate500,
  textInverse: palette.white,
  primary: palette.brand600,
  primaryText: palette.white,
  success: palette.green600,
  successBg: palette.green100,
  caution: palette.amber600,
  cautionBg: palette.amber100,
  danger: palette.red600,
  dangerBg: palette.red100,
  advanced: palette.orange600,
};

export const darkColors: ThemeColors = {
  background: palette.slate950,
  surface: palette.slate900,
  surfaceElevated: palette.slate800,
  border: palette.slate800,
  text: palette.slate50,
  textMuted: palette.slate400,
  textInverse: palette.slate900,
  primary: palette.brand500,
  primaryText: palette.white,
  success: '#4ADE80',
  successBg: 'rgba(22,163,74,0.18)',
  caution: '#FBBF24',
  cautionBg: 'rgba(217,119,6,0.18)',
  danger: '#F87171',
  dangerBg: 'rgba(220,38,38,0.18)',
  advanced: '#FB923C',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
} as const;

export type TypographyVariant = keyof typeof typography;
