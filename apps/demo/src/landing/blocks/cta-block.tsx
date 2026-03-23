import type { CSSProperties } from 'react';
import { repositoryUrl } from '../../site-config';
import { color, radius, space, type } from '../../ui/tokens';
import { ctaContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const descriptionStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const cardTitleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const cardBodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const actionStyle = (
  tone: 'default' | 'soft' | 'strong' = 'default'
): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color:
    tone === 'strong'
      ? color.surface
      : tone === 'soft'
      ? color.highlight
      : color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${
    tone === 'strong'
      ? color.accentStrong
      : tone === 'soft'
      ? color.highlight
      : color.border
  }`,
  borderRadius: radius.pill,
  background:
    tone === 'strong'
      ? color.accent
      : tone === 'soft'
      ? color.highlightSoft
      : color.surface,
});

export function CtaBlock() {
  return (
    <LandingSection
      title={ctaContent.title}
      description={ctaContent.description}
    >
      <LandingGrid alignItems="stretch">
        <LandingCard span={12} tone="strong">
          <div style={descriptionStyle}>
            Install first. The demo shows why this matters.
          </div>
        </LandingCard>
        {ctaContent.actions.map((action) => (
          <LandingCard
            key={action.title}
            span={4}
            tone={action.tone ?? 'default'}
            fullHeight
          >
            <div style={cardTitleStyle}>{action.title}</div>
            <div style={{ ...cardBodyStyle, marginTop: space.sm }}>
              {action.body}
            </div>
            <div style={{ marginTop: space.lg }}>
              <a
                href={action.href === 'github' ? repositoryUrl : action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
                style={actionStyle(action.tone ?? 'default')}
              >
                {action.label}
              </a>
            </div>
          </LandingCard>
        ))}
      </LandingGrid>
    </LandingSection>
  );
}
