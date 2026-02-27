import { useRef, useEffect, useState } from 'react';
import { radius, shadow, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const packages = [
  { name: '@continuum/contract', desc: 'Core types and constants' },
  { name: '@continuum/runtime', desc: 'Reconciliation engine' },
  { name: '@continuum/session', desc: 'Session lifecycle' },
  { name: '@continuum/react', desc: 'React bindings' },
  { name: '@continuum/adapters', desc: 'Protocol adapters (A2UI, etc.)', branch: true },
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
      { threshold: 0.2, rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-testid="landing-architecture"
      style={{
        padding: `${120}px ${space.xl}px`,
        background: landingTheme.gradients.page,
        color: landingTheme.colors.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
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
          The foundation
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
          Designed as a modular stack
        </h2>
        <p
          style={{
            ...typeScale.body,
            color: landingTheme.colors.textMuted,
            textAlign: 'center',
            margin: 0,
            marginBottom: space.xxl,
          }}
        >
          Continuum splits into clear packages so teams can adopt pieces incrementally.
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            background: landingTheme.gradients.panel,
            borderRadius: radius.lg,
            border: `1px solid ${landingTheme.colors.border}`,
            boxShadow: shadow.card,
            overflow: 'hidden',
          }}
        >
          {packages.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: space.xs,
                padding: space.lg,
                borderBottom:
                  i < packages.length - 1 ? `1px solid ${landingTheme.colors.border}` : 'none',
                marginLeft: p.branch ? space.xxl : 0,
                borderLeft: p.branch ? `3px solid ${landingTheme.colors.accent}` : 'none',
                backgroundImage: i % 2 === 0 ? landingTheme.colors.accentGlow : 'none',
              }}
            >
              <span
                style={{
                  ...typeScale.mono,
                  color: landingTheme.colors.accent,
                  fontWeight: 700,
                  fontFamily: landingTheme.fonts.mono,
                }}
              >
                {p.name}
              </span>
              <span style={{ ...typeScale.caption, color: landingTheme.colors.textSoft }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
