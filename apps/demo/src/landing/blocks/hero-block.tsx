import type { CSSProperties } from 'react';
import { repositoryUrl } from '../../site-config';
import { color, space, type } from '../../ui/tokens';
import { LandingCard, LandingGrid } from '../landing-layout';
import { heroContent, type LandingCallout } from '../content/landing-content';
import { HeroProofModule } from './hero-proof-module';

const cardTitleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const cardBodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const actionStyle = (
  tone: 'strong' | 'default' | 'soft' = 'default'
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
  borderRadius: 999,
  background:
    tone === 'strong'
      ? color.accent
      : tone === 'soft'
      ? color.highlightSoft
      : color.surface,
});

const tertiaryLinkStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${space.sm}px ${space.xs}px`,
};

export function HeroBlock() {
  return (
    <LandingGrid>
      <LandingCard span={12} tone="strong">
        <div style={actionsStyle}>
          <a href="/docs" style={actionStyle('strong')}>
            Install
          </a>
          <a href="/playground" style={actionStyle()}>
            Open demo
          </a>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            style={tertiaryLinkStyle}
          >
            GitHub
          </a>
        </div>
        <HeroProofModule />
      </LandingCard>
      {heroContent.callouts.map((callout: LandingCallout) => (
        <LandingCard key={callout.title} span={4} tone="soft" fullHeight>
          <div style={cardTitleStyle}>{callout.title}</div>
          <div style={{ ...cardBodyStyle, marginTop: space.sm }}>
            {callout.body}
          </div>
        </LandingCard>
      ))}
    </LandingGrid>
  );
}
