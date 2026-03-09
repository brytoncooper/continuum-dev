import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { LandingCard, LandingFeatureList, LandingGrid } from '../landing-layout';
import { heroContent } from '../content/landing-content';

const cardTitleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const cardBodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

const leadStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const actionStyle = (strong = false): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: strong ? color.surface : color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${strong ? color.borderStrong : color.border}`,
  borderRadius: 999,
  background: strong ? color.accent : color.surface,
});

export function HeroBlock() {
  return (
    <LandingGrid>
      <LandingCard span={12} tone="strong">
        <div style={leadStyle}>
          Dynamic interfaces should feel adaptive, not fragile. Continuum keeps the session
          coherent while the UI keeps changing.
        </div>
        <div style={actionsStyle}>
          <a href="/live-ai" style={actionStyle(true)}>
            Live AI Demo
          </a>
          <a href="/starter-kit" style={actionStyle()}>
            Explore starter kit
          </a>
          <a href="/playground" style={actionStyle()}>
            Open Static Demo
          </a>
        </div>
        <LandingFeatureList
          items={[
            'Regenerate the interface without wiping in-progress user input.',
            'See a full starter-kit experience instantly in the Live AI Demo.',
            'Let AI, schemas, and workflows restructure the screen without rewriting your state model.',
            'Get reconciliation, persistence, proposals, and diagnostics in one continuity layer.',
          ]}
        />
      </LandingCard>
      {heroContent.callouts.map((callout) => (
        <LandingCard key={callout.title} span={4} tone="soft">
          <div style={cardTitleStyle}>{callout.title}</div>
          <div style={{ ...cardBodyStyle, marginTop: space.sm }}>{callout.body}</div>
        </LandingCard>
      ))}
    </LandingGrid>
  );
}
