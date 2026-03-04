import { transition } from './tokens';

export const playgroundTheme = {
  color: {
    canvas: '#f6f7fb',
    surface: '#ffffff',
    surfaceAlt: '#f4f5f9',
    surfaceMuted: '#eef1f7',
    panel: 'linear-gradient(160deg, rgba(255, 255, 255, 0.98), rgba(252, 250, 255, 0.95))',
    panelBorder: 'rgba(71, 85, 105, 0.24)',
    borderGlow: 'rgba(79, 70, 229, 0.22)',
    borderGlowAlt: 'rgba(13, 148, 136, 0.2)',
    text: '#13111f',
    muted: '#1f2937',
    soft: '#334155',
    accent: '#4f46e5',
    accentAlt: '#0d9488',
    accentAlt2: '#f59e0b',
    border: 'rgba(100, 116, 139, 0.24)',
    borderStrong: 'rgba(100, 116, 139, 0.4)',
    success: '#16a34a',
    successBg: 'rgba(22, 163, 74, 0.1)',
    warning: '#d97706',
    warningBg: 'rgba(217, 119, 6, 0.12)',
    danger: '#e11d48',
    dangerBg: 'rgba(225, 29, 72, 0.12)',
    infoBg: 'rgba(79, 70, 229, 0.12)',
    white: '#ffffff',
    disabledText: 'rgba(51, 65, 85, 0.6)',
    disabledBg: 'rgba(226, 232, 240, 0.6)',
  },
  shadow: {
    card: '0 10px 24px rgba(15, 23, 42, 0.10)',
    panel: '0 6px 20px rgba(15, 23, 42, 0.08)',
    glow: '0 0 0 1px rgba(79, 70, 229, 0.18)',
  },
  gradient: {
    page:
      'radial-gradient(circle at 10% 8%, rgba(79, 70, 229, 0.11), transparent 45%), radial-gradient(circle at 88% 12%, rgba(13, 148, 136, 0.1), transparent 42%), linear-gradient(155deg, #f6f7fb 0%, #f6f8fb 46%, #f9fcff 100%)',
    accent:
      'linear-gradient(132deg, #4f46e5 0%, #6366f1 52%, #0d9488 100%)',
    glow:
      'linear-gradient(132deg, rgba(79, 70, 229, 0.12), rgba(13, 148, 136, 0.1))',
  },
  type: {
    display: '"Syne", "Montserrat", sans-serif',
    body: '"Manrope", "Inter", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
  },
  transition: {
    normal: transition.normal,
    slow: transition.slow,
  },
} as const;
