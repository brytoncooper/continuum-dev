import type { CSSProperties } from 'react';

export const color = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  surfaceHover: '#e2e8f0',
  border: '#d5deea',
  borderFocus: '#3b82f6',
  text: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#d97706',
  warningBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  infoBg: '#dbeafe',
  panelBg: '#0f172a',
  panelSurface: '#162235',
  panelSurfaceAlt: '#1e2d44',
  panelBorder: '#334155',
  panelText: '#e2e8f0',
  panelTextSecondary: '#cbd5e1',
  panelTextMuted: '#94a3b8',
  white: '#ffffff',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 9999,
} as const;

export const shadow = {
  card: '0 1px 3px rgba(2, 6, 23, 0.24), 0 1px 2px rgba(2, 6, 23, 0.18)',
  elevated: '0 8px 24px rgba(2, 6, 23, 0.32), 0 4px 10px rgba(2, 6, 23, 0.2)',
  focus: '0 0 0 2px rgba(96, 165, 250, 0.45)',
} as const;

export const typeScale = {
  h1: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' },
  h3: { fontSize: 14, fontWeight: 600 },
  body: { fontSize: 14, fontWeight: 400 },
  caption: { fontSize: 12, fontWeight: 500 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  mono: {
    fontSize: 12,
    fontWeight: 400,
    fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
  },
} as const satisfies Record<string, CSSProperties>;

