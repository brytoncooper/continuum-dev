import { radius, space } from '../tokens';
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
        padding: `${180}px ${space.xl}px ${160}px`,
        background: landingTheme.gradients.hero,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: landingTheme.fonts.body,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15), transparent 70%)',
          top: '-10%',
          left: '15%',
          filter: 'blur(80px)',
          animation: 'landing-orb-1 12s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1), transparent 70%)',
          bottom: '-5%',
          right: '10%',
          filter: 'blur(80px)',
          animation: 'landing-orb-2 15s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', maxWidth: 820, textAlign: 'center', zIndex: 1 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space.sm,
            padding: `6px ${space.lg}px`,
            borderRadius: radius.pill,
            background: 'rgba(124, 58, 237, 0.1)',
            border: `1px solid rgba(124, 58, 237, 0.25)`,
            color: landingTheme.colors.accentBright,
            marginBottom: 40,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: landingTheme.fonts.display,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          Data continuity for view-driven applications
        </div>

        <h1
          style={{
            fontFamily: landingTheme.fonts.display,
            fontSize: 72,
            lineHeight: 1.0,
            fontWeight: 800,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: 24,
            background: landingTheme.colors.accentGradient,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'landing-gradient-shift 6s ease-in-out infinite',
            letterSpacing: '-0.03em',
          }}
        >
          User data survives
          <br />
          every view change.
        </h1>

        <p
          style={{
            fontSize: 20,
            fontWeight: 400,
            color: landingTheme.colors.textMuted,
            lineHeight: 1.7,
            margin: 0,
            marginBottom: 48,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          AI agents regenerate interfaces constantly. Continuum reconciles
          user data across every view version so nothing entered is ever
          silently lost.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: space.md,
            justifyContent: 'center',
            marginBottom: 48,
          }}
        >
          {landingTheme.badges.map((badge) => (
            <span
              key={badge}
              style={{
                padding: `5px ${space.md}px`,
                borderRadius: radius.pill,
                background: 'rgba(255, 255, 255, 0.04)',
                color: landingTheme.colors.textMuted,
                border: `1px solid ${landingTheme.colors.border}`,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
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
            position: 'relative',
            padding: `14px 48px`,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: '#ffffff',
            background: landingTheme.colors.accentGradient,
            border: 'none',
            borderRadius: radius.lg,
            cursor: 'pointer',
            boxShadow: landingTheme.colors.shadowPrimary,
            transition: 'transform 0.2s ease, box-shadow 0.3s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
            e.currentTarget.style.boxShadow =
              '0 0 80px rgba(124, 58, 237, 0.4), 0 0 160px rgba(124, 58, 237, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = landingTheme.colors.shadowPrimary;
          }}
        >
          Open the Playground
        </button>
      </div>
    </section>
  );
}
