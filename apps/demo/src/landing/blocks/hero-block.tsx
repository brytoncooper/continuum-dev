import type { CSSProperties } from 'react';
import { repositoryUrl } from '../../site-config';
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
  maxWidth: 760,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const helperStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const trustChipStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
  padding: `${space.xs}px 0`,
  borderRadius: 999,
};

const actionStyle = (tone: 'strong' | 'default' | 'soft' = 'default'): CSSProperties => ({
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
  borderRadius: 999,
  background:
    tone === 'strong' ? color.accent : tone === 'soft' ? color.highlightSoft : color.surface,
});

export function HeroBlock() {
  return (
    <LandingGrid>
      <LandingCard span={12} tone="strong">
        <div style={leadStyle}>
          Typed input disappears. Progress resets. The session feels disposable.
        </div>
        <div style={actionsStyle}>
          <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle('strong')}>
            View on GitHub
          </a>
          <a href="/docs" style={actionStyle()}>
            Install / Get Started
          </a>
          <a href="/playground" style={actionStyle('soft')}>
            Try Static Demo
          </a>
          <a href="/live-ai" style={actionStyle()}>
            Launch Live AI Demo
          </a>
        </div>
        <div style={helperStyle}>
          Continuum is the fix: deterministic reconciliation, state continuity, and a fastest path
          to install with Starter Kit or headless React.
        </div>
        <div style={trustRowStyle}>
          <div style={trustChipStyle}>Deterministic reconciliation</div>
          <div style={trustChipStyle}>State continuity</div>
          <div style={trustChipStyle}>No-key static demo</div>
          <div style={trustChipStyle}>Fastest path to install</div>
        </div>
        <LandingFeatureList
          items={[
            'AI-generated and server-driven views should not wipe matching user data.',
            'Continuum keeps UI structure and user state separate, then reconciles them deterministically.',
            'Persistence, checkpoints, rewind, and diagnostics are built in.',
            'Install fast with Starter Kit or go headless with React.',
          ]}
        />
      </LandingCard>
      {heroContent.callouts.map((callout) => (
        <LandingCard key={callout.title} span={4} tone="soft" fullHeight>
          <div style={cardTitleStyle}>{callout.title}</div>
          <div style={{ ...cardBodyStyle, marginTop: space.sm }}>{callout.body}</div>
        </LandingCard>
      ))}
    </LandingGrid>
  );
}
