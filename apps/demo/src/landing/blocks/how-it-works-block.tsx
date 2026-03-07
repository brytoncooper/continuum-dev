import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { howItWorksContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const labelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function HowItWorksBlock() {
  return (
    <div id="how-it-works">
      <LandingSection title={howItWorksContent.title} description={howItWorksContent.description}>
        <LandingGrid alignItems="stretch">
          {howItWorksContent.steps.map((step) => (
            <LandingCard key={step.label} span={3} tone="soft" fullHeight>
              <div style={labelStyle}>{step.label}</div>
              <div style={{ ...titleStyle, marginTop: space.md }}>{step.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>{step.body}</div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
