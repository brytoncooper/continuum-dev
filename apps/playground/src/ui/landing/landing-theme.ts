import { transition } from '../tokens';

export const landingTheme = {
  colors: {
    canvas: '#06070a',
    surface: 'rgba(255, 255, 255, 0.03)',
    surfaceAlt: 'rgba(255, 255, 255, 0.06)',
    surfaceSubtle: 'rgba(255, 255, 255, 0.02)',
    panel: 'rgba(255, 255, 255, 0.04)',
    panelBorder: 'rgba(124, 58, 237, 0.25)',
    text: '#f0f0f8',
    textMuted: 'rgba(224, 224, 240, 0.65)',
    textSoft: 'rgba(200, 200, 220, 0.45)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderGlow: 'rgba(124, 58, 237, 0.35)',
    accent: '#a78bfa',
    accentBright: '#c4b5fd',
    accentAlt: '#34d399',
    accentCyan: '#22d3ee',
    accentWarn: '#fbbf24',
    accentGradient:
      'linear-gradient(135deg, #7c3aed 0%, #a78bfa 35%, #22d3ee 100%)',
    accentGlow:
      'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(34, 211, 238, 0.08))',
    accentGlowStrong:
      'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(34, 211, 238, 0.15))',
    shadowPrimary:
      '0 0 60px rgba(124, 58, 237, 0.3), 0 0 120px rgba(124, 58, 237, 0.1)',
    shadowSurface: '0 20px 60px rgba(0, 0, 0, 0.5)',
    shadowGlow: '0 0 30px rgba(124, 58, 237, 0.15)',
  },
  gradients: {
    page: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124, 58, 237, 0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(34, 211, 238, 0.06), transparent), radial-gradient(ellipse 70% 40% at 10% 80%, rgba(124, 58, 237, 0.08), transparent), #06070a',
    panel:
      'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
    hero: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(124, 58, 237, 0.2), transparent 60%), radial-gradient(ellipse 60% 60% at 80% 20%, rgba(34, 211, 238, 0.12), transparent 50%), #06070a',
    cta: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124, 58, 237, 0.18), transparent 60%), rgba(10, 10, 18, 0.95)',
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
  badges: ['Data continuity', 'AI-native', 'Zero lock-in'],
} as const;
