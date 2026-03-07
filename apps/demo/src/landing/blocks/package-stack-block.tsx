import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { packageStackContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const pipelineStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const pillStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.border}`,
  borderRadius: 999,
  background: color.surfaceMuted,
};

const nameStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const titleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function PackageStackBlock() {
  return (
    <div id="package-stack">
      <LandingSection title={packageStackContent.title} description={packageStackContent.description}>
        <div style={pipelineStyle}>
          {packageStackContent.items.map((item) => (
            <div key={item.name} style={pillStyle}>
              {item.name}
            </div>
          ))}
        </div>
        <LandingGrid alignItems="stretch">
          {packageStackContent.items.map((item) => (
            <LandingCard key={item.name} span={3} fullHeight>
              <div style={nameStyle}>{item.name}</div>
              <div style={{ ...titleStyle, marginTop: space.md }}>{item.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>{item.body}</div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
