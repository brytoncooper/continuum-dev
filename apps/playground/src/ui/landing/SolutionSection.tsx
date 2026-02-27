import { useRef, useEffect, useState } from 'react';
import { radius, shadow, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const flowSteps = [
  { label: 'Schema v1', desc: 'Baseline definition' },
  { label: 'User fills data', desc: 'Values entered' },
  { label: 'Schema v2', desc: 'AI or agent updates' },
  { label: 'Continuum reconciles', desc: 'Match & migrate' },
  { label: 'State preserved', desc: 'Values transfer forward' },
];

const features = [
  { title: 'Match by key', desc: 'Deterministic component identity across revisions' },
  { title: 'Migrate on change', desc: 'Custom strategies for schema evolution' },
  { title: 'Checkpoint & rewind', desc: 'Restore any prior state with confidence' },
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
      { threshold: 0.2, rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-testid="landing-solution"
      style={{
        padding: `${110}px ${space.xl}px`,
        background: landingTheme.gradients.page,
        color: landingTheme.colors.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div
          style={{
            ...typeScale.label,
            color: landingTheme.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            textAlign: 'center',
            marginBottom: space.md,
          }}
        >
          Continuity engine
        </div>
        <h2
          style={{
            ...typeScale.h1,
            fontFamily: landingTheme.fonts.display,
            fontSize: 42,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: space.xxl,
            textAlign: 'center',
          }}
        >
          State continuity, engineered for resilience
        </h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: space.sm,
            marginBottom: space.xxl,
          }}
        >
          {flowSteps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
              <div
                style={{
                  padding: `${space.sm}px ${space.md}px`,
                  background: landingTheme.colors.surface,
                  backgroundImage: landingTheme.colors.accentGlow,
                  borderRadius: radius.md,
                  border: `1px solid ${landingTheme.colors.border}`,
                  boxShadow: shadow.card,
                  textAlign: 'center',
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    ...typeScale.caption,
                    fontFamily: landingTheme.fonts.display,
                    color: landingTheme.colors.text,
                    fontWeight: 700,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    ...typeScale.caption,
                    color: landingTheme.colors.textSoft,
                    fontSize: 10,
                  }}
                >
                  {step.desc}
                </div>
              </div>
              {i < flowSteps.length - 1 && (
                <span
                  style={{
                    color: landingTheme.colors.textSoft,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: space.md,
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                padding: `${space.md}px ${space.lg}px`,
                background: landingTheme.gradients.panel,
                boxShadow: landingTheme.colors.shadowSurface,
                borderRadius: radius.pill,
                border: `1px solid ${landingTheme.colors.border}`,
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: 200,
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  ...typeScale.caption,
                  color: landingTheme.colors.accent,
                  fontFamily: landingTheme.fonts.display,
                  fontWeight: 700,
                }}
              >
                {f.title}
              </span>
              <span
                style={{
                  ...typeScale.caption,
                  color: landingTheme.colors.textSoft,
                  fontSize: 11,
                }}
              >
                {f.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
