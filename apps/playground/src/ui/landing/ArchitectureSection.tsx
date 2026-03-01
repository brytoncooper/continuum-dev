import { useRef, useEffect, useState } from 'react';
import { space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const packages = [
  { name: '@continuum/contract', desc: 'ViewDefinition, NodeValue, and all shared types', layer: 0 },
  { name: '@continuum/runtime', desc: 'Reconciliation engine \u2014 match, migrate, resolve', layer: 1 },
  { name: '@continuum/session', desc: 'Session lifecycle, checkpoints, persistence', layer: 2 },
  { name: '@continuum/react', desc: 'React bindings and renderer', layer: 3 },
  { name: '@continuum/angular', desc: 'Angular bindings and renderer', layer: 3 },
  { name: '@continuum/adapters', desc: 'Protocol adapters (A2UI, etc.)', layer: 3, branch: true },
];

const layerColors = [
  'rgba(124, 58, 237, 0.25)',
  'rgba(99, 102, 241, 0.2)',
  'rgba(34, 211, 238, 0.18)',
  'rgba(52, 211, 153, 0.15)',
];

export function ArchitectureSection() {
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
      data-testid="landing-architecture"
      style={{
        padding: `${140}px ${space.xl}px`,
        background: landingTheme.gradients.page,
        color: landingTheme.colors.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}
    >
      <div style={{ maxWidth: 580, margin: '0 auto' }}>
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
          The foundation
        </div>
        <h2
          style={{
            fontFamily: landingTheme.fonts.display,
            fontSize: 44,
            fontWeight: 800,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: 20,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          A modular stack
        </h2>
        <p
          style={{
            fontSize: 15,
            color: landingTheme.colors.textMuted,
            textAlign: 'center',
            margin: 0,
            marginBottom: 48,
            lineHeight: 1.6,
          }}
        >
          Continuum splits into clear packages so teams can adopt pieces incrementally.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            borderRadius: 16,
            border: `1px solid ${landingTheme.colors.border}`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.5), rgba(34, 211, 238, 0.3), transparent)',
            }}
          />
          {packages.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '16px 24px',
                borderBottom: i < packages.length - 1
                  ? `1px solid ${landingTheme.colors.border}`
                  : 'none',
                marginLeft: p.branch ? 32 : 0,
                borderLeft: p.branch
                  ? `2px solid ${landingTheme.colors.accentCyan}`
                  : 'none',
                background: layerColors[p.layer] ?? 'transparent',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                animation: visible
                  ? `landing-card-appear 0.4s ease ${i * 0.08}s both`
                  : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: landingTheme.fonts.mono,
                  fontSize: 13,
                  fontWeight: 600,
                  color: landingTheme.colors.accentBright,
                  letterSpacing: '-0.01em',
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: landingTheme.colors.textSoft,
                  lineHeight: 1.4,
                }}
              >
                {p.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
