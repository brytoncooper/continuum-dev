import type { CSSProperties } from 'react';
import { repositoryUrl } from '../../site-config';
import { color, radius, space, type } from '../../ui/tokens';
import { closingCtaContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const headlineStyle: CSSProperties = {
  ...type.title,
  color: color.text,
  maxWidth: 620,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  maxWidth: 620,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const actionStyle = (tone: 'default' | 'soft' | 'strong' = 'default'): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: tone === 'strong' ? color.surface : color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${
    tone === 'strong' ? color.accentStrong : color.border
  }`,
  borderRadius: radius.pill,
  background:
    tone === 'strong' ? color.accent : color.surface,
});

export function ClosingCtaBlock() {
  return (
    <LandingSection>
      <LandingGrid alignItems="stretch">
        <LandingCard span={12} tone="strong">
          <div style={headlineStyle}>{closingCtaContent.title}</div>
          <div style={{ ...bodyStyle, marginTop: space.sm }}>{closingCtaContent.description}</div>
          <div style={{ ...actionsStyle, marginTop: space.lg }}>
            {closingCtaContent.actions.map((action) => (
              <a
                key={action.title}
                href={action.href === 'github' ? repositoryUrl : action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
                style={actionStyle(action.tone ?? 'default')}
              >
                {action.label}
              </a>
            ))}
          </div>
        </LandingCard>
      </LandingGrid>
    </LandingSection>
  );
}
