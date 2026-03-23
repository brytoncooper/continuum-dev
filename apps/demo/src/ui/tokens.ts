export const color = {
  page: '#f6f4ef',
  surface: '#ffffff',
  surfaceMuted: '#fbfaf7',
  surfaceInset: '#f1eee8',
  surfaceAccent: '#f6efe5',
  borderStrong: '#162033',
  border: '#d8d2c5',
  borderSoft: '#ebe6dc',
  text: '#162033',
  textMuted: '#5d6678',
  textSoft: '#7c8392',
  accent: '#294d7a',
  accentStrong: '#294d7a',
  accentSoft: '#f1eee8',
  highlight: '#b08a5b',
  highlightSoft: '#f5ede1',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  success: '#2d6a4f',
  successSoft: '#e2f0e7',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  page: 24,
  pageMobile: 16,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const shadow = {
  panel: '0 6px 16px rgba(22, 32, 51, 0.05), 0 1px 3px rgba(22, 32, 51, 0.03)',
} as const;

export const type = {
  hero: {
    fontSize: 48,
    lineHeight: 0.98,
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
  width: 1536,
} as const;
