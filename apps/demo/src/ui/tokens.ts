export const color = {
  page: '#f3f3f1',
  surface: '#ffffff',
  surfaceMuted: '#f8f8f6',
  surfaceInset: '#f1f1ee',
  borderStrong: '#111111',
  border: '#d9d9d3',
  borderSoft: '#e7e7e2',
  text: '#111111',
  textMuted: '#5f5f58',
  textSoft: '#7a7a73',
  accent: '#111111',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  page: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const shadow = {
  panel: '0 1px 2px rgba(17, 17, 17, 0.04)',
} as const;

export const type = {
  hero: {
    fontSize: 40,
    lineHeight: 1,
    fontWeight: 700,
    letterSpacing: '-0.04em',
  },
  title: {
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 650,
    letterSpacing: '-0.03em',
  },
  section: {
    fontSize: 15,
    lineHeight: 1.3,
    fontWeight: 650,
    letterSpacing: '-0.01em',
  },
  label: {
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 400,
  },
  small: {
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 500,
  },
} as const;

export const control = {
  height: 44,
  paddingX: 14,
  paddingY: 10,
} as const;

export const page = {
  width: 1240,
} as const;
