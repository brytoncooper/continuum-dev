import { transition } from '../tokens';

export const landingTheme = {
  colors: {
    canvas: '#f4f2ff',
    surface: '#ffffff',
    surfaceAlt: '#ebe9ff',
    surfaceSubtle: '#f9f8ff',
    panel: 'rgba(255, 255, 255, 0.75)',
    panelBorder: 'rgba(99, 82, 194, 0.25)',
    text: '#111827',
    textMuted: '#475569',
    textSoft: '#6b7280',
    border: '#d5cded',
    accent: '#5f3dd2',
    accentAlt: '#19c8b0',
    accentWarn: '#f59e0b',
    accentGradient:
      'linear-gradient(132deg, #5f3dd2 0%, #6d4dff 38%, #20c7b5 100%)',
    accentGlow: 'linear-gradient(132deg, rgba(95, 61, 210, 0.16), rgba(32, 199, 181, 0.16))',
    shadowPrimary: '0 20px 40px rgba(95, 61, 210, 0.16)',
    shadowSurface: '0 18px 40px rgba(28, 25, 42, 0.08)',
  },
  gradients: {
    page:
      'radial-gradient(circle at 12% 18%, rgba(95, 61, 210, 0.12), transparent 42%), radial-gradient(circle at 88% 8%, rgba(32, 199, 181, 0.14), transparent 42%), linear-gradient(160deg, #f7f5ff 0%, #f3f2fb 38%, #f8fbff 100%)',
    panel:
      'linear-gradient(154deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 243, 255, 0.88) 100%)',
  },
  fonts: {
    display: '"Syne", "Montserrat", sans-serif',
    body: '"Manrope", "Inter", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Fira Code", Consolas, monospace',
  },
  transitions: {
    normal: transition.normal,
    slow: transition.slow,
  },
  badges: ['State continuity', 'AI-first', 'Enterprise-ready'],
} as const;
