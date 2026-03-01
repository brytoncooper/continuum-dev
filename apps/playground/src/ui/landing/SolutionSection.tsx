import { useRef, useEffect, useState } from 'react';
import { space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const flowSteps = [
  { label: 'View v1', desc: 'Baseline definition', accent: 'rgba(124, 58, 237, 0.3)' },
  { label: 'User fills data', desc: 'Values entered', accent: 'rgba(99, 102, 241, 0.3)' },
  { label: 'View v2', desc: 'AI updates the view', accent: 'rgba(34, 211, 238, 0.3)' },
  { label: 'Reconcile', desc: 'Match, migrate, preserve', accent: 'rgba(52, 211, 153, 0.3)' },
  { label: 'Data intact', desc: 'Values carry forward', accent: 'rgba(167, 139, 250, 0.3)' },
];

const features = [
  { title: 'Match by key', desc: 'Deterministic node identity across revisions', icon: '\u2192' },
  { title: 'Migrate on change', desc: 'Custom strategies for view evolution', icon: '\u21BB' },
  { title: 'Checkpoint & rewind', desc: 'Restore any prior state with confidence', icon: '\u23EA' },
];

export function SolutionSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-testid="landing-solution"
      style={{
        padding: `${140}px ${space.xl}px`,
        background: landingTheme.gradients.page,
        color: landingTheme.colors.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div
          style={{
            ...typeScale.label,
            color: landingTheme.colors.textSoft,
            textTransform: 'uppercase',
            letterSpacing: '0.25em',
            textAlign: 'center',
            marginBottom: space.md,
            fontSize: 11,
          }}
        >
          Continuity engine
        </div>
        <h2
          style={{
            fontFamily: landingTheme.fonts.display,
            fontSize: 44,
            fontWeight: 800,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: 56,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Data continuity, engineered for resilience
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0,
            marginBottom: 56,
          }}
        >
          {flowSteps.map((step, i) => (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                animation: visible
                  ? `landing-card-appear 0.5s ease ${i * 0.1}s both`
                  : 'none',
              }}
            >
              <div
                style={{
                  padding: `12px 20px`,
                  background: step.accent,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: 12,
                  border: `1px solid rgba(255, 255, 255, 0.08)`,
                  textAlign: 'center',
                  minWidth: 130,
                }}
              >
                <div
                  style={{
                    fontFamily: landingTheme.fonts.display,
                    fontSize: 13,
                    fontWeight: 700,
                    color: landingTheme.colors.text,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: landingTheme.colors.textSoft,
                    marginTop: 2,
                  }}
                >
                  {step.desc}
                </div>
              </div>
              {i < flowSteps.length - 1 && (
                <span
                  style={{
                    color: landingTheme.colors.accentBright,
                    fontSize: 16,
                    padding: '0 8px',
                    opacity: 0.5,
                    animation: visible
                      ? `landing-flow-arrow 2s ease ${0.8 + i * 0.3}s infinite`
                      : 'none',
                  }}
                >
                  &#x2192;
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {features.map((f, i) => (
            <div
              key={f.title}
              style={{
                padding: `20px 24px`,
                background: landingTheme.colors.panel,
                border: `1px solid ${landingTheme.colors.border}`,
                borderRadius: 14,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                animation: visible
                  ? `landing-card-appear 0.5s ease ${0.5 + i * 0.1}s both`
                  : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  color: landingTheme.colors.accentCyan,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {f.icon}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: landingTheme.fonts.display,
                    fontSize: 14,
                    fontWeight: 700,
                    color: landingTheme.colors.accentBright,
                    marginBottom: 4,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: landingTheme.colors.textSoft,
                    lineHeight: 1.5,
                  }}
                >
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
