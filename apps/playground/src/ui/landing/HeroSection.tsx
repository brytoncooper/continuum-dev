import { radius, shadow, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

interface HeroSectionProps {
  onEnter: () => void;
}

export function HeroSection({ onEnter }: HeroSectionProps) {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${160}px ${space.xl}px ${140}px`,
        background: landingTheme.gradients.page,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: landingTheme.fonts.body,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(135deg, rgba(95, 61, 210, 0.16), rgba(32, 199, 181, 0.12))',
          opacity: 0.45,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', maxWidth: 760, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space.sm,
            padding: `${space.xs}px ${space.md}px`,
            borderRadius: radius.pill,
            background: landingTheme.colors.panel,
            border: `1px solid ${landingTheme.colors.panelBorder}`,
            color: landingTheme.colors.textMuted,
            marginBottom: space.xl,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: landingTheme.fonts.display,
          }}
        >
          State continuity for schema-driven apps
        </div>
        <h1
          style={{
            ...typeScale.h1,
            fontFamily: landingTheme.fonts.display,
            fontSize: 56,
            lineHeight: 1.05,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: space.lg,
            background: landingTheme.colors.accentGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Preserve intent when schemas evolve, without losing moments.
        </h1>
        <p
          style={{
            ...typeScale.body,
            fontSize: 20,
            color: landingTheme.colors.textMuted,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: space.xxxl,
            maxWidth: 660,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Continuum keeps user state coherent while interfaces iterate, regenerate, and adapt. This makes
          schema-driven experiences feel stable even while their structure changes in real time.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: space.md,
            justifyContent: 'center',
          }}
        >
          {landingTheme.badges.map((badge) => (
            <span
              key={badge}
              style={{
                padding: `${space.xs}px ${space.md}px`,
                borderRadius: radius.pill,
                background: landingTheme.colors.accentGlow,
                color: landingTheme.colors.accent,
                border: `1px solid ${landingTheme.colors.border}`,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </span>
          ))}
        </div>
        <button
          data-testid="hero-enter-playground"
          onClick={onEnter}
          style={{
            marginTop: space.xxl,
            padding: `${space.md}px ${space.xxxl}px`,
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
            background: landingTheme.colors.accentGradient,
            border: 'none',
            borderRadius: radius.lg,
            cursor: 'pointer',
            boxShadow: landingTheme.colors.shadowPrimary,
            transition: landingTheme.transitions.normal,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.filter = 'brightness(1.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.filter = 'none';
          }}
        >
          Enter the Playground
        </button>
      </div>
    </section>
  );
}
