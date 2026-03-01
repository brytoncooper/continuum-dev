import { useRef, useEffect, useState } from 'react';
import { space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const codeLines = [
  { text: 'import', dim: true },
  { text: " { ContinuumProvider, ContinuumRenderer } ", accent: true },
  { text: "from '@continuum/react';\n\n", dim: true },
  { text: 'const ', dim: true },
  { text: 'nodeMap', accent: true },
  { text: " = { field: TextInput, toggle: Switch, group: Section };\n\n", normal: true },
  { text: '<', dim: true },
  { text: 'ContinuumProvider', accent: true },
  { text: ' components={nodeMap} persist="localStorage">\n', normal: true },
  { text: '  <', dim: true },
  { text: 'ContinuumRenderer', accent: true },
  { text: ' view={currentView} />\n', normal: true },
  { text: '</', dim: true },
  { text: 'ContinuumProvider', accent: true },
  { text: '>\n\n', dim: true },
  { text: 'session.', normal: true },
  { text: 'pushView', accent: true },
  { text: '(viewFromAgent);', normal: true },
];

function CodeBlock() {
  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 16,
        border: `1px solid ${landingTheme.colors.border}`,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.4), rgba(34, 211, 238, 0.3), transparent)',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <pre
        style={{
          margin: 0,
          fontFamily: landingTheme.fonts.mono,
          fontSize: 13,
          lineHeight: 1.8,
          overflow: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <code>
          {codeLines.map((seg, i) => (
            <span
              key={i}
              style={{
                color: seg.accent
                  ? '#c4b5fd'
                  : seg.dim
                    ? 'rgba(200, 200, 220, 0.35)'
                    : 'rgba(224, 224, 240, 0.75)',
              }}
            >
              {seg.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

const cards = [
  {
    title: 'AI-powered products',
    body: 'Your agent generates view definitions. Continuum handles reconciliation, persistence, and rewind \u2014 your agent focuses on generating, not bookkeeping.',
  },
  {
    title: 'Dynamic form platforms',
    body: 'Drop-in persistent, rewindable state for React and Angular. When AI enters the picture later, your app is already wired for it.',
  },
];

export function DeveloperSection() {
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
      data-testid="landing-developers"
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
            letterSpacing: '0.25em',
            textAlign: 'center',
            marginBottom: space.md,
            textTransform: 'uppercase',
            fontSize: 11,
          }}
        >
          Build with confidence
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
          Designed for teams building
          <br />
          adaptive interfaces
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {cards.map((card, i) => (
            <div
              key={card.title}
              style={{
                padding: 28,
                background: landingTheme.colors.panel,
                borderRadius: 16,
                border: `1px solid ${landingTheme.colors.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                animation: visible
                  ? `landing-card-appear 0.5s ease ${i * 0.12}s both`
                  : 'none',
              }}
            >
              <h3
                style={{
                  fontFamily: landingTheme.fonts.display,
                  fontSize: 17,
                  fontWeight: 700,
                  color: landingTheme.colors.accentBright,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: landingTheme.colors.textMuted,
                  margin: 0,
                  lineHeight: 1.7,
                }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <CodeBlock />
      </div>
    </section>
  );
}
