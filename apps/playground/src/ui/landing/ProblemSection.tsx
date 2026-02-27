import { useRef, useEffect, useState } from 'react';
import { radius, shadow, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const problems = [
  {
    title: 'Every schema change rewrites the UI',
    icon: '🔄',
    body: 'Agents and generators can emit a whole new component tree, causing stateful widgets to reset.',
  },
  {
    title: 'Forms lose their memory',
    icon: '💨',
    body: 'Drafts, selections, and pending edits are often discarded in the transition.',
  },
  {
    title: 'Trust drops at the exact wrong moment',
    icon: '🛡️',
    body: 'People hesitate to continue when the app they trusted just forgets what they entered.',
  },
];

export function ProblemSection() {
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
      data-testid="landing-problem"
      style={{
        padding: `${110}px ${space.xl}px`,
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
            marginBottom: space.md,
            textAlign: 'center',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          The silent failure mode
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
          Dynamic schemas often break continuity
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: space.xl,
            marginBottom: space.xxl,
          }}
        >
          {problems.map((p) => (
            <div
              key={p.title}
              style={{
                padding: space.xl,
                background: landingTheme.gradients.panel,
                borderRadius: radius.lg,
                border: `1px solid ${landingTheme.colors.border}`,
                boxShadow: shadow.card,
                backgroundImage: landingTheme.colors.accentGlow,
                textAlign: 'center',
                transition: landingTheme.transitions.normal,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: space.md }}>{p.icon}</div>
              <h3
                style={{
                  ...typeScale.h2,
                  fontFamily: landingTheme.fonts.display,
                  color: landingTheme.colors.text,
                  margin: 0,
                  marginBottom: space.sm,
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  ...typeScale.body,
                  color: landingTheme.colors.textMuted,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
        <p
          style={{
            ...typeScale.body,
            fontSize: 16,
            color: landingTheme.colors.textMuted,
            lineHeight: 1.6,
            textAlign: 'center',
            margin: 0,
          }}
        >
          When any schema changes—AI generation, CMS sync, or feature rollout—the screen often feels
          unstable. <strong style={{ color: landingTheme.colors.text }}>Continuum restores continuity.</strong>
        </p>
      </div>
    </section>
  );
}
