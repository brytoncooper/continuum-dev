import { radius, space } from '../tokens';
import { landingTheme } from './landing-theme';

interface CTASectionProps {
  onEnter: () => void;
}

export function CTASection({ onEnter }: CTASectionProps) {
  return (
    <section
      data-testid="landing-cta"
      style={{
        padding: `${160}px ${space.xl}px`,
        textAlign: 'center',
        background: landingTheme.gradients.cta,
        color: landingTheme.colors.text,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 50% 60% at 50% 80%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 50% 60% at 50% 80%, black, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2
          style={{
            fontFamily: landingTheme.fonts.display,
            fontSize: 48,
            fontWeight: 800,
            margin: 0,
            marginBottom: 16,
            color: landingTheme.colors.text,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            background: landingTheme.colors.accentGradient,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'landing-gradient-shift 6s ease-in-out infinite',
          }}
        >
          See continuity in action
        </h2>
        <p
          style={{
            fontSize: 17,
            color: landingTheme.colors.textMuted,
            margin: 0,
            maxWidth: 520,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: 48,
            lineHeight: 1.7,
          }}
        >
          Walk through live scenarios and watch user data carry forward through
          every view change &mdash; renames, restructures, type shifts, and removals.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <button
            data-testid="cta-enter-playground"
            onClick={onEnter}
            style={{
              padding: `16px 40px`,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.01em',
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
          <span
            style={{
              fontSize: 13,
              color: landingTheme.colors.textSoft,
            }}
          >
            No signup required. Runs entirely in your browser.
          </span>
        </div>
      </div>
    </section>
  );
}
