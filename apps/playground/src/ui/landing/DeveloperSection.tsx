import { useRef, useEffect, useState } from 'react';
import { radius, shadow, space, typeScale } from '../tokens';
import { landingTheme } from './landing-theme';

const codeSnippet = `const componentMap = { input: TextInput, toggle: Toggle };
<ContinuumProvider components={componentMap} persist="localStorage">
  <YourApp />
</ContinuumProvider>
session.pushSchema(schemaFromAgent);`;

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
      { threshold: 0.2, rootMargin: '0px 0px -80px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-testid="landing-developers"
      style={{
        padding: `${120}px ${space.xl}px`,
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
            letterSpacing: '0.18em',
            textAlign: 'center',
            marginBottom: space.md,
          }}
        >
          Build with confidence
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
          For teams building adaptive interfaces
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: space.xl,
            marginBottom: space.xxl,
          }}
        >
          <div
            style={{
              padding: space.xl,
              background: landingTheme.gradients.panel,
              borderRadius: radius.lg,
              border: `1px solid ${landingTheme.colors.border}`,
              boxShadow: shadow.card,
            }}
          >
            <h3
              style={{
                ...typeScale.h2,
                fontFamily: landingTheme.fonts.display,
                color: landingTheme.colors.accent,
                margin: 0,
                marginBottom: space.md,
              }}
            >
              For AI developers
            </h3>
            <p style={{ ...typeScale.body, color: landingTheme.colors.textMuted, margin: 0, lineHeight: 1.6 }}>
              Your agent generates UI schemas. Continuum handles persistence, reconciliation, and
              rewind so your agent focuses on generating, not bookkeeping.
            </p>
          </div>
          <div
            style={{
              padding: space.xl,
              background: landingTheme.gradients.panel,
              borderRadius: radius.lg,
              border: `1px solid ${landingTheme.colors.border}`,
              boxShadow: shadow.card,
            }}
          >
            <h3
              style={{
                ...typeScale.h2,
                fontFamily: landingTheme.fonts.display,
                color: landingTheme.colors.accent,
                margin: 0,
                marginBottom: space.md,
              }}
            >
              For app developers
            </h3>
            <p style={{ ...typeScale.body, color: landingTheme.colors.textMuted, margin: 0, lineHeight: 1.6 }}>
              Drop-in persistent, rewindable state for any React app. When you add AI later, your app
              is already wired for it.
            </p>
          </div>
        </div>
        <div
          style={{
              background: landingTheme.colors.panel,
              backgroundImage: landingTheme.colors.accentGlow,
            borderRadius: radius.lg,
            padding: space.lg,
              border: `1px solid ${landingTheme.colors.panelBorder}`,
              boxShadow: shadow.card,
          }}
        >
          <pre
            style={{
              margin: 0,
              color: landingTheme.colors.text,
              fontFamily: landingTheme.fonts.mono,
              ...typeScale.mono,
              fontSize: 13,
              overflow: 'auto',
            }}
          >
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
