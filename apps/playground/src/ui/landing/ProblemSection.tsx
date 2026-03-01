import { useRef, useEffect, useState } from 'react';
import { space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const problems = [
  {
    title: 'View updates reset the UI',
    body: 'AI agents emit entirely new view trees, causing fields and selections to silently reset.',
    gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(124, 58, 237, 0.08))',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  {
    title: 'User data vanishes mid-flow',
    body: 'Drafts, choices, and pending inputs are discarded whenever the view structure changes.',
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(124, 58, 237, 0.08))',
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  {
    title: 'Trust erodes instantly',
    body: 'Users stop engaging when the interface forgets everything they just entered.',
    gradient: 'linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(124, 58, 237, 0.08))',
    borderColor: 'rgba(34, 211, 238, 0.2)',
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
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-testid="landing-problem"
      style={{
        padding: `${140}px ${space.xl}px`,
        color: landingTheme.colors.text,
        background: landingTheme.gradients.page,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div
          style={{
            ...typeScale.label,
            color: landingTheme.colors.textSoft,
            marginBottom: space.md,
            textAlign: 'center',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            fontSize: 11,
          }}
        >
          The silent failure mode
        </div>
        <h2
          style={{
            fontFamily: landingTheme.fonts.display,
            fontSize: 44,
            fontWeight: 800,
            color: landingTheme.colors.text,
            margin: 0,
            marginBottom: 48,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Dynamic views break data continuity
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}
        >
          {problems.map((p, i) => (
            <div
              key={p.title}
              style={{
                padding: 28,
                background: p.gradient,
                borderRadius: 16,
                border: `1px solid ${p.borderColor}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                textAlign: 'left',
                animation: visible
                  ? `landing-card-appear 0.6s ease ${i * 0.12}s both`
                  : 'none',
              }}
            >
              <h3
                style={{
                  fontFamily: landingTheme.fonts.display,
                  fontSize: 17,
                  fontWeight: 700,
                  color: landingTheme.colors.text,
                  margin: 0,
                  marginBottom: 10,
                  letterSpacing: '-0.01em',
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: landingTheme.colors.textMuted,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 16,
            color: landingTheme.colors.textMuted,
            lineHeight: 1.7,
            textAlign: 'center',
            margin: 0,
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Whenever a view changes — AI generation, CMS sync, or feature rollout — user data is at risk.{' '}
          <strong style={{ color: landingTheme.colors.accentBright }}>
            Continuum makes that risk invisible.
          </strong>
        </p>
      </div>
    </section>
  );
}
