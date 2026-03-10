import type { CSSProperties } from 'react';
import { repositoryUrl } from '../../site-config';
import { color, radius, space, type } from '../../ui/tokens';
import { closingCtaContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const headlineStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const actionStyle = (tone: 'default' | 'soft' | 'strong' = 'default'): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: tone === 'strong' ? color.surface : tone === 'soft' ? color.highlight : color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${
    tone === 'strong' ? color.accentStrong : tone === 'soft' ? color.highlight : color.border
  }`,
  borderRadius: radius.pill,
  background:
    tone === 'strong' ? color.accent : tone === 'soft' ? color.highlightSoft : color.surface,
});

export function ClosingCtaBlock() {
  return (
    <LandingSection title={closingCtaContent.title} description={closingCtaContent.description}>
      <LandingGrid alignItems="stretch">
        {closingCtaContent.actions.map((action) => (
          <LandingCard key={action.title} span={4} tone={action.tone ?? 'default'} fullHeight>
            <div style={headlineStyle}>{action.title}</div>
            <div style={{ ...bodyStyle, marginTop: space.sm }}>{action.body}</div>
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
