import { radius, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

interface CTASectionProps {
  onEnter: () => void;
}

export function CTASection({ onEnter }: CTASectionProps) {
  return (
    <section
      data-testid="landing-cta"
      style={{
        padding: `${120}px ${space.xl}px`,
        textAlign: 'center',
        background: landingTheme.gradients.panel,
        color: landingTheme.colors.text,
      }}
    >
      <h2
        style={{
          ...typeScale.h1,
          fontFamily: landingTheme.fonts.display,
          fontSize: 42,
          margin: 0,
          marginBottom: space.sm,
          color: landingTheme.colors.text,
        }}
      >
        See continuity in motion
      </h2>
      <p
        style={{
          ...typeScale.body,
          color: landingTheme.colors.textMuted,
          margin: 0,
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
          marginBottom: space.xxl,
        }}
      >
        Try live scenarios and watch values carry forward through every schema change.
      </p>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space.xs,
          padding: `${space.md}px ${space.xl}px`,
          borderRadius: radius.pill,
          border: `1px solid ${landingTheme.colors.border}`,
          marginBottom: space.xl,
          background: landingTheme.colors.surface,
          color: landingTheme.colors.textSoft,
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        Built to work with schema-driven UIs
      </div>
      <button
        data-testid="cta-enter-playground"
        onClick={onEnter}
        style={{
          padding: `${space.lg}px ${space.xxl}px`,
          fontSize: 18,
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
          e.currentTarget.style.filter = 'brightness(1.06)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.filter = 'none';
        }}
      >
        Enter the Playground
      </button>
      <p
        style={{
          ...typeScale.caption,
          color: landingTheme.colors.textSoft,
          margin: 0,
          marginTop: space.lg,
        }}
      >
        No signup required. Just the real scenario flow.
      </p>
    </section>
  );
}
